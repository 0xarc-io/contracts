import { MockProvider } from '@ethereum-waffle/provider';
import { BigNumber } from '@ethersproject/bignumber';
import { BBadgerOracle, BBadgerOracleFactory } from '@src/typings';
import { expect } from 'chai';

describe('bBadgerOracle', () => {
  let oracle: BBadgerOracle;

  before(async () => {
    const provider = new MockProvider({
      ganacheOptions: {
        fork: 'https://eth-mainnet.alchemyapi.io/v2/HSgFSArdYblhAJVgM8F820KLd65jiFzc',
        fork_block_number: 12025602,
      },
    });

    const signer = await provider.getSigner();

    oracle = await new BBadgerOracleFactory(signer).deploy();
  });

  it('should give the correct price', async () => {
    const price = await oracle.fetchCurrentPrice();

    /**
     * At block 12025602, 1 bBADGER is 1.22 BADGER, and 1 BADGER is $45.31
     */

    expect(price.value).to.eq(BigNumber.from('54429306291136836649'));
  });
});
