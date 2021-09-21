import { MockProvider } from '@ethereum-waffle/provider';
import { BigNumber } from '@ethersproject/bignumber';
import { BDIGGOracle, BDIGGOracle__factory } from '@src/typings';
import { expect } from 'chai';

xdescribe('bDIGGOracle', () => {
  let oracle: BDIGGOracle;

  before(async () => {
    const provider = new MockProvider({
      ganacheOptions: {
        fork: process.env.GANACHE_FORK_URL,
        fork_block_number: 12025602,
      },
    });
    const signer = await provider.getSigner();

    oracle = await new BDIGGOracle__factory(signer).deploy();
  });

  it('should give the correct price', async () => {
    const price = await oracle.fetchCurrentPrice();

    /**
     * At block 12025602, 1 DIGG is around $36,317.83 and 1 bDIGG is 1.312433484 DIGG
     */

    expect(price.value).to.eq(BigNumber.from('47691502133589393937213'));
  });
});
