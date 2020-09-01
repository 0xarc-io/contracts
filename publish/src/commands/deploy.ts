'use strict';

import Deployer from '../Deployer';

import { CoreV1 } from '../../../src/typings/CoreV1';
import { StateV1 } from '../../../src/typings/StateV1';
import { ChainLinkOracle } from '../../../src/typings/ChainLinkOracle';
import { ArcProxy } from '../../../src/typings/ArcProxy';
import { MockOracle } from '../../../src/typings/MockOracle';
import { SyntheticToken } from '../../../src/typings/SyntheticToken';
import { TestToken } from '../../../src/typings/TestToken';
import { ArcxToken } from '../../../src/typings/ArcxToken';
import { KYF } from '../../../src/typings/KYF';
import { KYFV2 } from '../../../src/typings/KYFV2';
import { SynthRegistry } from '../../../src/typings';

import { ethers } from 'ethers';
import { asyncForEach } from '../../../src/utils/asyncForEach';
import { AddressAccrual } from '../../../src/typings/AddressAccrual';
import { AddressZero } from 'ethers/constants';

const path = require('path');
const { gray, green, yellow, redBright, red } = require('chalk');
const { table } = require('table');
const w3utils = require('web3-utils');

const { loadCompiledFiles, getLatestSolTimestamp } = require('../solidity');

const {
  ensureNetwork,
  ensureDeploymentPath,
  getDeploymentPathForNetwork,
  loadAndCheckRequiredSources,
  loadConnections,
  confirmAction,
  performTransactionalStep,
  parameterNotice,
} = require('../util');

const {
  toBytes32,
  constants: {
    BUILD_FOLDER,
    CONFIG_FILENAME,
    CONTRACTS_FOLDER,
    SYNTHS_FILENAME,
    DEPLOYMENT_FILENAME,
    ZERO_ADDRESS,
    inflationStartTimestampInSecs,
  },
} = require('../../..');

const DEFAULTS = {
  gasPrice: '1',
  methodCallGasLimit: 250e3, // 250k
  contractDeploymentGasLimit: 6.9e6, // TODO split out into seperate limits for different contracts, Proxys, Synths, Synthetix
  network: 'local',
  buildPath: path.join(__dirname, '..', '..', '..', BUILD_FOLDER),
};

