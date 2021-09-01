import 'module-alias/register';

import fs from 'fs-extra';
import shell from 'shelljs';

import { task } from 'hardhat/config';
import { gray } from 'chalk';
import { constants, getPathToNetwork } from '../deployments/src/config';
import { loadContract } from '../deployments/src/loadContracts';
import { DeploymentType } from '../deployments/src/writeToDeployments';

task('prepare-subgraph', 'Prepare a subgraph for deployment').setAction(async (taskArgs, hre) => {
  const network = hre.network.name;

  console.log(gray(`Loading the subgraph config for ${network.toUpperCase()}...`));

  const subgraphFilePath = getPathToNetwork(network, constants.SUBGRAPH_CONFIG_FILENAME);
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
