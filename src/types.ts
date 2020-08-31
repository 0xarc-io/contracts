import { BigNumberish } from 'ethers/utils';
import { Signer } from 'ethers';

export type SynthAddressBook = {
  stateV1?: string;
  proxy?: string;
  coreV1?: string;
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
}

export type Int = {
  sign: boolean;
  value: BigNumberish;
};

export type Position = {
  owner: string;
  collateralAsset: AssetType;
  borrowedAsset: AssetType;
  collateralAmount: Int;
  borrowedAmount: Int;
};

export type OperationParams = {
  id: BigNumberish;
  assetOne: BigNumberish;
  amountOne: BigNumberish;
  assetTwo: BigNumberish;
  amountTwo: BigNumberish;
};

export type ActionOperated = {
  operation: Operation;
  params: OperationParams;
  updatedPosition: Position;
};

export type GraphPosition = {
  id: BigNumberish;
  owner: string;
  collateralAsset: AssetType;
  borrowedAsset: AssetType;
  collateralAmountSign: Boolean;
  collateralAmountValue: BigNumberish;
  borrowedAmountSign: Boolean;
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

export interface TransactionOverrides {
  nonce?: BigNumberish | Promise<BigNumberish>;
  gasLimit?: BigNumberish | Promise<BigNumberish>;
  gasPrice?: BigNumberish | Promise<BigNumberish>;
  value?: BigNumberish | Promise<BigNumberish>;
  chainId?: number | Promise<number>;
  from?: Signer;
}
