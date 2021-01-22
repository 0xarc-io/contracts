import { expect } from 'chai';
import { ethers } from 'hardhat';

xdescribe('imUSDOracle', () => {
  let oracle: imUSDOracle;

  before(async () => {
    const signer = await ethers.provider.getSigner();

    oracle = await new imUSDOracleFactory(signer).deploy({ gasLimit: 10000000 });
    console.log('oracle address:', oracle.address);
  });

  it('should give the correct price', async () => {
    const price = await oracle.fetchCurrentPrice();
    console.log('price:', price.value.toString());
    expect(price).to.not.be.null;
  });
});
