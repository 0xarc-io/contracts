import { red } from 'chalk';
import _ from 'lodash';
import { loadDeployedContracts } from './loadDeployedContracts';

/*
 * Load Contract
 */

export interface LoadContractParams {
  network: string;
  name?: string;
  source?: string;
  type?: string;
  group?: string;
  version?: number | string;
}

export interface ContractDetails {
  name: string;
  source: string;
  address: string;
  txn: string;
  network: string;
  version: number;
  type: string;
  group: string;
}

export function loadContract(params: LoadContractParams) {
  const results = loadContracts(params);

  if (results.length == 0) {
    throw red(`No contracts found for ${JSON.stringify(params, null, 2)}`);
  }

  if (results.length > 1) {
    throw red(
      `More than one contract found for ${JSON.stringify(params, null, 2)}`,
    );
  }

  return results[0];
}

export function loadContracts(
  params: LoadContractParams,
): Array<ContractDetails> {
  const contracts = loadDeployedContracts(params.network);

  // If nothing was passed in
  if (_.isNil(params)) {
    throw red('No name, type, source or group passed in');
  }

  return _.filter(
    contracts,
    _.matches(_.pickBy(params, _.identity)),
  ) as Array<ContractDetails>;
}
