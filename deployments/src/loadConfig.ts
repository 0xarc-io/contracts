import { CollateralConfig } from '@deployments/types';
import { gray, red, blue } from 'chalk';
import { constants, getPathToNetwork } from './config';

/*
 * Load Synth Config
 */

export interface LoadConfigParams {
  network: string;
  key: string;
}

export async function loadCollateralConfig(params: LoadConfigParams) {
  return await loadConfig(
    params,
    constants.COLLATERAL_CONFIG_FILENAME,
    'synth',
  );
}

export async function loadSavingsConfig(params: LoadConfigParams) {
  return await loadConfig(params, constants.SAVINGS_CONFIG_FILENAME, 'savings');
}

// export async function loadStakingConfig(params: LoadConfigParams) {
//   return await loadConfig(params, constants.STAKING_CONFIG_FILENAME, 'staking');
// }

async function loadConfig(
  params: LoadConfigParams,
  filename: string,
  type: string,
): Promise<CollateralConfig> {
  console.log(
    gray(`Loading the ${type} config for ${params.network.toUpperCase()}...`),
  );

  const configFile = getPathToNetwork(params.network, filename);
  const { default: config } = await import(configFile);

  if (!(params.key in config)) {
    console.log(red(`${params.key} does not exist in ${type} config`));
    return;
  }

  console.log(blue(`${params.key} config found!`));

  return config[params.key];
}
