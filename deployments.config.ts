import { red } from 'chalk';
import path, { PlatformPath } from 'path';

// load the data in explicitly (not programmatically) so webpack knows what to bundle
export const networkPaths = {
  rinkeby: {
    deployment: require('./deployments/rinkeby/deployed.json'),
    synthConfig: require('./deployments/rinkeby/synth-config.json'),
  },
  mainnet: {
    deployment: require('./deployments/mainnet/deployed.json'),
    synthConfig: require('./deployments/mainnet/synth-config.json'),
  },
};

export const networks = ['local', 'rinkeby', 'mainnet'];

export const constants = {
  BUILD_FOLDER: 'build',
  CONTRACTS_FOLDER: 'contracts',
  SYNTH_CONFIG_FILENAME: 'synth-config.json',
  DEPLOYMENT_FILENAME: 'deployed.json',
};

export function getPathToNetwork(
  network: string = 'mainnet',
  file: string = '',
  platformPath: PlatformPath,
) {
  if (!networks.includes(network)) {
    throw red(`** ${network} is not a valid network **`);
  }

  return path.join(__dirname, 'deployments', network, file);
}
