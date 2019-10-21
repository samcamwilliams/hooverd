# hooverd
The hoover daemon is a simple local HTTP server for delegated Arweave transaction generation, signing, and dispatch.

`hooverd` can serve a variety of different roles:
- A delegated transaction signing server to pay for other users' transactions in permaweb apps.
- A simplified mechanism for sending transactions from programming languages that lack a native Arweave library (for example, bash).
- An alternative, simplified, mechanisms for submitting transactions and managing related queues, even for languages with Arweave libraries.

## Getting started

`hooverd` can be installed by simply running `npm install hooverd` on a machine with NodeJS installed.

You can start the daemon using:

`hooverd --wallet-file [PATH_TO_YOUR_WALLET]`

You can see the parameters and flags supported by `hooverd` by running:

`hooverd --help`

In order to run `hooverd` in the background, we recommend that you run it in a detached `screen` session:

`screen -dmS hooverd-screen bash -c 'hooverd --wallet-file [PATH_TO_YOUR_WALLET]'`

## Example usage

Here are a sample of simple ways to use `hooverd`.

### Proof of existence

Sometimes it is helpful to be able to prove that you had a file, at a certain point in time. This serves a similar function as a traditional notary.

You can use the below to notarise the existence (and your ownsership) of every file in a directory, after every write, using the following single line of bash:

`fswatch ~/Documents/ | while read file; do curl http://localhost:1908/raw -X POST -H "x-tag-file-hash: $(cat $file | md5sum | cut -d' ' -f1)" ; done`

### Automatically archive a webpage every X seconds

`watch -n 10 'curl [URL] | curl -X POST http://localhost:1908/raw -H "x-tag-content-type: text/html" -d @-'`