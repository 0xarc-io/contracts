'use strict';

import fs from 'fs';
import { Signer, ethers } from 'ethers';
import { Provider, TransactionRequest } from 'ethers/providers';

const linker = require('solc/linker');
const Web3 = require('web3');
const { gray, green, yellow } = require('chalk');
const { getUsers } = require('../../index.js');

const { stringify } = require('./util');

/**
 *
 */
export default class Deployer {
  compiled: any;
  config: any;
  configFile: any;
  contractDeploymentGasLimit: any;
  deployment: any;
  deploymentFile: any;
  dryRun: any;
  gasPrice: any;
  methodCallGasLimit: any;
  network: any;
  providerUrl: any;
  privateKey: any;
  useFork: any;
  newContractsDeployed: any;
  provider: Provider;
  account: Signer;
  deployedContracts: any;
  updatedConfig: any;
  _dryRunCounter: number;

  /**
   *
   * @param {object} compiled An object with full combined contract name keys mapping to ABIs and bytecode
   * @param {object} config An object with full combined contract name keys mapping to a deploy flag and the contract source file name
   * @param {object} deployment An object with full combined contract name keys mapping to existing deployment addresses (if any)
   */
  constructor({
    compiled,
    config,
    configFile,
    contractDeploymentGasLimit,
    deployment,
    deploymentFile,
    dryRun,
    gasPrice,
    methodCallGasLimit,
    network,
    providerUrl,
    privateKey,
    useFork,
  }) {
    this.compiled = compiled;
    this.config = config;
    this.configFile = configFile;
    this.deployment = deployment;
    this.deploymentFile = deploymentFile;
    this.dryRun = dryRun;
    this.gasPrice = gasPrice;
    this.methodCallGasLimit = methodCallGasLimit;
    this.network = network;
    this.contractDeploymentGasLimit = contractDeploymentGasLimit;

    let networkId = 31337;

    switch (network) {
      case 'mainnet':
        networkId = 1;
        break;
      case 'ropsten':
        networkId = 3;
        break;
      case 'rinkeby':
        networkId = 4;
        break;
      case 'goerli':
        networkId = 5;
        break;
    }

    // Configure Web3 so we can sign transactions and connect to the network.
    this.provider = new ethers.providers.JsonRpcProvider(providerUrl, networkId);
    this.account = new ethers.Wallet(privateKey, this.provider);

    this.deployedContracts = {};
    this._dryRunCounter = 0;

    // Updated Config (Make a copy, don't mutate original)
    this.updatedConfig = JSON.parse(JSON.stringify(config));

    // Keep track of newly deployed contracts
    this.newContractsDeployed = [];
  }

  sendParameters(type = 'method-call') {
    return {
      from: this.account,
      gasLimit: type === 'method-call' ? this.methodCallGasLimit : this.contractDeploymentGasLimit,
      gasPrice: ethers.utils.parseUnits(this.gasPrice, 'gwei'),
    };
  }

  async _deploy({ name, source, dependency, deployData, force = false, dryRun = this.dryRun }) {
    if (!this.config[name] && !force) {
      console.log(yellow(`Skipping ${name} as it is NOT in contract flags file for deployment.`));
      return {
        deployedContract: null,
        hash: null,
      };
    }

    // by default, we deploy if force tells us to
    let deploy = force;

    if (this.config[name]) {
      if (!dependency || dependency == 'Proxy') {
        deploy = this.config[name].deploy;
      } else {
        console.log(this.config[name]);
        console.log(this.config);
        console.log(name);
        deploy = this.config[name].dependencies.hasOwnProperty(dependency)
          ? this.config[name].dependencies[dependency]
          : true;
      }
    }

    const compiled = this.compiled[source];

    let existingAddress;

    if (this.deployment.targets.hasOwnProperty(name)) {
      if (!dependency || dependency == 'Proxy') {
        existingAddress = this.deployment.targets[name]
          ? this.deployment.targets[name].address
          : '';
      } else if (this.deployment.targets[name].dependencies[dependency]) {
        existingAddress = this.deployment.targets[name].dependencies[dependency].address;
      }
    }

    const existingABI = this.deployment.sources[source] ? this.deployment.sources[source].abi : '';

    if (!compiled) {
      throw new Error(
        `No compiled source for: ${name}. The source file is set to ${source}.sol - is that correct?`,
      );
    }

    let deployedContract: ethers.Contract;
    let hash: string;

    if (deploy) {
      console.log(gray(` - Attempting to deploy ${name}`));
      let gasUsed;
      if (dryRun) {
        this._dryRunCounter++;
        // use the existing version of a contract in a dry run
        deployedContract = this.getContract({ abi: compiled.abi, address: existingAddress });
        const { account } = this;
        // but stub out all method calls except owner because it is needed to
        // determine which actions can be performed directly or need to be added to ownerActions
        Object.keys(deployedContract.methods).forEach((key) => {
          deployedContract.methods[key] = () => ({
            call: () => (key === 'owner' ? Promise.resolve(account) : undefined),
          });
        });
        deployedContract.options.address = '0x' + this._dryRunCounter.toString().padStart(40, '0');
      } else {
        const params = this.sendParameters('contract-deployment');

        const txRequest: TransactionRequest = {
          data: deployData,
          gasPrice: params.gasPrice,
          gasLimit: params.gasLimit,
        };

        const tx = await this.account.sendTransaction(txRequest);
        const receipt = await tx.wait();
        gasUsed = receipt.gasUsed;
        hash = receipt.transactionHash;

        deployedContract = await this.getContract({
          abi: compiled.abi,
          address: receipt.contractAddress,
        });
      }

      console.log(
        green(
          `${
            dryRun ? '[DRY RUN] - Simulated deployment of' : '- Deployed'
          } ${name} - ${dependency} to ${deployedContract.address} ${
            gasUsed ? `used ${(gasUsed / 1e6).toFixed(1)}m in gas` : ''
          }`,
        ),
      );
    } else if (existingAddress && existingABI) {
      // get ABI from the deployment (not the compiled ABI which may be newer)
      deployedContract = this.getContract({ abi: existingABI, address: existingAddress });
      console.log(gray(` - Reusing instance of ${name} at ${existingAddress}`));
    } else {
      throw new Error(
        `Settings for contract: ${name} specify an existing contract, but cannot find address or ABI.`,
      );
    }

    // append new deployedContract
    this.deployedContracts[name] = deployedContract;

    return {
      deployedContract,
      hash,
    };
  }

