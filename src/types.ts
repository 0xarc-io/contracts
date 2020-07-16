import { BigNumberish } from 'ethers/utils';
export enum AssetType {
  Stable,
  Synthetic,
}

export enum Operation {
  Supply,
  Withdraw,
  Open,
  Borrow,
  Deposit,
  Liquidate,
}

export type Position = {
  collateralAsset: AssetType;
  collateralAmount: BigNumberish;
  borrowedAsset: AssetType;
  borrowedAmount: AssetType;
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
