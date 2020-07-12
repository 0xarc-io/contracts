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

export type OperationParams = {
  id: BigNumberish;
  assetOne: BigNumberish;
  amountOne: BigNumberish;
  assetTwo: BigNumberish;
  amountTwo: BigNumberish;
};
