import 'module-alias/register';

import fs from 'fs';
import path from 'path';

import { privateKeys } from '@src/utils/generatedWallets';
import { BigNumber } from 'ethers/utils';
import { HardhatUserConfig } from 'hardhat/config';

import { removeConsoleLog } from 'hardhat-preprocessor';

import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import 'hardhat-preprocessor';
import 'hardhat-spdx-license-identifier';
import 'hardhat-contract-sizer';

if (fs.existsSync('src/typings/index.ts')) {
  require('./tasks');
}

require('dotenv').config({ path: '.env' }).parsed;

export const params = {
  private_key: process.env.TESTNET_DEPLOY_PRIVATE_KEY || '',
  rpc_url: process.env.RPC_ENDPOINT || '',
  etherscan_key: process.env.ETHERSCAN_KEY || '',
};

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
      url: params.rpc_url,
      accounts: [params.private_key],
    },
  },
  etherscan: {
    apiKey: params.etherscan_key,
  },
};

export default config;
