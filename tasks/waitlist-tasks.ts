import { DeploymentType } from '../deployments/types';
import { DefiPassportFactory, WaitlistBatchFactory } from '@src/typings';
import { PassportWaitlistFactory } from '@src/typings/PassportWaitlistFactory';
import { utils, BigNumber } from 'ethers';
import { task } from 'hardhat/config';
import { loadContract } from '../deployments/src';
import { id } from '@ethersproject/hash';
import { createArrayCsvWriter } from 'csv-writer';
import { green, yellow } from 'chalk';
import { formatEther } from '@ethersproject/units';
import { loadHardhatDetails } from './utils/loadHardhatDetails';
import { pruneDeployments } from './utils/pruneDeployments';
import { verifyContract } from './utils/verifyContract';
import { deployAndSaveContract } from './utils/deployAndSaveContract';

task('deploy-waitlist-batch', 'Deploy the WaitlistBatch contract')
  .addParam('currency', 'The address of the deposit currency')
  .addParam(
    'depositduration',
    'Duration in seconds that has to be elapsed after a batch is approved, for users to recover their funds',
  )
  .setAction(async (taskArgs, hre) => {
    const { network, signer, networkConfig } = await loadHardhatDetails(hre);
    const { currency, depositduration } = taskArgs;

    await pruneDeployments(network, signer.provider);

    const waitlistAddress = await deployAndSaveContract(
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

    await verifyContract(hre, waitlistAddress, currency, depositduration);
  });

task('deploy-passport-waitlist', 'Deploy the PassportWaitlist contract')
  .addParam('currency', 'Address of the payment token')
  .addParam('amount', 'Amount of the payment in in ether format')
  .addOptionalParam(
    'paymentreceiver',
    'Address of wallet that receives the payments',
  )
  .setAction(async (taskArgs, hre) => {
    const { network, signer, networkConfig } = await loadHardhatDetails(hre);
    const { currency, amount, paymentreceiver: paymentReceiver } = taskArgs;

    const amountInEther = utils.parseEther(amount);

    await pruneDeployments(network, signer.provider);

    const passportWaitlistAddy = await deployAndSaveContract(
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

task(
  'get-waitlist-applicants',
  'Gets all the applicants from the WaitlistBatch contract and saves them to applicants.csv in the format used by multisender.app',
).setAction(async (_taskArgs, hre) => {
  const { network, signer } = await loadHardhatDetails(hre);
  const csvFileName = 'applicants.csv';
  const csvWriter = createArrayCsvWriter({
    path: csvFileName,
  });

  const defiPassportAddress = loadContract({
    network,
    name: 'DefiPassportProxy',
  }).address;
  const defiPassport = DefiPassportFactory.connect(defiPassportAddress, signer);
  let biggestPassportId = BigNumber.from(0);

  // Get applicants from waitlist
  const waitlistDetails = await loadContract({
    network,
    name: 'WaitlistBatch',
  });
  const waitlistBatch = WaitlistBatchFactory.connect(
    waitlistDetails.address,
    signer,
  );
  const applicantsLogs = await signer.provider.getLogs({
    address: waitlistBatch.address,
    topics: [id('AppliedToBatch(address,uint256,uint256)')],
    fromBlock: 13056463, // The block where this contract was deployed; Taken from Etherscan
  });
  const parsedLogs = applicantsLogs.map((log) =>
    waitlistBatch.interface.parseLog(log),
  );
  const applicants: [string, string][] = [];

  console.log(
    yellow(
      'Finding the passport IDs of the applicants and constructing the csv file...',
    ),
  );
  let usersWithoutPassport = 0;
  for (const log of parsedLogs) {
    console.log(`querying user nr ${applicants.length}`);
    const user = log.args.user as string;

    try {
      const passportId = await defiPassport.tokenOfOwnerByIndex(user, 0);
      if (passportId.gt(biggestPassportId)) {
        biggestPassportId = passportId;
      }
    } catch (e) {
      usersWithoutPassport += 1;
    }

    applicants.push([user, formatEther(log.args.amount).toString()]);
  }

  // Save applicants to csv
  await csvWriter.writeRecords(applicants);
  console.log(green(`All applicants have been saved to ${csvFileName}`));
  console.log(yellow(`${usersWithoutPassport} have no passport`));
  console.log(
    green(`The higest passport ID is ${biggestPassportId.toString()}`),
  );
});
