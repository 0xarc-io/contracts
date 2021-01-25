import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ChainLinkOracleFactory,
  CTokenOracleFactory,
  IbETHOracleFactory,
  XSushiOracleFactory,
  YUSDOracleFactory,
} from '@src/typings';

export default {
  LINKUSD: {
    collateral_address: '0x514910771af9ca656af840dff83e8264ecf986ca',
    oracle_link_aggregator_address: '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c',
    synthetic_address: '0x0e2ec54fc0b509f445631bf4b91ab8168230c752',
    version: 1,
    params: {
      collateral_ratio: '2000000000000000000',
      liquidation_user_fee: '50000000000000000',
      liquidation_arc_fee: '50000000000000000',
      collateral_limit: '',
      synthetic_limit: '',
      position_minimum_collateral: '',
    },
  },
  ETHX: {
    collateral_address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    oracle: {
      source: 'ChainLinkOracle',
      getDeployTx: (signer: SignerWithAddress) =>
        new ChainLinkOracleFactory(signer).getDeployTransaction(
          '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
        ),
    },
    synthetic_address: '',
    version: 1,
    params: {
      collateral_ratio: '2000000000000000000',
      liquidation_user_fee: '100000000000000000',
      liquidation_arc_ratio: '100000000000000000',
      collateral_limit: '',
      synthetic_limit: '300000000000000000000000',
      position_minimum_collateral: '',
      interest_rate: '',
    },
  },
  'yUSD-STABLEx': {
    collateral_address: '0x5dbcf33d8c2e976c6b560249878e6f1491bca25c',
    oracle: {
      source: 'YUSDOracle',
      getDeployTx: (signer: SignerWithAddress) =>
        new YUSDOracleFactory(signer).getDeployTransaction(),
    },
    version: '1',
    params: {
      collateral_ratio: '2000000000000000000',
      liquidation_user_fee: '20000000000000000',
      liquidation_arc_ratio: '200000000000000000',
      collateral_limit: '',
      synthetic_limit: '1000000000000000000000000',
      position_minimum_collateral: '',
      interest_rate: '',
    },
  },
  'cUSDC-STABLEx': {
    collateral_address: '0x39aa39c021dfbae8fac545936693ac917d5e7563',
    oracle: {
      source: 'CTokenOracle',
      getDeployTx: (signer: SignerWithAddress) =>
        new CTokenOracleFactory(signer).getDeployTransaction(
          '0x39aa39c021dfbae8fac545936693ac917d5e7563',
          '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
          '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
        ),
    },
    oracle_source: 'CTokenOracle',
    oracle_token_aggregator_address: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
    oracle_eth_aggregator_address: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    version: 1,
    params: {
      collateral_ratio: '2000000000000000000',
      liquidation_user_fee: '20000000000000000',
      liquidation_arc_ratio: '200000000000000000',
      collateral_limit: '',
      synthetic_limit: '',
      position_minimum_collateral: '',
    },
  },
  'ibETH-STABLEx': {
    collateral_address: '0x67B66C99D3Eb37Fa76Aa3Ed1ff33E8e39F0b9c7A',
    oracle: {
      source: 'ibETHOracle',
      getDeployTx: (signer: SignerWithAddress) =>
        new IbETHOracleFactory(signer).getDeployTransaction(),
    },
    version: 1,
    params: {
      collateral_ratio: '2000000000000000000',
      liquidation_user_fee: '150000000000000000',
      liquidation_arc_ratio: '100000000000000000',
      collateral_limit: '',
      synthetic_limit: '',
      position_minimum_collateral: '',
    },
  },
  'xSUSHI-STABLEx': {
    collateral_address: '0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272',
    oracle: {
      source: 'xSushiOracle',
      getDeployTx: (signer: SignerWithAddress) =>
        new XSushiOracleFactory(signer).getDeployTransaction(),
    },
    version: 1,
    params: {
      collateral_ratio: '2000000000000000000',
      liquidation_user_fee: '150000000000000000',
      liquidation_arc_ratio: '100000000000000000',
      collateral_limit: '',
      synthetic_limit: '',
      position_minimum_collateral: '',
    },
  },
};
