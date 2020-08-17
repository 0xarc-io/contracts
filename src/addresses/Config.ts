import { BigNumberish } from 'ethers/utils';
import ArcDecimal from '../utils/ArcDecimal';
import ArcNumber from '../utils/ArcNumber';

export type Config = {
  owner: string;
  name: string;
  symbol: string;
  collateralAsset: string;
  oracle: string;
  chainlinkAggregator: string;
  collateralRatio: BigNumberish;
  liquidationUserFee: BigNumberish;
  liquidationArcFee: BigNumberish;
  interestRate: BigNumberish;
  collateralLimit: BigNumberish;
  syntheticAssetLimit: BigNumberish;
  positionCollateralMinimum: BigNumberish;
};

const NetworkConfig = {
  COLLATERAL_ASSET: {
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
    4: '0x0853E36EeAd0eAA08D61E94237168696383869DD',
    50: '',
  },
  COLLATERAL_RATIO: {
    1: ArcDecimal.new(2).value,
    4: ArcDecimal.new(2).value,
    50: ArcDecimal.new(2).value,
  },
  LIQUIDATION_USER_FEE: {
    1: ArcDecimal.new(0.1).value,
    4: ArcDecimal.new(0.1).value,
    50: ArcDecimal.new(0.1).value,
  },
  LIQUIDATION_ARC_FEE: {
    1: ArcDecimal.new(0.1).value,
    4: ArcDecimal.new(0.1).value,
    50: ArcDecimal.new(0.1).value,
  },
  INTEREST_RATE: {
    1: ArcDecimal.new(0).value,
    4: ArcDecimal.new(0).value,
    50: ArcDecimal.new(0).value,
  },
  COLLATERAL_LIMIT: {
    1: ArcNumber.new(1000),
    4: ArcNumber.new(10000000),
    50: 0,
  },
  SYNTHETIC_ASSET_LIMIT: {
    1: ArcNumber.new(1),
    4: ArcNumber.new(1000),
    50: 0,
  },
  POSITION_COLLATERAL_MINIMUM: {
    1: ArcNumber.new(1),
    4: ArcNumber.new(1),
    50: 0,
  },
};

export function getConfig(network: number): Config {
  return {
    collateralAsset: NetworkConfig.COLLATERAL_ASSET[network],
    oracle: NetworkConfig.ORACLE[network],
    collateralRatio: NetworkConfig.COLLATERAL_RATIO[network],
    liquidationUserFee: NetworkConfig.LIQUIDATION_USER_FEE[network],
    liquidationArcFee: NetworkConfig.LIQUIDATION_ARC_FEE[network],
    interestRate: NetworkConfig.INTEREST_RATE[network],
    chainlinkAggregator: NetworkConfig.CHAIN_LINK_AGGREGATOR[network],
    collateralLimit: NetworkConfig.COLLATERAL_LIMIT[network],
    syntheticAssetLimit: NetworkConfig.SYNTHETIC_ASSET_LIMIT[network],
    positionCollateralMinimum: NetworkConfig.POSITION_COLLATERAL_MINIMUM[network],
  } as Config;
}