const deploy = async ({
  addNewSynths = true,
  gasPrice = DEFAULTS.gasPrice,
  methodCallGasLimit = DEFAULTS.methodCallGasLimit,
  contractDeploymentGasLimit = DEFAULTS.contractDeploymentGasLimit,
  network = DEFAULTS.network,
  buildPath = DEFAULTS.buildPath,
  deploymentPath = '',
  privateKey = '',
  mintTokens = false,
  yes = true,
  dryRun = false,
  useFork = false,
} = {}) => {
  ensureNetwork(network);
  deploymentPath = deploymentPath || getDeploymentPathForNetwork(network);
  ensureDeploymentPath(deploymentPath);

  const {
    config,
    configFile,
    synths,
    deployment,
    deploymentFile,
    ownerActions,
    ownerActionsFile,
  } = loadAndCheckRequiredSources({
    deploymentPath,
    network,
  });

  console.log(
    gray('Checking all contracts not flagged for deployment have addresses in this network...'),
  );

  const missingDeployments = Object.keys(config).filter((name) => {
    return !config[name].deploy && (!deployment.targets[name] || !deployment.targets[name].address);
  });

  if (missingDeployments.length) {
    throw Error(
      `Cannot use existing contracts for deployment as addresses not found for the following contracts on ${network}:\n` +
        missingDeployments.join('\n') +
        '\n' +
        gray(`Used: ${deploymentFile} as source`),
    );
  }

  console.log(gray('Loading the compiled contracts locally...'));
  const { earliestCompiledTimestamp, compiled } = loadCompiledFiles({ buildPath });

  // now get the latest time a Solidity file was edited
  const latestSolTimestamp = getLatestSolTimestamp(CONTRACTS_FOLDER);

  const { providerUrl, privateKey: envPrivateKey, etherscanLinkPrefix } = loadConnections({
    network,
    useFork,
  });

  // allow local deployments to use the private key passed as a CLI option
  if (network !== 'local' || !privateKey) {
    privateKey = envPrivateKey;
  }

  const deployer = new Deployer({
    compiled,
    contractDeploymentGasLimit,
    config,
    configFile,
    deployment,
    deploymentFile,
    gasPrice,
    methodCallGasLimit,
    network,
    privateKey,
    providerUrl,
    dryRun,
    useFork,
  });

  const { account } = deployer;

  const getExistingContract = ({ contract }) => {
    if (!deployment.targets.hasOwnProperty(contract) || !deployment.targets[contract].address) {
      return;
    }

    const { address, source } = deployment.targets[contract];
    const { abi } = deployment.sources[source];

    return deployer.getContract({
      address,
      abi,
    });
  };

  const getExistingDependency = ({ name, contract }) => {
    if (!deployment.targets.hasOwnProperty(name)) {
      return;
    }

    if (!deployment.targets[name].dependencies.hasOwnProperty(contract)) {
      return;
    }

    const { address, source } = deployment.targets[name].dependencies[contract];
    const { abi } = deployment.sources[source];

    return deployer.getContract({
      address,
      abi,
    });
  };

  const newSynthsToAdd = synths
    .filter(({ name }) => !config[`Synth${name}`])
    .map(({ name }) => name);

  const deployerBalance = parseInt(
    w3utils.fromWei(
      await (await deployer.provider.getBalance(await deployer.account.getAddress())).toString(),
      'ether',
    ),
    10,
  );
  if (deployerBalance < 5) {
    console.log(
      yellow(`⚠ WARNING: Deployer account balance could be too low: ${deployerBalance} ETH`),
    );
  }

  parameterNotice({
    'Dry Run': dryRun ? green('true') : yellow('⚠ NO'),
    'Using a fork': useFork ? green('true') : yellow('⚠ NO'),
    Network: network,
    'Gas price to use': `${gasPrice} GWEI`,
    'Deployment Path': new RegExp(network, 'gi').test(deploymentPath)
      ? deploymentPath
      : yellow('⚠⚠⚠ cant find network name in path. Please double check this! ') + deploymentPath,
    'Local build last modified': `${new Date(earliestCompiledTimestamp)} ${yellow(
      ((new Date().getTime() - earliestCompiledTimestamp) / 60000).toFixed(2) + ' mins ago',
    )}`,
    'Last Solidity update':
      new Date(latestSolTimestamp) +
      (latestSolTimestamp > earliestCompiledTimestamp
        ? yellow(' ⚠⚠⚠ this is later than the last build! Is this intentional?')
        : green(' ✅')),
    'Add any new synths found?': addNewSynths
      ? green('✅ YES\n\t\t\t\t') + newSynthsToAdd.join(', ')
      : yellow('⚠ NO'),
    'Deployer account:': await account.getAddress(),
  });

  if (!yes) {
    try {
      await confirmAction(
        yellow(
          `⚠⚠⚠ WARNING: This action will deploy the following contracts to ${network}:\n${Object.entries(
            config,
          )
            .filter(([, deploy]) => deploy)
            .map(([contract]) => contract)
            .join(', ')}` + `\nIt will also set proxy targets and add synths to Synthetix.\n`,
        ) +
          gray('-'.repeat(50)) +
          '\nDo you want to continue? (y/n) ',
      );
    } catch (err) {
      console.log(gray('Operation cancelled'));
      return;
    }
  }

  console.log(
    gray(
      `Starting deployment to ${network.toUpperCase()}${useFork ? ' (fork)' : ''} via Infura...`,
    ),
  );

  const runStep = async (opts) =>
    performTransactionalStep({
      ...opts,
      account,
      gasPrice,
      etherscanLinkPrefix,
      ownerActions,
      ownerActionsFile,
      dryRun,
    });

  // ----------------
  // Core
  // ----------------

  let arcToken: ethers.Contract = getExistingContract({ contract: 'ArcxToken' });
  let distribution: ethers.Contract = getExistingContract({ contract: 'ArcDAO' });
  let kyf: ethers.Contract = getExistingContract({ contract: 'KYF' });
  let kyfv2: ethers.Contract = getExistingContract({ contract: 'KYFV2' });
  let synthRegistry: ethers.Contract = getExistingContract({ contract: 'SynthRegistry' });

  if (!arcToken) {
    arcToken = await deployer.deployContract({
      name: 'ArcxToken',
      source: 'ArcxToken',
      deployData: ArcxToken.getDeployTransaction(deployer.account).data,
    });
  }

  if (!distribution && arcToken) {
    distribution = await deployer.deployContract({
      name: 'ArcDAO',
      source: 'AddressAccrual',
      deployData: AddressAccrual.getDeployTransaction(deployer.account, arcToken.address).data,
    });
  }

  if (!kyf) {
    kyf = await deployer.deployContract({
      name: 'KYF',
      source: 'KYF',
      deployData: KYF.getDeployTransaction(deployer.account).data,
    });
  }

  if (!kyfv2) {
    kyfv2 = await deployer.deployContract({
      name: 'KYFV2',
      source: 'KYFV2',
      deployData: KYFV2.getDeployTransaction(deployer.account).data,
    });
  }

  if (!synthRegistry) {
    synthRegistry = await deployer.deployContract({
      name: 'SynthRegistry',
      source: 'SynthRegistry',
      deployData: SynthRegistry.getDeployTransaction(deployer.account).data,
    });
  }

  // ----------------
  // Synths
  // ----------------
  await asyncForEach(synths, async (synth) => {
    let { name, collateral_address, oracle_source_address, config } = synth;
    let synthConfig = synth.config;

    let proxy: ethers.Contract = getExistingContract({ contract: name });
    let coreV1: ethers.Contract = getExistingDependency({ name: name, contract: 'CoreV1' });
    let stateV1: ethers.Contract = getExistingDependency({ name: name, contract: 'StateV1' });
    let oracle: ethers.Contract = getExistingDependency({ name: name, contract: 'Oracle' });
    let syntheticToken: ethers.Contract = getExistingDependency({
      name: name,
      contract: 'SyntheticToken',
    });

    let collateralToken: string =
      collateral_address ||
      getExistingDependency({
        name: name,
        contract: 'CollateralToken',
      });

    // An oracle has actually been deployed
    if (oracle_source_address && !oracle) {
      // An oracle wasn't found but a chainlink address was passed
      oracle = await deployer.deployContract({
        name: name,
        dependency: 'Oracle',
        source: 'ChainLinkOracle',
        deployData: ChainLinkOracle.getDeployTransaction(deployer.account, oracle_source_address)
          .data,
      });
    } else if (!oracle_source_address && !oracle) {
      // We don't know anything so just deploy a dumb mock oracle
      oracle = await deployer.deployContract({
        name: name,
        dependency: 'Oracle',
        source: 'MockOracle',
        deployData: MockOracle.getDeployTransaction(deployer.account).data,
      });
    }

    if (!collateralToken) {
      collateralToken = (
        await deployer.deployContract({
          name: name,
          dependency: 'CollateralToken',
          source: 'TestToken',
          deployData: TestToken.getDeployTransaction(deployer.account, name, name).data,
        })
      ).address;
    }

    if (!coreV1) {
      coreV1 = await deployer.deployContract({
        name: name,
        dependency: 'CoreV1',
        source: 'CoreV1',
        deployData: CoreV1.getDeployTransaction(deployer.account).data,
      });
    }

    if (!proxy) {
      proxy = await deployer.deployContract({
        name: name,
        dependency: 'Proxy',
        source: 'ArcProxy',
        deployData: ArcProxy.getDeployTransaction(
          deployer.account,
          coreV1.address,
          await deployer.account.getAddress(),
          [],
        ).data,
      });
    }

    if (!syntheticToken) {
      syntheticToken = await deployer.deployContract({
        name: name,
        dependency: 'SyntheticToken',
        source: 'SyntheticToken',
        deployData: SyntheticToken.getDeployTransaction(deployer.account, proxy.address, name, name)
          .data,
      });
    }

    if (!stateV1) {
      stateV1 = await deployer.deployContract({
        name: name,
        dependency: 'StateV1',
        source: 'StateV1',
        deployData: StateV1.getDeployTransaction(
          deployer.account,
          proxy.address,
          await deployer.account.getAddress(),
          collateralToken,
          syntheticToken.address,
          oracle.address,
          {
            collateralRatio: {
              value: synthConfig.collateral_ratio,
            },
            liquidationArcFee: {
              value: synthConfig.liquidation_arc_fee,
            },
            liquidationUserFee: {
              value: synthConfig.liquidation_user_fee,
            },
          },
          {
            collateralLimit: synthConfig.collateral_limit,
            syntheticLimit: synthConfig.synthetic_limit,
            positionCollateralMinimum: synthConfig.position_minimum_collateral,
          },
        ).data,
      });
    }

    const proxiedCore = await CoreV1.at(account, proxy.address);
    if ((await proxiedCore.state()) != stateV1.address) {
      const data = proxiedCore.interface.functions.init.encode([stateV1.address]);
      await runStep({
        data: data,
        name: 'CoreV1',
        contract: proxiedCore,
      });
    }

    const synthRegistryBinded = SynthRegistry.at(deployer.account, synthRegistry.address);
    if (
      (await synthRegistryBinded.synthsByAddress(syntheticToken.address)).proxyAddress !=
      proxy.address
    ) {
      console.log(yellow(`Attempting to add ${name} to Synth Registry`));
      await synthRegistryBinded.addSynth(proxy.address, syntheticToken.address);
      console.log(green(`Successfully added ${name} to Synth Registry`));
    }
  });
};

