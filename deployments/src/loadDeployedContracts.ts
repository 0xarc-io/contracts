import { WriteToDeploymentsParams } from '@deployments/types';
import fs from 'fs-extra';

import { constants, getPathToNetwork } from './config';

/*
 * Load Deployed Contracts
 */

export function getDeploymentsFilePath(network: string): string {
  return getPathToNetwork(network, constants.DEPLOYMENT_FILENAME);
}

export function loadDeployedContracts(network: string): Array<WriteToDeploymentsParams> {
  const deploymentsFile = getDeploymentsFilePath(network);
  fs.ensureFileSync(deploymentsFile);
  const deployments = fs.readJSONSync(deploymentsFile, { throws: false }) || [];
  return deployments;
}
