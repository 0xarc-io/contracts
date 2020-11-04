import { privateKeys } from './src/utils/generatedWallets';
import { BigNumber } from 'ethers/utils';
import { HardhatUserConfig } from 'hardhat/config';

import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
// import 'solidity-coverage';
import 'hardhat-spdx-license-identifier';

require('dotenv').config({ path: '.env' }).parsed;

export const params = {
  private_key: process.env.PRIVATE_KEY || '',
  network_id: parseInt(process.env.DEPLOYMENT_NETWORK_ID) || 50,
  network_env: `${process.env.DEPLOYMENT_ENVIRONMENT}` || '0.0.0.0:8545',
  rpc_url: process.env.RPC_ENDPOINT || '',
  etherscan_key: process.env.ETHERSCAN_KEY || '',
};

const HUNDRED_THOUSAND_ETH = new BigNumber(100000).pow(18).toString();

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    version: '0.5.16',
    settings: {
      optimizer: {
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
    rinkeby: {
      url: params.rpc_url,
      accounts: [params.private_key],
    },
    coverage: {
      url: 'http://127.0.0.1:8555', // Coverage launches its own ganache-cli client
    },
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
  },
  etherscan: {
    apiKey: params.etherscan_key,
  },
};

export default config;
