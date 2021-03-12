import { MockProvider } from '@ethereum-waffle/provider';
import { BigNumber } from '@ethersproject/bignumber';
import { CTokenOracle, CTokenOracleFactory } from '@src/typings';
import { expect } from 'chai';

describe('CTokenOracle', () => {
  let cUSDCOracle: CTokenOracle;

  before(async () => {
    const provider = new MockProvider({
      ganacheOptions: {
        fork: 'https://eth-mainnet.alchemyapi.io/v2/HSgFSArdYblhAJVgM8F820KLd65jiFzc',
        fork_block_number: 12025602,
      },
    });

    const signer = await provider.getSigner();

    cUSDCOracle = await new CTokenOracleFactory(signer).deploy(
      '0x39aa39c021dfbae8fac545936693ac917d5e7563',
      '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    );
  });

  it('should give the correct price', async () => {
    const price = await cUSDCOracle.fetchCurrentPrice();

    // $0.02
    expect(price.value).to.eq(BigNumber.from('21636282431622223'));
  });
});
