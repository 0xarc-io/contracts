import { MockProvider } from '@ethereum-waffle/provider';
import { BigNumber } from '@ethersproject/bignumber';
import { XSushiOracle__factory } from '@src/typings';
import { XSushiOracle } from '@src/typings/XSushiOracle';
import { expect } from 'chai';

xdescribe('XSushiOracle', () => {
  let xSushiOracle: XSushiOracle;

  before(async () => {
    const provider = new MockProvider({
      ganacheOptions: {
        fork: process.env.GANACHE_FORK_URL,
        fork_block_number: 12025602,
      },
    });
    const signer = await provider.getSigner();

    xSushiOracle = await new XSushiOracle__factory(signer).deploy();
  });

  it('should give the correct price', async () => {
    const price = await xSushiOracle.fetchCurrentPrice();
    // $21.34
    expect(price.value).to.eq(BigNumber.from('21340263899669790421'));
  });
});
