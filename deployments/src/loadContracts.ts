import { gray, red, blue } from 'chalk';
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
    throw red(`More than one contract found for ${JSON.stringify(params, null, 2)}`);
  }

  return results[0];
}

export function loadContracts(params: LoadContractParams): Array<ContractDetails> {
  const contracts = loadDeployedContracts(params.network);

  // If nothing was passed in
  if (!params.name && !params.type && !params.group && !params.source) {
    throw red('No name, type, source or group passed in');
  }

  //
  // Single parameter check
  //

  // Only a name was passed in
  if (params.name && !params.source && !params.type && !params.group) {
    return Object.values(contracts).filter((item: any) => {
      return item.name == params.name;
    });
  }

  // Only a source was passed in
  if (!params.name && params.source && !params.type && !params.group) {
    return Object.values(contracts).filter((item: any) => {
      return item.source == params.source;
    });
  }

  // Only a type was passed in
  if (!params.name && !params.source && params.type && !params.group) {
    return Object.values(contracts).filter((item: any) => {
      return item.type == params.type;
    });
  }

  // Only a group was passed in
  if (!params.name && !params.source && !params.type && params.group) {
    return Object.values(contracts).filter((item: any) => {
      return item.group == params.group;
    });
  }

  //
  // Double parameter check
  //

  // A name and source was passed in
  if (params.name && params.source && !params.type && !params.group) {
    return Object.values(contracts).filter((item: any) => {
      return item.name == params.name && item.source == params.source;
    });
  }

  // A name and type was passed in
  if (params.name && !params.source && params.type && !params.group) {
    return Object.values(contracts).filter((item: any) => {
      return item.name == params.name && item.type == params.type;
    });
  }

  // A name and group was passed in
  if (params.name && !params.source && !params.type && params.group) {
    return Object.values(contracts).filter((item: any) => {
      return item.name == params.name && item.group == params.group;
    });
  }

  // A source and type was passed in
  if (!params.name && params.source && params.type && !params.group) {
    return Object.values(contracts).filter((item: any) => {
      return item.source == params.source && item.type == params.type;
    });
  }

  // A source and group was passed in
  if (!params.name && params.source && !params.type && params.group) {
    return Object.values(contracts).filter((item: any) => {
      return item.source == params.source && item.group == params.group;
    });
  }

  // A type and group was passed in
  if (!params.name && !params.source && params.type && params.group) {
    return Object.values(contracts).filter((item: any) => {
      return item.type == params.type && item.group == params.group;
    });
  }

  //
  // Triple parameter check
  //

  // A name, source, type was passed in
  if (params.name && params.source && params.type && !params.group) {
    return Object.values(contracts).filter((item: any) => {
      return item.name == params.name && item.source == params.source && item.type == params.type;
    });
  }

  // A name, source, group was passed in
  if (params.name && params.source && !params.type && params.group) {
    return Object.values(contracts).filter((item: any) => {
      return item.name == params.name && item.source == params.source && item.group == params.group;
    });
  }

  // A source, type, group was passed in
  if (!params.name && params.source && params.type && params.group) {
    return Object.values(contracts).filter((item: any) => {
      return item.source == params.source && item.type == params.type && item.group == params.group;
    });
  }

  // A name, type, group was passed in
  if (params.name && !params.source && params.type && params.group) {
    return Object.values(contracts).filter((item: any) => {
      return item.name == params.name && item.type == params.type && item.group == params.group;
    });
  }

  //
  // Quad parameter check
  //

  // A name, source, type and group was passed in
  if (params.name && params.source && params.type && params.group) {
    return Object.values(contracts).filter((item: any) => {
      return (
        item.name == params.name &&
        item.source == params.source &&
        item.type == params.type &&
        item.group == params.group
      );
    });
  }

  return [];
}
