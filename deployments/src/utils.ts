import { Signer } from 'ethers';
import { loadDeployedContracts, getDeploymentsFilePath } from './loadDeployedContracts';
import { asyncForEach } from '@src/utils/asyncForEach';
import { red, magenta } from 'chalk';
import fs from 'fs-extra';
import { Provider } from 'ethers/providers';

export async function pruneDeployments(network: string, provider: Provider) {
  const entries = loadDeployedContracts(network);

  let prunedEntries: any[] = [];

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
