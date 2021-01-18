// import { IbETHOracle } from '@src/typings/IbETHOracle';
// import { IbETHOracleFactory } from '@src/typings/IbETHOracleFactory';
// import { XSushiOracle } from '@src/typings/XSushiOracle';
// import { XSushiOracleFactory } from '@src/typings/XSushiOracleFactory';
// import { expect } from 'chai';
// import { ethers } from 'hardhat';

// /* eslint-disable @typescript-eslint/no-var-requires */
// const hre = require('hardhat');

// describe('ibETHOracle', () => {
//   let oracle: IbETHOracle;

//   before(async () => {
//     const signer = await ethers.provider.getSigner();

//     oracle = await new IbETHOracleFactory(signer).deploy({ gasLimit: 10000000 });
//     console.log(oracle.address);
//   });

//   it('should give the correct price', async () => {
//     const price = await oracle.fetchCurrentPrice();
//     console.log(price.value.toString());
//     expect(price).to.not.be.null;
//   });
// });
