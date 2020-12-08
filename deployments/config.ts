import { red } from 'chalk';
import { PlatformPath } from 'path';

export const networks = ['local', 'rinkeby', 'kovan', 'mainnet'];
export const deploymentTestNetworks = ['mainnet'];

export const constants = {
  BUILD_FOLDER: 'build',
  CONTRACTS_FOLDER: 'contracts',
  SYNTH_CONFIG_FILENAME: 'synth-config.json',
  SAVINGS_CONFIG_FILENAME: 'savings-config.json',
  SUBGRAPH_CONFIG_FILENAME: 'subgraph-config.json',
  DEPLOYMENT_FILENAME: 'deployed.json',
};

export function getPathToNetwork(
  network: string = 'mainnet',
  file: string = '',
  path: PlatformPath,
) {
  if (!networks.includes(network)) {
    throw red(`** ${network} is not a valid network **`);
  }

  return path.join(__dirname, network, file);
}
