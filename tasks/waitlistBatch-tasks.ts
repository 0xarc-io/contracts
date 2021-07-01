import { WaitlistBatchFactory } from '@src/typings';
import { green, yellow } from 'chalk';
import { task } from 'hardhat/config';
import {
  deployContract,
  DeploymentType,
  loadDetails,
  pruneDeployments,
} from '../deployments/src';

task('deploy-waitlist-batch', 'Deploy the WaitlistBatch contract')
  .addParam('currency', 'The address of the deposit currency')
  .addParam(
    'depositduration',
    'Duration in seconds that has to be elapsed after a batch is approved, for users to recover their funds',
  )
  .setAction(async (taskArgs, hre) => {
    const { network, signer, networkConfig } = await loadDetails(taskArgs, hre);
    const { currency, depositduration } = taskArgs;

    await pruneDeployments(network, signer.provider);

    const waitlistAddress = await deployContract(
      {
        name: 'WaitlistBatch',
        source: 'WaitlistBatch',
        data: new WaitlistBatchFactory(signer).getDeployTransaction(
          currency,
          depositduration,
        ),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );

    console.log(green(`Contract WaitlistBatch deployed at ${waitlistAddress}`));

    console.log(yellow(`Verifying contract...`));
    await hre.run('verify:verify', {
      address: waitlistAddress,
      constructorArguments: [currency, depositduration],
    });
    console.log(green(`Contract verified successfully!`));
  });
