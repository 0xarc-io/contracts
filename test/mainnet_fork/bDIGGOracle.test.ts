import { MockProvider } from '@ethereum-waffle/provider';
import { BigNumber } from '@ethersproject/bignumber';
import { BDIGGOracle, BDIGGOracleFactory } from '@src/typings';
import { expect } from 'chai';

describe('bDIGGOracle', () => {
  let oracle: BDIGGOracle;

  before(async () => {
    const provider = new MockProvider({
      ganacheOptions: {
        fork: 'https://eth-mainnet.alchemyapi.io/v2/HSgFSArdYblhAJVgM8F820KLd65jiFzc',
        fork_block_number: 12025602,
      },
    });
    const signer = await provider.getSigner();

    oracle = await new BDIGGOracleFactory(signer).deploy();
  });

  it('should give the correct price', async () => {
    const price = await oracle.fetchCurrentPrice();

    /**
     * At block 12025602, 1 DIGG is around $36,317.83 and 1 bDIGG is 1.312433484 DIGG
     */

    expect(price.value).to.eq(BigNumber.from('47691502133589393937213'));
  });
});
