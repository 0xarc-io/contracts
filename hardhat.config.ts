import 'module-alias/register';

import fs from 'fs';
import path from 'path';

import { privateKeys } from '@test/helpers/generatedWallets';
import { BigNumber } from 'ethers/utils';
import { HardhatUserConfig } from 'hardhat/config';

import { removeConsoleLog } from 'hardhat-preprocessor';

import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import 'hardhat-preprocessor';
import 'hardhat-spdx-license-identifier';
import 'hardhat-contract-sizer';

import './tasks/type-extensions';

if (fs.existsSync('src/typings/index.ts')) {
  require('./tasks');
}

require('dotenv').config({ path: '.env' }).parsed;

export const params = {
  testnet_private_key: process.env.TESTNET_DEPLOY_PRIVATE_KEY || '',
  infura_key: process.env.INFURA_PROJECT_ID || '',
  etherscan_key: process.env.ETHERSCAN_KEY || '',
};

export function getNetworkUrl(network: string) {
  return `https://${network}.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;
}

const HUNDRED_THOUSAND_ETH = new BigNumber(100000).pow(18).toString();

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  preprocess: {
    eachLine: removeConsoleLog(
      (bre) => bre.network.name !== 'hardhat' && bre.network.name !== 'localhost',
    ),
  },
  solidity: {
    version: '0.5.16',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {
      hardfork: 'istanbul',
      blockGasLimit: 12500000,
      accounts: privateKeys.map((key) => {
        return {
          privateKey: key,
          balance: HUNDRED_THOUSAND_ETH,
        };
      }),
    },
    local: {
      url: 'http://127.0.0.1:8545',
    },
    coverage: {
      url: 'http://127.0.0.1:8555', // Coverage launches its own ganache-cli client
    },
    rinkeby: {
      url: getNetworkUrl('rinkeby'),
      accounts: [params.testnet_private_key],
    },
    mainnet: {
      url: getNetworkUrl('mainnet'),
      accounts: [params.testnet_private_key],
      users: {
        owner: '0x62f31e08e279f3091d9755a09914df97554eae0b',
      },
    },
  },
  etherscan: {
    apiKey: params.etherscan_key,
  },
};

export default config;
