import { MockProvider } from '@ethereum-waffle/provider';
import { BigNumber } from '@ethersproject/bignumber';
import { IbETHOracle } from '@src/typings/IbETHOracle';
import { IbETHOracleFactory } from '@src/typings/IbETHOracleFactory';
import { expect } from 'chai';

xdescribe('ibETHOracle', () => {
  let oracle: IbETHOracle;

  before(async () => {
    const provider = new MockProvider({
      ganacheOptions: {
        fork: process.env.GANACHE_FORK_URL,
        fork_block_number: 12025602,
      },
    });
    const signer = await provider.getSigner();

    oracle = await new IbETHOracleFactory(signer).deploy();
  });

  it('should give the correct price', async () => {
    const price = await oracle.fetchCurrentPrice();
    // $1841.27
    expect(price.value).to.eq(BigNumber.from('1841274068383565629474'));
  });
});
