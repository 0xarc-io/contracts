import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ChainLinkOracleFactory, CTokenOracleFactory } from '@src/typings';
import { utils } from 'ethers';

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
    synthetic_address: '',
    version: 1,
    params: {
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
      collateral_ratio: '1100000000000000000',
      liquidation_user_fee: '50000000000000000',
      liquidation_arc_ratio: '50000000000000000',
      collateral_limit: '',
      synthetic_limit: '',
      position_minimum_collateral: '',
    },
  },
  'cUSDC-ARCUSD': {
    collateral_address: '0x5b281a6dda0b271e91ae35de655ad301c976edb1',
    oracle: {
      source: 'CTokenOracle',
      getDeployTx: (signer: SignerWithAddress) =>
        new CTokenOracleFactory(signer).getDeployTransaction(
          '0x5b281a6dda0b271e91ae35de655ad301c976edb1',
          '0xdCA36F27cbC4E38aE16C4E9f99D39b42337F6dcf',
          '0x8A753747A1Fa494EC906cE90E9f37563A8AF630e',
        ),
      constructorArguments: [
        '0x5b281a6dda0b271e91ae35de655ad301c976edb1',
        '0xdCA36F27cbC4E38aE16C4E9f99D39b42337F6dcf',
        '0x8A753747A1Fa494EC906cE90E9f37563A8AF630e',
      ],
    },
    version: 1,
    params: {
      // interestSetter: '0xaddress'
      // pauseOperator: '0xaddress'
      // feeCollector: '0xaddress'
      highCRatio: utils.parseEther('2'),
      lowCRatio: utils.parseEther('1'),
      liquidationUserFee: utils.parseEther('0.05'),
      liquidationArcFee: utils.parseEther('0.05'),
    },
    limits: {
      totalBorrowLimit: 0,
      vaultBorrowMin: 0,
      vaultBorrowMax: 0,
    },
  },
};