  async _updateResults({ name, source, dependency, hash, deployed, address }) {
    let timestamp = new Date();
    let txn = hash || '';
    if (this.config[name] && !this.config[name].deploy) {
      // deploy is false, so we reused a deployment, thus lets grab the details that already exist
      timestamp = this.deployment.targets[name].timestamp;
    }

    let dependencyValue = {};

    if (this.deployment.targets.hasOwnProperty(name)) {
      if (this.deployment.targets[name].hasOwnProperty('dependencies')) {
        dependencyValue = this.deployment.targets[name].dependencies;
      }
    }

    // If a proxy is being deployed, set it as the root object
    if (!dependency || dependency == 'Proxy') {
      this.deployment.targets[name] = {
        name,
        address,
        source,
        link: `https://${
          this.network !== 'mainnet' ? this.network + '.' : ''
        }etherscan.io/address/${this.deployedContracts[name].address}`,
        timestamp,
        txn,
        network: this.network,
        dependencies: dependencyValue,
      };
    } else {
      if (!this.deployment.targets.hasOwnProperty(name)) {
        this.deployment.targets[name] = {
          dependencies: {},
        };
      }

      // If it's a core or state contract, then nest it inside the dependencies
      this.deployment.targets[name].dependencies[dependency] = {
        dependency,
        address,
        source,
        link: `https://${
          this.network !== 'mainnet' ? this.network + '.' : ''
        }etherscan.io/address/${this.deployedContracts[name].address}`,
        timestamp,
        txn,
        network: this.network,
      };
    }

    if (deployed) {
      // remove the output from the metadata (don't dupe the ABI)
      delete this.compiled[source].metadata.output;

      // track the new source and bytecode
      this.deployment.sources[source] = {
        bytecode: this.compiled[source].evm.bytecode.object,
        abi: this.compiled[source].abi,
        source: Object.values(this.compiled[source].metadata.sources)[0],
        metadata: this.compiled[source].metadata,
      };
      // add to the list of deployed contracts for later reporting
      this.newContractsDeployed.push({
        name,
        address,
      });
    }
    if (!this.dryRun) {
      await fs.writeFileSync(this.deploymentFile, stringify(this.deployment));
    }

    // now update the flags to indicate it no longer needs deployment,
    // ignoring this step for local, which wants a full deployment by default
    if (this.configFile && this.network !== 'local' && !this.dryRun) {
      this.updatedConfig[name] = {
        ...this.updatedConfig[name],
        deploy: false,
      };
      await fs.writeFileSync(this.configFile, stringify(this.updatedConfig));
    }
  }

  async deployContract({
    name,
    source = '',
    deployData,
    dependency = '',
    force = false,
    dryRun = this.dryRun,
  }) {
    // Deploys contract according to configuration
    const { deployedContract, hash } = await this._deploy({
      name,
      source,
      dependency,
      deployData,
      force,
      dryRun,
    });

    if (!deployedContract) {
      return;
    }

    // Updates `config.json` and `deployment.json`, as well as to
    // the local variable newContractsDeployed
    await this._updateResults({
      name,
      source,
      dependency,
      hash,
      deployed: (await deployedContract._deployed()) !== null,
      address: deployedContract.address,
    });

    return deployedContract;
  }

  getContract({ abi, address }) {
    return new ethers.Contract(address, abi, this.account);
  }
}
