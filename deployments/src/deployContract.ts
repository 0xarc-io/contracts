import { ethers, Signer } from 'ethers';
import { writeToDeployments, DeploymentType } from './writeToDeployments';
import { yellow, gray, green, red, magenta } from 'chalk';
import { loadContracts } from './loadContracts';
import { TransactionRequest } from '@ethersproject/providers';

export interface DeployContractParams {
  name: string;
  source: string;
  data: TransactionRequest;
  version: number;
  type: DeploymentType;
  group?: string;
}

export interface NetworkParams {
  signer: Signer;
  network: string;
  gasPrice?: string;
  gasLimit?: string;
}

export async function deployContract(
  deployParams: DeployContractParams,
  networkParams: NetworkParams,
) {
  // Ignore source since it may vary based on the network
  const existing = loadContracts({
    network: networkParams.network,
    name: deployParams.name,
    type: deployParams.type,
    group: deployParams.group,
  });

  const tx = deployParams.data;

  tx.gasLimit = networkParams.gasLimit || deployParams.data.gasLimit;
  tx.gasPrice = networkParams.gasPrice || deployParams.data.gasPrice;

  const details = `${deployParams.name} | ${deployParams.source} | ${
    deployParams.group || 'no-group'
  }`;

  if (existing.length) {
    console.log(magenta(`Contract already exists: ${details}`));
    return existing[0].address;
  }

  console.log(yellow(`* Deploying: ${details}`));
  const signedTx = await networkParams.signer.sendTransaction(tx);

  console.log(gray(`* Sending tx: ${signedTx.hash}`));

  try {
    const receipt = await signedTx.wait();
    console.log(green(`Deployed: ${details}\n`));

    await writeToDeployments({
      name: deployParams.name,
      source: deployParams.source,
      address: receipt.contractAddress,
      txn: signedTx.hash,
      network: networkParams.network,
      version: 1,
      type: deployParams.type,
      group: deployParams.group || '',
    });

    return receipt.contractAddress;
  } catch {
    console.log(red(`Failed to deploy: ${details}\n`));
  }
}
