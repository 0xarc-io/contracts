import { MockProvider } from '@ethereum-waffle/provider';
import { ImUSDOracle, ImUSDOracleFactory } from '@src/typings';
import { expect } from 'chai';

describe('imUSDOracle', () => {
  let oracle: ImUSDOracle;

  before(async () => {
    const provider = new MockProvider({
      ganacheOptions: {
        fork: 'https://eth-mainnet.alchemyapi.io/v2/HSgFSArdYblhAJVgM8F820KLd65jiFzc',
        fork_block_number: 12025602,
      },
    });
    const signer = await provider.getSigner();

    oracle = await new ImUSDOracleFactory(signer).deploy();
  });

  it('should give the correct price', async () => {
    const price = await oracle.fetchCurrentPrice();
    // $0.1
    expect(price.value).to.eq('104201492729410660');
  });
});
