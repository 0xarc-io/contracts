import { red } from 'chalk';
import path from 'path';

export const networks = [
  'local',
  'rinkeby',
  'mainnet',
  'mumbai',
  'polygon',
  'goerli',
];

export const constants = {
  BUILD_FOLDER: 'build',
  CONTRACTS_FOLDER: 'contracts',
  COLLATERAL_CONFIG_FILENAME: 'collateral-config.ts',
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
