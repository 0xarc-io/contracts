import {
  AddressAccrualFactory,
  ArcxTokenFactory,
  SynthRegistryFactory,
  SynthRegistryV2Factory,
  WhitelistSaleFactory,
} from '@src/typings';
import {
  deployContract,
  loadDetails,
  pruneDeployments,
} from '../deployments/src';
import { task } from 'hardhat/config';
import { DeploymentType } from '../deployments/src/writeToDeployments';
import { NetworkParams } from '../deployments/src/deployContract';
import { ArcProxyInfoFactory } from '@src/typings/ArcProxyInfoFactory';
import { SavingsRegistryFactory } from '@src/typings/SavingsRegistryFactory';
import { green, red, yellow } from 'chalk';

import path from 'path';
import neatCsv from 'neat-csv';
import fs from 'fs';
import { BigNumber, ContractTransaction, utils } from 'ethers';
import _ from 'lodash';
import ArcDecimal from '@src/utils/ArcDecimal';
import { ArcxTokenV2Factory } from '@src/typings/ArcxTokenV2Factory';

task(
  'deploy-global',
  'Deploy, update and interact with global contracts',
).setAction(async (taskArgs, hre) => {
  const network = hre.network.name;
  const signer = (await hre.ethers.getSigners())[0];

  await pruneDeployments(network, signer.provider);

  const networkConfig = { network, signer } as NetworkParams;

  const arcxToken = await deployContract(
    {
      name: 'ArcxToken',
      source: 'ArcxToken',
      data: new ArcxTokenFactory(signer).getDeployTransaction(),
      version: 1,
      type: DeploymentType.global,
    },
    networkConfig,
  );

  const arcDAO = await deployContract(
    {
      name: 'ArcDAO',
      source: 'AddressAccrual',
      data: new AddressAccrualFactory(signer).getDeployTransaction(arcxToken),
      version: 1,
      type: DeploymentType.global,
    },
    networkConfig,
  );

  const synthRegistry = await deployContract(
    {
      name: 'SynthRegistry',
      source: 'SynthRegistry',
      data: new SynthRegistryFactory(signer).getDeployTransaction(),
      version: 1,
      type: DeploymentType.global,
    },
    networkConfig,
  );

  const synthRegistryV2 = await deployContract(
    {
      name: 'SynthRegistryV2',
      source: 'SynthRegistryV2',
      data: new SynthRegistryV2Factory(signer).getDeployTransaction(),
      version: 2,
      type: DeploymentType.global,
    },
    networkConfig,
  );

  const proxyInfo = await deployContract(
    {
      name: 'ArcProxyInfo',
      source: 'ArcProxyInfo',
      data: new ArcProxyInfoFactory(signer).getDeployTransaction(),
      version: 1,
      type: DeploymentType.global,
    },
    networkConfig,
  );

  const savingsRegistry = await deployContract(
    {
      name: 'SavingsRegistry',
      source: 'SavingsRegistry',
      data: new SavingsRegistryFactory(signer).getDeployTransaction(),
      version: 1,
      type: DeploymentType.global,
    },
    networkConfig,
  );
});

task('deploy-arcx-token-v2', 'Deploy the ArcxTokenV2')
  .addParam('oldtoken', 'The address of the old ARCX token')
  .setAction(async (taskArgs, hre) => {
    const network = hre.network.name;
    const oldArcxToken = taskArgs['oldtoken'];

    const signer = (await hre.ethers.getSigners())[0];
    const networkConfig = { network, signer } as NetworkParams;

    const arcxToken = await deployContract(
      {
        name: 'ArcxTokenV2',
        source: 'ArcxTokenV2',
        data: new ArcxTokenV2Factory(signer).getDeployTransaction(oldArcxToken),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );

    console.log(green(`ARCX V2 successfully deployed at ${arcxToken}`));
  });

task(
  'deploy-whitelist-sale',
  'Deploy the WhitelistSale contract using USDC as currency and load it with data',
)
  .addParam(
    'currency',
    'The address of the currency to use',
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    undefined,
    true,
  )
  .setAction(async (taskArgs, hre) => {
    const { network, signer, networkConfig } = await loadDetails(taskArgs, hre);

    const kyfEligibilityFilePath = path.join(
      __dirname,
      `phase2Eligibility${
        network === 'playnet' || network == 'rinkeby' ? '-playnet' : ''
      }.csv`,
    );
    const USDCAddress = taskArgs.currency;

    await pruneDeployments(network, signer.provider);

    const whitelistSaleAddress = await deployContract(
      {
        name: 'WhitelistSale-2',
        source: 'WhitelistSale',
        data: new WhitelistSaleFactory(signer).getDeployTransaction(
          USDCAddress,
        ),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );

    if (!whitelistSaleAddress || whitelistSaleAddress.length == 0) {
      throw red('WhitelistSale contract has not been deployed!');
    }

    // Set allowances
    // NOTE: the allowances must take into account that USDC has 6 decimals!

    // Load the allowances from file
    const users: string[] = [];
    const allowances: BigNumber[] = [];

    try {
      console.log(yellow('Reading allowances from file...'));
      const data = fs.readFileSync(kyfEligibilityFilePath);
      const eligibilityData = await neatCsv(data);

      for (const row of eligibilityData) {
        const allowance = {
          address: row['Account'],
          allowance: ArcDecimal.new(parseFloat(row['Total USDC']), 6).value,
        };

        if (
          allowance.address &&
          utils.isAddress(allowance.address) &&
          allowance.allowance
        ) {
          users.push(allowance.address);
          allowances.push(allowance.allowance);
        }
      }
    } catch (err) {
      throw red(`Error reading kyfEligibility file: ${err}`);
    }

    if (
      users.length === 0 ||
      allowances.length === 0 ||
      users.length !== allowances.length
    ) {
      throw red(
        `The number of users and number of allowances do not match or are empty. Got ${users.length} and ${allowances.length}.`,
      );
    }

    // Set allowances
    console.log(yellow(`Setting up ${allowances.length} allowances...`));

    const whitelistSaleContract = WhitelistSaleFactory.connect(
      whitelistSaleAddress,
      signer,
    );

    try {
      const batchSize = 75;
      const usersBatches = _.chunk(users, batchSize);
      const allowancesBatches = _.chunk(allowances, batchSize);
      let tx: ContractTransaction;

      for (let i = 0; i < Math.ceil(users.length / batchSize); i++) {
        console.log(yellow(`Setting allocation batch ${i}...`));

        tx = await whitelistSaleContract.setAllocation(
          usersBatches[i],
          allowancesBatches[i],
          {
            gasLimit: 3000000,
          },
        );
        await tx.wait();
      }

      console.log(green(`${users.length} allocations set!`));
      const testParticipant = await whitelistSaleContract.participants(
        users[0],
      );

      console.log({
        testParticipantAllocation: BigNumber.from(
          testParticipant.allocation,
        ).toString(),
      });
    } catch (err) {
      console.log(red(`Error setting allocations: ${err}`));
    }
  });

// @TODO: Scenarios to plan for:
//        - Deploying all the core contracts
//          - ARCX Token
//          - Synth Registry
//        - Deploying a new version of KYF
//        - Deploy a new KYF Token
//        - Deploy a new Skillset Token
//        - Transfer ownership of any new token to the rightful owner
//        - Getting verified on Etherscan
