import { BigNumber, BigNumberish } from "ethers";

export type ActionOperated = {
  operation: Operation;
  params: OperationParams;
  updatedPosition: Position;
};

export enum Operation {
  Borrow,
  Repay,
  Liquidate,
}

export type OperationParams = {
  owner: string;
  collateralAmount: BigNumberish;
  borrowedAmount: BigNumberish;
};

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
