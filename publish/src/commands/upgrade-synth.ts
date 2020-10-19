'use strict';

import Deployer from '../Deployer';
import { ArcProxy } from '../../../src/typings/ArcProxy';
import { asyncForEach } from '../../../src/utils/asyncForEach';

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

const upgradeSynth = async ({
  synthsToUpgrade = [],
  implementation = '',
  gasPrice = DEFAULTS.gasPrice,
  methodCallGasLimit = DEFAULTS.methodCallGasLimit,
  contractDeploymentGasLimit = DEFAULTS.contractDeploymentGasLimit,
  network = DEFAULTS.network,
  buildPath = DEFAULTS.buildPath,
  deploymentPath = '',
  privateKey = '',
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

  const finalSynthsToUpgrade = synths
    .filter(({ name }) => synthsToUpgrade.includes(name))
    .map(({ name }) => name);

  const implementationContract = getExistingContract({ contract: implementation });

  if (!implementationContract.address) {
    red(`Implementation address not found! Please deploy ${implementation} first.`);
  }

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
    'Upgrading the following synths': `${synthsToUpgrade} to ${implementation} at ${implementationContract.address}`
      ? green('✅ YES\n\t\t\t\t') + finalSynthsToUpgrade.join(', ')
      : yellow('⚠ NO'),
    'Deployer account:': await account.getAddress(),
  });

  if (!yes) {
    try {
      await confirmAction(
        yellow(
          `⚠⚠⚠ WARNING: This action will upgrade the following contracts to ${network}:\n${synthsToUpgrade}` +
            `\nIt will also set proxy targets and add synths to Synthetix.\n`,
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
    gray(`Starting upgrades on ${network.toUpperCase()}${useFork ? ' (fork)' : ''} via Infura...`),
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
  // Synths
  // ----------------
  await asyncForEach(synths, async (synth) => {
    let { name, collateral_address, oracle_source_address } = synth;

    let proxy: ArcProxy = ArcProxy.at(
      deployer.account,
      getExistingContract({ contract: name }).address,
    );

    const data = proxy.interface.functions.upgradeTo.encode([implementationContract.address]);
    await runStep({
      data: data,
      name: `${name}-ArcProxy`,
      contract: proxy,
    });
  });
};

module.exports = {
  upgradeSynth,
  DEFAULTS,
  cmd: (program) =>
    program
      .command('upgrade-synth')
      .description('Upgrade a synth implemenation')
      .option(
        '-s, --synths-to-upgrade <items>',
        `Specify which synths you'd like to upgrade`,
        (v) => v.split(','),
        [],
      )
      .option('-i --implementation <value>', `The name of the implementation contract to set`)
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
        '-v, --private-key [value]',
        'The private key to deploy with (only works in local mode, otherwise set in .env).',
      )
      .option('-y, --yes', 'Dont prompt, just reply yes.')
      .option(
        '-k, --use-fork',
        'Perform the deployment on a forked chain running on localhost (see fork command).',
        false,
      )
      .action(upgradeSynth),
};
