import path from 'path';
import fs from 'fs-extra';

import { gray, red, blue } from 'chalk';
import { constants, getPathToNetwork } from '../../deployments.config';

/*
 * Load Synth Config
 */

export interface LoadSynthConfigParams {
  network: string;
  synth: string;
}

export function loadSynthConfig(params: LoadSynthConfigParams) {
  console.log(gray(`Loading the synth config for ${params.network.toUpperCase()}...`));

  const synthsFile = getPathToNetwork(params.network, constants.SYNTH_CONFIG_FILENAME, path);
  const synthConfig = fs.readJSONSync(synthsFile, {});

  if (!synthConfig.hasOwnProperty(params.synth)) {
    console.log(red(`${params.synth} does not exist in synth config`));
    return;
  }

  console.log(blue(`${params.synth} config found!`));

  return synthConfig;
}
