import { MockProvider } from '@ethereum-waffle/provider';
import { BigNumber } from '@ethersproject/bignumber';
import { XSushiOracle } from '@src/typings/XSushiOracle';
import { XSushiOracleFactory } from '@src/typings/XSushiOracleFactory';
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

    xSushiOracle = await new XSushiOracleFactory(signer).deploy();
  });

  it('should give the correct price', async () => {
    const price = await xSushiOracle.fetchCurrentPrice();
    // $21.34
    expect(price.value).to.eq(BigNumber.from('21340263899669790421'));
  });
});