import { BigNumber, BigNumberish } from 'ethers';

export enum Operation {
  Deposit = 0,
  Withdraw = 1,
  Borrow = 2,
  Repay = 3,
  Liquidate = 4,
}

export type Vault = {
  collateralAmount: BigNumber;
  borrowedAmount: BigNumber;
  principal: BigNumber;
};

export type PassportScore = {
  account: string;
  protocol: string;
  score: BigNumber;
};

export interface PassportScoreProof {
  account: string;
  protocol: string;
  score: BigNumberish;
  merkleProof: string[];
}

export type Action = {
  operation: Operation;
  borrowedAssetAddress: string;
  amount: BigNumberish;
  userToLiquidate: string;
};
