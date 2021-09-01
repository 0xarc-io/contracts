import fs from 'fs-extra';

import { loadDeployedContracts, getDeploymentsFilePath } from './loadDeployedContracts';
import { asyncForEach } from '../../src/utils/asyncForEach';
import { red, magenta } from 'chalk';
import { Provider } from '@ethersproject/providers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { NetworkParams } from './deployContract';

export async function loadDetails(hre: HardhatRuntimeEnvironment) {
  const network = hre.network.name;
  const signer = (await hre.ethers.getSigners())[0];

  const networkDetails = hre.config.networks[network];
  const networkConfig = { network, signer, gasPrice: networkDetails.gasPrice } as NetworkParams;

  return {
    network,
    signer,
    networkConfig,
    networkDetails,
  };
}

export async function pruneDeployments(network: string, provider: Provider) {
  const entries = loadDeployedContracts(network);

  const prunedEntries: any[] = [];

  await asyncForEach(entries, async (entry) => {
    const address = await entry.address;
    const code = await provider.getCode(address);
    if (code.length > 2) {
      prunedEntries.push(entry);
    }
  });

  if (prunedEntries.length == entries.length) {
    return;
  }

  const prunedLength = entries.length - prunedEntries.length;

  if (network == 'local' || network == 'hardhat') {
    const deploymentPath = getDeploymentsFilePath(network);
    console.log(magenta(`${prunedLength} Contracts Pruned!`));
    await fs.writeFileSync(deploymentPath, JSON.stringify(prunedEntries, null, 2));
    return;
  }

  if (prunedEntries.length != entries.length) {
    throw red(
      `There are ${prunedLength} non-existent contracts in the ${network} deployments file`,
    );
  }
}
