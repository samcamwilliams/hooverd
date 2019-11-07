/*
    hooverd: A simple Arweave signing and dispatch server.

    After initilisation, a hooverd can be sent unsigned Arweave transactions
    which it will then prepare, sign, and dispatch to the network.

    Fields in the unsigned transaction can be ommited, making it extremely
    simple to integrate without needing an Arweave aware client to the server.
*/

// Include dependencies.
const http = require('http')
const fs = require('fs')
const Arweave = require('arweave/node')
const argv = require('yargs').argv

// Set Arweave parameters from commandline or defaults.
const arweave_port = argv.arweavePort ? argv.arweavePort : 443
const arweave_host = argv.arweaveHost ? argv.arweaveHost : 'arweave.net'
const arweave_protocol = argv.arweaveProtocol ? argv.arweaveProtocol : 'https'

// Set hooverd parameters.
const port = argv.port ? argv.port : 1908

if(!argv.walletFile) {
    console.log("ERROR: Please specify a wallet file to load using argument " +
        "'--wallet-file <PATH>'.")
    process.exit()
}

const raw_wallet = fs.readFileSync(argv.walletFile);
const wallet = JSON.parse(raw_wallet);

const arweave = Arweave.init({
    host: arweave_host, // Hostname or IP address for a Arweave node
    port: arweave_port,
    protocol: arweave_protocol
})

async function handleRequest(request, response) {
    // Read all of the data out of the POST body.
    let dataString = ''
    request.on('data', function (data) { dataString += data })
    request.on('end', async function () {
        // Rudimentary endpoint router.
        if(request.url == "/" || request == "/json")
            handleJSONRequest(request, dataString, response)
        else if(request.url == "/tx")
            handleCompatRequest(request, dataString, response)
        else if(request.url == "/raw")
            handleRawRequest(request, dataString, response)
        else {
            response.statusCode = 400
            response.end(`Request type ${request.url} not supported\n`)
        }
    })
}

async function handleJSONRequest(_request, dataString, response) {
    let req = JSON.parse(dataString)
    let tx = await arweave.createTransaction({ data: req.data }, wallet)

    // Extract the tags in {TagName: TagValue} format, for now.
    // NOTE: This is not directly compatible with normal Arweave transactions.
    req.tags = req.tags ? req.tags : []
    req.tags.forEach(tag => {
        let key = Object.keys(tag)
        tx.addTag(key, tag[key])
    })

    dispatchTX(tx, response)
}

async function handleCompatRequest(_request, dataString, response) {
    let req = JSON.parse(dataString)
    let tx = await arweave.createTransaction({ data: req.data }, wallet)

    req.tags = req.tags ? req.tags : []
    req.tags.forEach(tag => {
        tx.addTag(tag.name, tag.value)
    })

    dispatchTX(tx, response)
}

async function handleRawRequest(request, dataString, response) {
    let headers = request.headers
    let header_keys = Object.keys(headers)
    let txData = arweave.utils.stringToBuffer(dataString)

    if(headers["x-encrypt-for"]) {
        // TODO: Encrypt the data for a wallet's private key.
        console.log("WARN: Encrypting data for a private key is not yet supported.")
        return;
        //txData = await arweave.crypto.encrypt(txData, wallet)
    }

    if(headers["x-encrypt-with"])
        txData = await arweave.crypto.encrypt(txData, headers["x-encrypt-with"])

    let tx = await arweave.createTransaction({ data: txData }, wallet)

    // Extract tags from the headers.
    // Tags should be in the format: "x-tag-TAG_NAME: TAG_VALE".

    header_keys.forEach(key => {
        if(key.startsWith("x-tag-"))
            tx.addTag(key.split("x-tag-")[1], headers[key])
    })

    dispatchTX(tx, response)
}

async function dispatchTX(tx, response) {
    // Manually set the transaction anchor, for now.
    const anchor_id = await arweave.api.get('/tx_anchor').then(x => x.data)
    tx.last_tx = anchor_id
    
    // Sign and dispatch the TX, forwarding the response code as our own.
    await arweave.transactions.sign(tx, wallet)
    let resp = await arweave.transactions.post(tx);
    response.statusCode = resp.status

    let output = `Transaction ${tx.get('id')} dispatched to ` +
        `${arweave_host}:${arweave_port} with response: ${resp.status}.`
    console.log(output)
    response.end(output + "\n")
}

module.exports = async function startServer() {
    console.log("Welcome to hooverd! 👋\n\nWe are...")
    
    // Print introductory information to the console.
    console.log(`...starting a server at http://localhost:${port}.`)

    const address = await arweave.wallets.jwkToAddress(wallet)
    let balance = arweave.ar.winstonToAr(await arweave.wallets.getBalance(address))
    console.log(`...using wallet ${address} (balance: ${balance} AR).`)

    let net_info = await arweave.network.getInfo()
    console.log("...dispatching transactions to Arweave host at",
        `${arweave_host}:${arweave_port},`,
        `synchronised at block ${net_info.height}.`)

    // Start the server itself.
    const server = http.createServer(handleRequest)
    server.listen(port, (err) => {
        if (err) {
            return console.log('Server experienced error:', err)
        }

        console.log("...now ready to hoover data! 🚀🚀🚀\n")
    })

}

