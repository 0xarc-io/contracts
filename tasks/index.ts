import 'module-alias/register';

export * from './mozart-tasks';
export * from './spritz-tasks';
export * from './global-tasks';

import path from 'path';
import fs from 'fs-extra';
import shell from 'shelljs';

import { task } from 'hardhat/config';
import { gray } from 'chalk';
import { constants, getPathToNetwork } from '../deployments.config';
import { loadContract } from '../deployments/src/loadContracts';
import { DeploymentType } from '../deployments/src/writeToDeployments';

task('deploy-setup', 'Deploy all the smart contracts locally').setAction(async (taskArgs, hre) => {
  await hre.run('deploy-global');
  await hre.run('deploy-spritz', { synth: 'LINKUSD' });
  await hre.run('deploy-mozart', { synth: 'ETHX' });
  await hre.run('deploy-mozart-synthetic', { name: 'STABLEx', symbol: 'STABLEX' });
  await hre.run('deploy-mozart', { synth: 'YUSD-STABLEX' });
  await hre.run('deploy-mozart-savings', { savings: 'STABLEX' });
  await hre.run('prepare-subgraph');
});

task('prepare-subgraph', 'Prepare a subgraph for deployment').setAction(async (taskArgs, hre) => {
  const network = hre.network.name;

  console.log(gray(`Loading the subgraph config for ${network.toUpperCase()}...`));

  const subgraphFilePath = getPathToNetwork(network, constants.SUBGRAPH_CONFIG_FILENAME, path);
  fs.ensureFileSync(subgraphFilePath);

  const subgraphConfig = fs.readJSONSync(subgraphFilePath, { throws: false }) || {
    network: 'mainnet',
    startBlock: 0,
  };

  subgraphConfig.synthRegistry = loadContract({
    network,
    name: 'SynthRegistry',
    type: DeploymentType.global,
  }).address;

  subgraphConfig.synthRegistryV2 = loadContract({
    network,
    name: 'SynthRegistryV2',
    type: DeploymentType.global,
  }).address;

  try {
    subgraphConfig.savingsRegistry = loadContract({
      network,
      name: 'SavingsRegistry',
      type: DeploymentType.global,
    }).address;
  } catch {}

  fs.writeFileSync(subgraphFilePath, JSON.stringify(subgraphConfig, null, 2));

  shell.exec(`yarn mustache ${subgraphFilePath} subgraph.template.yaml subgraph.yaml`);
});
