import path from 'path';
import fs from 'fs-extra';

import { constants, getPathToNetwork } from '../../deployments.config';

/*
 * Load Deployed Contracts
 */

export function getDeploymentsFilePath(network: string): string {
  return getPathToNetwork(network, constants.DEPLOYMENT_FILENAME, path);
}

export function loadDeployedContracts(network: string): Array<any> {
  const deploymentsFile = getDeploymentsFilePath(network);
  fs.ensureFileSync(deploymentsFile);
  const deployments = fs.readJSONSync(deploymentsFile, { throws: false }) || [];
  return deployments;
}
