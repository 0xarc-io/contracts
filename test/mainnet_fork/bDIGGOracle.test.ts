// import { BDIGGOracle, BDIGGOracleFactory } from '@src/typings';
// import { expect } from 'chai';
// import { ethers } from 'hardhat';

// describe('bDIGGOracle', () => {
//   let oracle: BDIGGOracle;

//   before(async () => {
//     const signer = await ethers.provider.getSigner();

//     oracle = await new BDIGGOracleFactory(signer).deploy({ gasLimit: 10000000 });
//     console.log(oracle.address);
//   });

//   it('should give the correct price', async () => {
//     const price = await oracle.fetchCurrentPrice();
//     console.log(price.value.toString());
//     expect(price).to.not.be.null;
//   });
// });
