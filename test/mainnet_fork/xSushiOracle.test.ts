// import { XSushiOracle } from '@src/typings/XSushiOracle';
// import { XSushiOracleFactory } from '@src/typings/XSushiOracleFactory';
// import { expect } from 'chai';
// import { ethers } from 'hardhat';

// /* eslint-disable @typescript-eslint/no-var-requires */
// const hre = require('hardhat');

// describe('XSushiOracle', () => {
//   let xSushiOracle: XSushiOracle;

//   before(async () => {
//     const signer = await ethers.provider.getSigner();

//     xSushiOracle = await new XSushiOracleFactory(signer).deploy({ gasLimit: 10000000 });
//     console.log(xSushiOracle.address);
//   });

//   it('should give the correct price', async () => {
//     const price = await xSushiOracle.fetchCurrentPrice();
//     console.log(price.value.toString());
//     expect(price).to.not.be.null;
//   });
// });
