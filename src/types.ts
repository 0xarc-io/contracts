import { BigNumberish } from 'ethers/utils';
import { Signer } from 'ethers';

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
  isPositive: boolean;
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

export type GlobalParams = {
  collateralAsset: string;
  syntheticAsset: string;
  collateralRatio: Decimal;
  syntheticRatio: Decimal;
  liquidationSpread: Decimal;
  originationFee: Decimal;
  earningsRate: Decimal;
  oracle: string;
};

export interface TransactionOverrides {
  nonce?: BigNumberish | Promise<BigNumberish>;
  gasLimit?: BigNumberish | Promise<BigNumberish>;
  gasPrice?: BigNumberish | Promise<BigNumberish>;
  value?: BigNumberish | Promise<BigNumberish>;
  chainId?: number | Promise<number>;
  from?: Signer;
}
