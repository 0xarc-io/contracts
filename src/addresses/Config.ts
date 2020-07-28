import { BigNumberish } from 'ethers/utils';
import ArcDecimal from '../utils/ArcDecimal';
import ArcNumber from '../utils/ArcNumber';

export type Config = {
  owner: string;
  name: string;
  symbol: string;
  stableShare: string;
  oracle: string;
  interestModel: string;
  chainlinkAggregator: string;
  interestModelParams: PolynomialInterestSetterParams;
  collateralRatio: BigNumberish;
  syntheticRatio: BigNumberish;
  liquidationSpread: BigNumberish;
  earningsRate: BigNumberish;
  originationFee: BigNumberish;
  stableAssetLimit: BigNumberish;
  syntheticAssetLimit: BigNumberish;
};

export type PolynomialInterestSetterParams = {
  maxAPR: BigNumberish;
  coefficients: number[];
};

export const defaultPolynomialInterestSetterParams: PolynomialInterestSetterParams = {
  maxAPR: ArcDecimal.new(0.5).value,
  coefficients: [0, 10, 10, 0, 0, 80],
};

const NetworkConfig = {
  STABLE_SHARE: {
    1: '',
    4: '',
    50: '',
  },
  ORACLE: {
    1: '',
    4: '',
    50: '',
  },
  CHAIN_LINK_AGGREGATOR: {
    1: '',
    4: '0x5498BB86BC934c8D34FDA08E81D444153d0D06aD',
    50: '',
  },
  INTEREST_MODEL: {
    1: '',
    4: '',
    50: '',
  },
  INTEREST_MODEL_PARAMS: {
    1: defaultPolynomialInterestSetterParams,
    4: defaultPolynomialInterestSetterParams,
    50: defaultPolynomialInterestSetterParams,
  },
  COLLATERAL_RATIO: {
    1: ArcDecimal.new(2).value,
    4: ArcDecimal.new(2).value,
    50: ArcDecimal.new(2).value,
  },
  SYNTHETIC_RATIO: {
    1: ArcDecimal.new(2).value,
    4: ArcDecimal.new(2).value,
    50: ArcDecimal.new(2).value,
  },
  LIQUIDATION_SPREAD: {
    1: ArcDecimal.new(0.1).value,
    4: ArcDecimal.new(0.1).value,
    50: ArcDecimal.new(0.1).value,
  },
  EARNINGS_RATE: {
    1: ArcDecimal.new(1).value,
    4: ArcDecimal.new(1).value,
    50: ArcDecimal.new(1).value,
  },
  ORIGINATION_FEE: {
    1: ArcDecimal.new(0).value,
    4: ArcDecimal.new(0).value,
    50: ArcDecimal.new(0).value,
  },
  STABLE_ASSET_LIMIT: {
    1: ArcNumber.new(1000),
    4: ArcNumber.new(10000000),
    50: ArcNumber.new(10000000),
  },
  SYNTHETIC_ASSET_LIMIT: {
    1: ArcNumber.new(1),
    4: ArcNumber.new(1000),
    50: ArcNumber.new(1000),
  },
};

export function getConfig(network: number): Config {
  return {
    stableShare: NetworkConfig.STABLE_SHARE[network],
    oracle: NetworkConfig.ORACLE[network],
    interestModel: NetworkConfig.INTEREST_MODEL[network],
    interestModelParams: NetworkConfig.INTEREST_MODEL_PARAMS[network],
    collateralRatio: NetworkConfig.COLLATERAL_RATIO[network],
    syntheticRatio: NetworkConfig.SYNTHETIC_RATIO[network],
    liquidationSpread: NetworkConfig.LIQUIDATION_SPREAD[network],
    originationFee: NetworkConfig.ORIGINATION_FEE[network],
    earningsRate: NetworkConfig.EARNINGS_RATE[network],
    chainlinkAggregator: NetworkConfig.CHAIN_LINK_AGGREGATOR[network],
    stableAssetLimit: NetworkConfig.STABLE_ASSET_LIMIT[network],
    syntheticAssetLimit: NetworkConfig.SYNTHETIC_ASSET_LIMIT[network],
  } as Config;
}
