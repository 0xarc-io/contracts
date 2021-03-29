import { BigNumber, BigNumberish } from "ethers";

export enum Operation {
  Repay,
  Deposit,
  Borrow,
  Withdraw,
  Liquidate,
}

export type Position = {
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
  actionType: Operation,
  amount: BigNumberish,
}
