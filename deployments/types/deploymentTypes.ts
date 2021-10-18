import { Signer } from 'ethers';
import { TransactionRequest } from '@ethersproject/providers';

export interface DeployContractParams {
  name: string;
  source: string;
  data: TransactionRequest;
  version: number;
  type: DeploymentType;
  group?: string;
}

export interface NetworkParams {
  signer: Signer;
  network: string;
  gasPrice?: string;
  gasLimit?: string;
}

export enum DeploymentType {
  synth = 'synth',
  staking = 'staking',
  global = 'global',
  savings = 'savings',
}

export interface WriteToDeploymentsParams {
  name: string;
  source: string;
  address: string;
  txn: string;
  network: string;
  version: number;
  type: DeploymentType;
  group?: string;
}
