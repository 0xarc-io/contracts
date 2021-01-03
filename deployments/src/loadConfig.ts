import path from 'path';
import fs from 'fs-extra';

import { gray, red, blue } from 'chalk';
import { constants, getPathToNetwork } from '../config';

/*
 * Load Synth Config
 */

export interface LoadConfigParams {
  network: string;
  key: string;
}

export function loadSynthConfig(params: LoadConfigParams) {
  return loadConfig(params, constants.SYNTH_CONFIG_FILENAME, 'savings');
}

export function loadSavingsConfig(params: LoadConfigParams) {
  return loadConfig(params, constants.SAVINGS_CONFIG_FILENAME, 'savings');
}

export function loadStakingConfig(params: LoadConfigParams) {
  return loadConfig(params, constants.STAKING_CONFIG_FILENAME, 'staking');
}

function loadConfig(params: LoadConfigParams, filename: string, type: string) {
  console.log(gray(`Loading the ${type} config for ${params.network.toUpperCase()}...`));

  const configFile = getPathToNetwork(params.network, filename, path);
  const config = fs.readJSONSync(configFile, {});

  if (!config.hasOwnProperty(params.key)) {
    console.log(red(`${params.key} does not exist in ${type} config`));
    return;
  }

  console.log(blue(`${params.key} config found!`));

  return config[params.key];
}
