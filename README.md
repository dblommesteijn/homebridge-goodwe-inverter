# Homebridge GoodWe Inverter

This homebridge plugin consumes the local broadcasted status by GoodWe Inverters on port 8899 (UDP).

## Setup Development Environment

To develop Homebridge plugins you must have Node.js 12 or later installed, and a modern code editor such as [VS Code](https://code.visualstudio.com/). This plugin template uses [TypeScript](https://www.typescriptlang.org/) to make development easier and comes with pre-configured settings for [VS Code](https://code.visualstudio.com/) and ESLint. If you are using VS Code install these extensions:
* [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

## Install Development Dependencies and Run Locally

You need to install the Swiss File Knife: http://stahlworks.com/dev/swiss-file-knife.html. For Mac it's available via Homebrew: https://formulae.brew.sh/formula/sfk

```
brew install sfk
```

_NOTE: For other platforms, like Raspberry PI, I recomend downloading the binary from Stahlworks' website._

## Troubleshooting

You'll need to make sure SFK is configured and working with your setup.
When the plugin is not responding the appropriate responses, please first try to run the following command:

```bash
sfk cudp <inverter_ip> 8899 -listen -noerror -timeout=5000 0x7f0375940049d5c2 -pure +xed "/[eol]//"
```

## Installing NPM and dependencies for local-dev

Using a terminal, navigate to the project folder and run this command to install the development dependencies:

```
npm install
```

TypeScript needs to be compiled into JavaScript before it can run. The following command will compile the contents of your [`src`](./src) directory and put the resulting code into the `dist` folder.

```
npm run build
```

Run this command so your global install of Homebridge can discover the plugin in your development environment:

```
npm link
```

You can now start Homebridge, use the `-D` flag so you can see debug log messages in your plugin:

```
homebridge -D
```

At this point the plugin should show up in your local Homebridge setup.
