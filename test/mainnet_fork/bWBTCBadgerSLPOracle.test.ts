import { MockProvider } from '@ethereum-waffle/provider';
import { BigNumber } from '@ethersproject/bignumber';
import { BWBTCBadgerSLPOracle, BWBTCBadgerSLPOracleFactory } from '@src/typings';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe.only('BWBTCBadgerSLPOracle', () => {
  let oracle: BWBTCBadgerSLPOracle;

  before(async () => {
    const provider = new MockProvider({
      ganacheOptions: {
        fork: process.env.GANACHE_FORK_URL,
        fork_block_number: 12115818,
      },
    });
    // const provider = await ethers.provider;
    const signer = await provider.getSigner();

    oracle = await new BWBTCBadgerSLPOracleFactory(signer).deploy();
  });

  it('should give the correct price', async () => {
    const price = await oracle.fetchCurrentPrice();

    // For an example of calculations, see
    // https://docs.google.com/spreadsheets/d/19nDdvolghFO1Q9t5fUdukfF9qlhA0VeylCuGkFo9Haw/edit#gid=0

    expect(price.value).to.eq(BigNumber.from('381473966884915972882352318'));
  });
});
