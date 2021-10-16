import { DeploymentType } from '@deployments/types';
import { WaitlistBatchFactory } from '@src/typings';
import { PassportWaitlistFactory } from '@src/typings/PassportWaitlistFactory';
import { green, yellow } from 'chalk';
import { utils } from 'ethers';
import { task } from 'hardhat/config';
import {
  deployContract,
  loadDetails,
  pruneDeployments,
} from '../deployments/src';
import { verifyContract } from './task-utils';

task('deploy-waitlist-batch', 'Deploy the WaitlistBatch contract')
  .addParam('currency', 'The address of the deposit currency')
  .addParam(
    'depositduration',
    'Duration in seconds that has to be elapsed after a batch is approved, for users to recover their funds',
  )
  .setAction(async (taskArgs, hre) => {
    const { network, signer, networkConfig } = await loadDetails(hre);
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

task('deploy-passport-waitlist', 'Deploy the PassportWaitlist contract')
  .addParam('currency', 'Address of the payment token')
  .addParam('amount', 'Amount of the payment in in ether format')
  .addOptionalParam(
    'paymentreceiver',
    'Address of wallet that receives the payments',
  )
  .setAction(async (taskArgs, hre) => {
    const { network, signer, networkConfig } = await loadDetails(hre);
    const { currency, amount, paymentreceiver: paymentReceiver } = taskArgs;

    const amountInEther = utils.parseEther(amount);

    await pruneDeployments(network, signer.provider);

    const passportWaitlistAddy = await deployContract(
      {
        name: 'PassportWaitlist',
        source: 'PassportWaitlist',
        data: new PassportWaitlistFactory(signer).getDeployTransaction(
          currency,
          amountInEther,
          paymentReceiver || signer.address,
        ),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );

    await verifyContract(
      hre,
      passportWaitlistAddy,
      currency,
      amountInEther,
      paymentReceiver || signer.address,
    );
  });
