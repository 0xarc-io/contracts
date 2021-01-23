import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ChainLinkOracleFactory } from '@src/typings';

export default {
  LINKUSD: {
    collateral_address: '',
    oracle_link_aggregator_address: '',
    synthetic_address: '',
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
    collateral_address: '',
    oracle: {
      source: 'ChainLinkOracle',
      getDeployTx: (signer: SignerWithAddress) =>
        new ChainLinkOracleFactory(signer).getDeployTransaction(
          '0x8A753747A1Fa494EC906cE90E9f37563A8AF630e',
        ),
    },
    version: 1,
    params: {
      decimals: 18,
      collateral_ratio: '2000000000000000000',
      liquidation_user_fee: '50000000000000000',
      liquidation_arc_ratio: '50000000000000000',
      collateral_limit: '',
      synthetic_limit: '',
      position_minimum_collateral: '',
      interest_rate: '',
    },
  },
  'yUSD-STABLEx': {
    collateral_address: '',
    oracle: {
      source: 'YUSDOracle',
      getDeployTx: null,
    },
    version: '1',
    params: {
      decimals: 18,
      collateral_ratio: '1100000000000000000',
      liquidation_user_fee: '50000000000000000',
      liquidation_arc_ratio: '50000000000000000',
      collateral_limit: '',
      synthetic_limit: '',
      position_minimum_collateral: '',
    },
  },
};
