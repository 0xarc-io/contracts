import { BigNumberish, Signer } from 'ethers';
import { TransactionRequest } from '@ethersproject/providers';

interface BaseDeploymentParams {
  name: string;
  source: string;
  version: number;
  type: DeploymentCategory;
  group?: string;
}

export interface DeployContractParams extends BaseDeploymentParams {
  data: TransactionRequest;
}

export interface WriteToDeploymentsParams extends BaseDeploymentParams {
  address: string;
  txn: string;
  network: string;
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

export interface CollateralConfig {
  collateralAddress: string;
  borrowPool: string;
  mintLimit: BigNumberish;
  oracle: {
    source: string;
    getDeployTx: (signer: Signer) => TransactionRequest;
    constructorArguments: unknown[];
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
}

export interface CollateralConfigMap {
  [collateralName: string]: CollateralConfig;
}
