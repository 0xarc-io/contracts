[![npm version](https://badge.fury.io/js/%40arcxgame%2Fcontracts.svg)](https://badge.fury.io/js/%40arcxgame%2Fcontracts)
[![arcxmoney](https://circleci.com/gh/arcxmoney/contracts.svg?style=svg&circle-token=9efd5821c24db49c53c74b3ebe7fe5db7bc1dfe2)](https://app.circleci.com/pipelines/github/arcxmoney/contracts)

# ARCx Contracts 

ARCx Credit is a decentralized liquidity market that offers the safest and most capital-efficient borrowing experience in DeFi through the use of the DeFi Credit Score. Unlike traditional borrowing protocols, ARCx Credit rewards Borrowers who demonstrate effective risk management practices by granting them progressively higher maximum loan-to-value (LTV) ratios on their loans. The primary objective for ARCx Credit is to profitably improve capital efficiency in DeFi lending markets through measuring and rewarding responsible borrowing behavior. [Click here to read the official docs.](https://wiki.arcx.money/welcome/arcx-credit-introduction)

## Architecture

![Contracts high-level arch](https://user-images.githubusercontent.com/5834876/182736613-a1498b60-3b64-4119-91e0-728ff0d22044.png)

At a very high level, the ARCx protocol is a credit market that has works in the following manner:

- Lenders lend their stablecoins to borrowers that meet some minimum credit score requirement, on the `SapphirePool` contract
- ARCx observes the borrowing behavior of on-chain addresses and issues a credit score for each of them. These scores are then compiled inside a merkle tree of which root is published on the `SapphirePassportScores` contract on a daily basis.
- Borrowers deposit their collateral inside a `SapphireCore` contract and take a loan while respecting their personal collateral ratio determined by their credit score.
- When they repay, part of the interest goes back to the lenders, and the other part goes to the protocol.



## Warning

This is experimental, beta software and is provided on an "as is" and "as available" basis. We do not give any warranties and will not be liable for any loss, direct or indirect through continued use of this code.



## Audits and Bug Bounties

**The contracts have not yet been audited, but one is on its way**.

We currently have an active bug bounty with Immunefi that can be viewed [here](https://immunefi.com/bounty/arcx/). If you have found any critical bug please let us know through the bug bounty program.



## Developers

Our contracts were written in Solidity and our tests in TypeScript.

If you want to contribute, familiarity with [Hardhat](https://github.com/nomiclabs/hardhat), [Ethers](https://github.com/ethers-io/ethers.js), [Waffle](https://github.com/EthWorks/Waffle) and [TypeChain](https://github.com/ethereum-ts/TypeChain) is needed.

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
test
