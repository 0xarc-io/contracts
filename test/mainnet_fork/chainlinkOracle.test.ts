import { MockProvider } from '@ethereum-waffle/provider';
import { BigNumber } from '@ethersproject/bignumber';
import { ChainLinkOracle, ChainLinkOracleFactory } from '@src/typings';
import { expect } from 'chai';

xdescribe('chainlinkOracle', () => {
  let oracle: ChainLinkOracle;
  const ethUsdFeed = '0xf9680d99d6c9589e2a93a78a04a279e509205945';

  before(async () => {
    const provider = new MockProvider({
      ganacheOptions: {
        fork: process.env.POLYGON_ALCHEMY,
        fork_block_number: 27149105,
      },
    });

    const signer = await provider.getSigner();

    oracle = await new ChainLinkOracleFactory(signer).deploy(ethUsdFeed);
  });

  it('should give the correct price', async () => {
    const price = await oracle.fetchCurrentPrice();

    expect(price[0]).to.eq(BigNumber.from('3023177475220000000000'));
  });
});
