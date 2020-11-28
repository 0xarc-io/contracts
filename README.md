# ARCx Protocol Contracts

A synthetic asset protocol where you can use one or many collateral types to output a single synthetic token. For more information read here: https://docs.google.com/document/d/1bZsaxeCzUSdfrZdnRJj5NXeQ9lJqTbwxw1SXGM_BZvI/edit#.


## Architecture

The two core debt systems are known as Mozart and Spritz. Mozart is our latest debt system and introduces an interest rate & savings functionality (MozartSavings). A synthetic asset is defined by the Synthetic Token that it outputs. A Synthetic can have multiple addresses which are minters. A minter can be a Core system, Savings system or EOA. In Mozart's case, MozartV1.sol is the core system which represents all the state and data for a collateral type. Multiple core systems can be added to a Synthetic token which in effect creates a synth with multiple collaterals backing it.

We like to view the Core system as a single file which contains all the functionality needed to mint. This implementation is optimised around two key principles, simplicity and efficiency. Apart from an oracle source and collateral token, each core system has no outside dependencies.

## Warning

This is experimental, beta software and is provided on an "as is" and "as available" basis. We do not give any
warranties and will not be liable for any loss, direct or indirect through continued use of this code.

## Developers

Our contracts were written in Solidity and our tests in TypeScript.

If you want to contribute, familiarity with [Hardhat](https://github.com/nomiclabs/hardhat), [Ethers](https://github.com/ethers-io/ethers.js),
[Waffle](https://github.com/EthWorks/Waffle) and [TypeChain](https://github.com/ethereum-ts/TypeChain) is needed.

### Pre Requisites

Before running any command, make sure to install dependencies:

```sh
$ yarn install
```

### Build

Compile the smart contracts with Buidler and generate TypeChain artifacts:

```sh
$ yarn build
```

### Lint Solidity

Lint the Solidity code:

```sh
$ yarn lint:sol
```

### Test Unit

Run the unit tests:

```sh
$ yarn test
```

### Coverage

Generate the code coverage report:

```sh
$ yarn coverage
```

### Clean

Delete the smart contract artifacts, the coverage reports and the Buidler cache:

```sh
$ yarn clean
```

## Discussion

For any concerns or feedback, open an issue or visit us on [Discord](https://discord.gg/skwz6je) to discuss.
