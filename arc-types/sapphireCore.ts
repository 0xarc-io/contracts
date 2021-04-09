import { BigNumber, BigNumberish } from 'ethers';

export enum Operation {
  Repay = 0,
  Deposit = 1,
  Borrow = 2,
  Withdraw = 3,
  Liquidate = 4,
}

export type Vault = {
  collateralAmount: BigNumber;
  borrowedAmount: BigNumber;
};

export type CreditScore = {
  account: string;
  amount: BigNumber;
};

export interface CreditScoreProof {
  account: string;
  score: BigNumberish;
  merkleProof: string[];
}

export type Action = {
  operation: Operation;
  amount: BigNumberish;
};
