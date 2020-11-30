import path from 'path';
import fs from 'fs-extra';

import { gray, red, blue } from 'chalk';
import { constants, getPathToNetwork } from '../../deployments.config';

/*
 * Load Synth Config
 */

export interface LoadConfigParams {
  network: string;
  key: string;
}

export function loadSynthConfig(params: LoadConfigParams) {
  console.log(gray(`Loading the synth config for ${params.network.toUpperCase()}...`));

  const synthsFile = getPathToNetwork(params.network, constants.SYNTH_CONFIG_FILENAME, path);
  const synthConfig = fs.readJSONSync(synthsFile, {});

  if (!synthConfig.hasOwnProperty(params.key)) {
    console.log(red(`${params.key} does not exist in synth config`));
    return;
  }

  console.log(blue(`${params.key} config found!`));

  return synthConfig[params.key];
}

export function loadSavingsConfig(params: LoadConfigParams) {
  console.log(gray(`Loading the savings config for ${params.network.toUpperCase()}...`));

  const synthsFile = getPathToNetwork(params.network, constants.SAVINGS_CONFIG_FILENAME, path);
  const synthConfig = fs.readJSONSync(synthsFile, {});

  if (!synthConfig.hasOwnProperty(params.key)) {
    console.log(red(`${params.key} does not exist in savings config`));
    return;
  }

  console.log(blue(`${params.key} config found!`));

  return synthConfig[params.key];
}
