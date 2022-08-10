import { WriteToDeploymentsParams } from '../../deployments/types';
import fs from 'fs-extra';

import {
  getDeploymentsFilePath,
  loadDeployedContracts,
} from '../../deployments/src/loadDeployedContracts';

/*
 * Write To Deployments
 */

export function writeToDeployments(params: WriteToDeploymentsParams) {
  const contracts = loadDeployedContracts(params.network);
  contracts.push({
    ...params,
    group: params.group || '',
  });

  const deploymentsPath = getDeploymentsFilePath(params.network);
  fs.writeFileSync(deploymentsPath, JSON.stringify(contracts, null, 2));
}
