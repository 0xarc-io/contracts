import fs from 'fs-extra';

import { getDeploymentsFilePath, loadDeployedContracts } from './loadDeployedContracts';

/*
 * Write To Deployments
 */

export enum DeploymentType {
  synth = 'synth',
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
  type: DeploymentType;
  group?: string;
}

export async function writeToDeployments(params: WriteToDeploymentsParams) {
  const contracts = loadDeployedContracts(params.network);
  contracts.push({
    ...params,
    group: params.group || '',
  });

  const deploymentsPath = getDeploymentsFilePath(params.network);
  await fs.writeFileSync(deploymentsPath, JSON.stringify(contracts, null, 2));
}
