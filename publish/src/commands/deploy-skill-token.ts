'use strict';

import { BaseERC20, BaseERC20Factory, SkillsetToken } from '../../../src/typings';
import Deployer from '../Deployer';
import { ethers } from 'ethers';

const path = require('path');
const { gray, green, yellow } = require('chalk');

const { loadCompiledFiles, getLatestSolTimestamp } = require('../solidity');

const {
  ensureNetwork,
  ensureDeploymentPath,
  getDeploymentPathForNetwork,
  loadAndCheckRequiredSources,
  loadConnections,
  confirmAction,
  parameterNotice,
} = require('../util');

const {
  getUsers,
  constants: { BUILD_FOLDER, CONTRACTS_FOLDER, STAKING_REWARDS_FILENAME, DEPLOYMENT_FILENAME },
} = require('../../../.');

const DEFAULTS = {
  gasPrice: '1',
  methodCallGasLimit: 250e3, // 250k
  contractDeploymentGasLimit: 6.9e6, // TODO split out into seperate limits for different contracts, Proxys, Synths, Synthetix
  network: 'kovan',
  buildPath: path.join(__dirname, '..', '..', '..', BUILD_FOLDER),
};

const deploySkillToken = async ({
  tokenName = '',
  tokenSymbol = '',
  gasPrice = DEFAULTS.gasPrice,
  methodCallGasLimit = DEFAULTS.methodCallGasLimit,
  contractDeploymentGasLimit = DEFAULTS.contractDeploymentGasLimit,
  network = DEFAULTS.network,
  buildPath = DEFAULTS.buildPath,
  deploymentPath = '',
  privateKey = '',
  yes = false,
  dryRun = false,
} = {}) => {
  ensureNetwork(network);
  deploymentPath = deploymentPath || getDeploymentPathForNetwork(network);
  ensureDeploymentPath(deploymentPath);

  const {
    stakingRewards,
    stakingRewardsFile,
    deployment,
    deploymentFile,
  } = loadAndCheckRequiredSources({
    deploymentPath,
    network,
  });

  console.log(gray('Loading the compiled contracts locally...'));
  const { earliestCompiledTimestamp, compiled } = loadCompiledFiles({ buildPath });

  // now get the latest time a Solidity file was edited
  const latestSolTimestamp = getLatestSolTimestamp(CONTRACTS_FOLDER);

  const { providerUrl, privateKey: envPrivateKey, etherscanLinkPrefix } = loadConnections({
    network,
  });

  // allow local deployments to use the private key passed as a CLI option
  if (network !== 'local' || !privateKey) {
    privateKey = envPrivateKey;
  }

  const deployer = new Deployer({
    compiled,
    contractDeploymentGasLimit,
    config: {},
    configFile: null, // null configFile so it doesn't overwrite config.json
    deployment,
    deploymentFile,
    gasPrice,
    methodCallGasLimit,
    network,
    privateKey,
    providerUrl,
    dryRun,
    useFork: false,
  });

  const { account } = deployer;

  parameterNotice({
    'Dry Run': dryRun ? green('true') : yellow('⚠ NO'),
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
    'Token Name': tokenName,
    'Token Symbol': tokenSymbol,
    'Deployer account:': account,
  });

  if (!yes) {
    try {
      await confirmAction(
        yellow(`⚠⚠⚠ WARNING: This action will deploy ${tokenName} / ${tokenSymbol} to ${network}`) +
          gray('-'.repeat(50)) +
          '\nDo you want to continue? (y/n) ',
      );
    } catch (err) {
      console.log(gray('Operation cancelled'));
      return;
    }
  }

  console.log(gray(`Starting deployment to ${network.toUpperCase()} via Infura...`));

  const newToken = await SkillsetToken.awaitDeployment(deployer.account, tokenName, tokenSymbol, {
    gasPrice: ethers.utils.parseUnits(gasPrice, 'gwei'),
  });

  console.log(green(`\nSuccessfully deployed ${tokenName} at ${newToken.address}\n`));
};

module.exports = {
  deploySkillToken,
  DEFAULTS,
  cmd: (program) =>
    program
      .command('deploy-skill-token')
      .description('Deploy skillset token')
      .option('-tn, --token-name <value>')
      .option('-ts, --token-symbol <value>')
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
        `Path to a folder that has the rewards file ${STAKING_REWARDS_FILENAME} and where your ${DEPLOYMENT_FILENAME} files will go`,
      )
      .option('-g, --gas-price <value>', 'Gas price in GWEI', DEFAULTS.gasPrice)
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
      .action(deploySkillToken),
};
