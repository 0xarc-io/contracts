import { red } from 'chalk';
import path from 'path';

export const networks = [
  'local',
  'rinkeby',
  'mainnet',
  'playnet',
  'mumbai',
  'polygon',
  'fuji',
  'avalanche',
];
export const deploymentTestNetworks = ['mainnet' /*'playnet'*/];

export const constants = {
  BUILD_FOLDER: 'build',
  CONTRACTS_FOLDER: 'contracts',
  COLLATERAL_CONFIG_FILENAME: 'collateral-config.ts',
  SAVINGS_CONFIG_FILENAME: 'savings-config.json',
  STAKING_CONFIG_FILENAME: 'staking-config.ts',
  SUBGRAPH_CONFIG_FILENAME: 'subgraph-config.json',
  DEPLOYMENT_FILENAME: 'deployed.json',
};

export function getPathToNetwork(
  network: string = 'mainnet',
  file: string = '',
) {
  if (!networks.includes(network)) {
    throw red(`** ${network} is not a valid network **`);
  }

  return path.join(__dirname, '..', network, file);
}