import { MockProvider } from '@ethereum-waffle/provider';
import { BigNumber } from '@ethersproject/bignumber';
import { ChainLinkOracle, ChainLinkOracleFactory } from '@src/typings';
import { expect } from 'chai';

const WETH_PRICE_FEED = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';

describe('ChainLinkOracle', () => {
  let oracle: ChainLinkOracle;

  before(async () => {
    const provider = new MockProvider({
      ganacheOptions: {
        fork: process.env.GANACHE_FORK_URL,
        fork_block_number: 12642493,
      },
    });
    const signer = await provider.getSigner();

    oracle = await new ChainLinkOracleFactory(signer).deploy(WETH_PRICE_FEED);
  });

  it('should give the correct price', async () => {
    const price = await oracle.fetchCurrentPrice();
    // $1724.70
    expect(price[0]).to.eq(BigNumber.from('252550029879'));
  });
});
