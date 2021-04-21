import { WaitlistBatchFactory } from '@src/typings';
import { green, yellow } from 'chalk';
import { task } from 'hardhat/config';
import { deployContract, DeploymentType, loadDetails, pruneDeployments } from '../deployments/src';

task('deploy-waitlist-batch', 'Deploy the WaitlistBatch contract')
  .addParam('currency', 'The address of the deposit currency')
  .addOptionalParam('path', 'The path to the solidity file for Etherscan verification')
  .setAction(async (taskArgs, hre) => {
    const { network, signer, networkConfig } = await loadDetails(taskArgs, hre);
    const { currency, path } = taskArgs;

    await pruneDeployments(network, signer.provider);

    const waitlistAddress = await deployContract(
      {
        name: 'WaitlistBatch',
        source: 'WaitlistBatch',
        data: new WaitlistBatchFactory(signer).getDeployTransaction(currency),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );

    console.log(green(`Contract WaitlistBatch deployed at ${waitlistAddress}`));

    // if (path) {
    //   console.log(yellow(`Verifying the contract...`));
    //   await hre.run('verify-contract', { path, address: waitlistAddress, network });
    // }
  });