module.exports = {
  deploy,
  DEFAULTS,
  cmd: (program) =>
    program
      .command('deploy')
      .description('Deploy compiled solidity files')
      .option(
        '-a, --add-new-synths',
        `Whether or not any new synths in the ${SYNTHS_FILENAME} file should be deployed if there is no entry in the config file`,
      )
      .option(
        '-b, --build-path [value]',
        'Path to a folder hosting compiled files from the "build" step in this script',
        DEFAULTS.buildPath,
      )
      .option(
        '-c, --contract-deployment-gas-limit <value>',
        'Contract deployment gas limit',
        parseInt,
        DEFAULTS.contractDeploymentGasLimit,
      )
      .option(
        '-d, --deployment-path <value>',
        `Path to a folder that has your input configuration file ${CONFIG_FILENAME}, the synth list ${SYNTHS_FILENAME} and where your ${DEPLOYMENT_FILENAME} files will go`,
      )
      .option('-g, --gas-price <value>', 'Gas price in GWEI', DEFAULTS.gasPrice)
      .option(
        '-l, --oracle-gas-limit <value>',
        'The address of the gas limit oracle for this network (default is use existing)',
      )
      .option(
        '-m, --method-call-gas-limit <value>',
        'Method call gas limit',
        parseInt,
        DEFAULTS.methodCallGasLimit,
      )
      .option(
        '-n, --network <value>',
        'The network to run off.',
        (x) => x.toLowerCase(),
        DEFAULTS.network,
      )
      .option(
        '-r, --dry-run',
        'If enabled, will not run any transactions but merely report on them.',
      )
      .option(
        '-t, --mint-tokens [value]',
        'Mint ARC tokens which can then be used in reward contracts',
      )
      .option(
        '-v, --private-key [value]',
        'The private key to deploy with (only works in local mode, otherwise set in .env).',
      )
      .option('-y, --yes', 'Dont prompt, just reply yes.')
      .option(
        '-k, --use-fork',
        'Perform the deployment on a forked chain running on localhost (see fork command).',
        false,
      )
      .action(deploy),
};
