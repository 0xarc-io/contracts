import { BigNumberish } from 'ethers/utils';

export enum AssetType {
  Stable,
  Synthetic,
}

export type Decimal = {
  value: BigNumberish;
};

export enum Operation {
  Supply,
  Withdraw,
  Open,
  Borrow,
  Repay,
  Liquidate,
}

export type Par = {
  sign: boolean;
  value: BigNumberish;
};

export type Position = {
  owner: string;
  collateralAsset: AssetType;
  borrowedAsset: AssetType;
  collateralAmount: Par;
  borrowedAmount: Par;
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

export type Index = {
  borrow: BigNumberish;
  supply: BigNumberish;
  lastUpdate: BigNumberish;
};

export type GlobalParams = {
  stableAsset: string;
  syntheticAsset: string;
  interestSetter: string;
  collateralRatio: Decimal;
  syntheticRatio: Decimal;
  liquidationSpread: Decimal;
  originationFee: Decimal;
  earningsRate: Decimal;
  oracle: string;
};

export type TotalPar = {
  supply: BigNumberish;
  borrow: BigNumberish;
};
