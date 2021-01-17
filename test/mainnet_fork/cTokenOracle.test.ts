import { CTokenOracle, CTokenOracleFactory } from '@src/typings';
import { expect } from 'chai';
import { ethers } from 'hardhat';

/* eslint-disable @typescript-eslint/no-var-requires */
const hre = require('hardhat');

// describe('CTokenOracle', () => {
//   let cUSDCOracle: CTokenOracle;

//   before(async () => {
//     const signer = await ethers.provider.getSigner();

//     cUSDCOracle = await new CTokenOracleFactory(
//       signer,
//     ).deploy(
//       '0x39aa39c021dfbae8fac545936693ac917d5e7563',
//       '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
//       '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
//       { gasLimit: 10000000 },
//     );

//     console.log(cUSDCOracle.address);
//   });

//   it('should give the correct price', async () => {
//     const price = await cUSDCOracle.fetchCurrentPrice();
//     expect(price).to.not.be.null;
//   });
// });
