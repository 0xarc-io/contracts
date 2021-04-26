import { BigNumber, BigNumberish } from 'ethers';
import { SyntheticTokenV1, SyntheticTokenV2 } from '@src/typings';
import { IERC20 } from '@src/typings/IERC20';
import { IOracle } from '@src/typings/IOracle';

export type SynthAddressBook = {
  state?: string;
  proxy?: string;
  core?: string;
  syntheticToken?: string;
  oracle?: string;
  collateralAsset?: string;
};

export type DeploymentConfig = {
  owner: string;
  name: string;
  symbol: string;
  collateralAsset: string;
  oracle: string;
  chainlinkAggregator: string;
  collateralRatio: BigNumberish;
  liquidationUserFee: BigNumberish;
  liquidationArcFee: BigNumberish;
  collateralLimit: BigNumberish;
  syntheticAssetLimit: BigNumberish;
  positionCollateralMinimum: BigNumberish;
};

export type AddressBook = {
  arcToken?: string;
  kyf?: string;
  synthRegistry?: string;
};

export enum AssetType {
  Collateral,
  Synthetic,
}

export type Decimal = {
  value: BigNumberish;
};

export enum Operation {
  Open,
  Borrow,
  Repay,
  Liquidate,
  TransferOwnership,
}

export type Int = {
  sign: boolean;
  value: BigNumberish;
};

export type Position = {
  owner: string;
  collateralAmount: Int;
  borrowedAmount: Int;
};

export type OperationParams = {
  id: BigNumberish;
  amountOne: BigNumberish;
  amountTwo: BigNumberish;
  addressOne?: string;
};

export type ActionOperated = {
  operation: Operation;
  params: OperationParams;
  updatedPosition: Position;
};

export type GraphPosition = {
  id: string;
  owner: string;
  synth: string;
  collateralAmountSign: boolean;
  collateralAmountValue: BigNumberish;
  borrowedAmountSign: boolean;
  borrowedAmountValue: BigNumberish;
};

export type MarketParams = {
  collateralRatio: Decimal;
  liquidationUserFee: Decimal;
  liquidationArcFee: Decimal;
};

export type RiskParams = {
  collateralLimit: BigNumberish;
  syntheticLimit: BigNumberish;
  positionCollateralMinimum: BigNumberish;
};

export type D2Fees = {
  liquidationUserFee: BigNumberish;
  liquidationArcRatio: BigNumberish;
};

export type SynthV1<T> = {
  core: T;
  oracle: IOracle;
  collateral: IERC20;
  synthetic: SyntheticTokenV1;
};

export type Synth<T> = {
  core: T;
  oracle: IOracle;
  collateral: IERC20;
  synthetic: SyntheticTokenV2;
};
