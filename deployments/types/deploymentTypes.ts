import { BigNumberish, Signer } from 'ethers';
import { TransactionRequest } from '@ethersproject/providers';

export interface DeployContractParams {
  name: string;
  source: string;
  data: TransactionRequest;
  version: number;
  type: DeploymentCategory;
  group?: string;
}

export interface NetworkParams {
  signer: Signer;
  network: string;
  gasPrice?: string;
  gasLimit?: string;
}

export enum DeploymentCategory {
  borrowing = 'borrowing',
  staking = 'staking',
  global = 'global',
}

export interface WriteToDeploymentsParams {
  name: string;
  source: string;
  address: string;
  txn: string;
  network: string;
  version: number;
  type: DeploymentCategory;
  group?: string;
}

export interface CollateralConfig {
  [collateralName: string]: {
    collateralAddress: string;
    borrowPool: string;
    oracle: {
      source: string;
      getDeployTx: (signer: Signer) => TransactionRequest;
    };
    borrowRatios: {
      highCRatio: BigNumberish;
      lowCRatio: BigNumberish;
    };
    fees: {
      liquidatorDiscount: BigNumberish;
      poolInterestFee: BigNumberish;
      liquidationArcFee?: BigNumberish;
      borrowFee?: BigNumberish;
    };
    limits: {
      vaultBorrowMax: BigNumberish;
      vaultBorrowMin?: BigNumberish;
      defaultBorrowLimit?: BigNumberish;
    };
    interestSettings?: {
      interestRate?: BigNumberish;
      interestSetter?: string;
    };
    pauseOperator?: string;
    feeCollector?: string;
  };
}
