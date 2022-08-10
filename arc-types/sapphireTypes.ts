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
  normalizedBorrowedAmount: BigNumber;
  principal: BigNumber;
};

export type PassportScore = {
  account: string;
  protocol: string;
  score: BigNumberish;
};

export interface PassportScoreProof extends PassportScore {
  merkleProof: string[];
}

export type Action = {
  operation: Operation;
  borrowAssetAddress: string;
  amount: BigNumberish;
  userToLiquidate: string;
};
