import { BuidlerConfig, usePlugin } from '@nomiclabs/buidler/config';
import { privateKeys } from './src/utils/generatedWallets';
import { BigNumber } from 'ethers/utils';

usePlugin('@nomiclabs/buidler-etherscan');
usePlugin('buidler-typechain');
usePlugin('solidity-coverage');
usePlugin('buidler-spdx-license-identifier');

require('dotenv').config({ path: '.env' }).parsed;

export const params = {
  private_key: process.env.PRIVATE_KEY,
  network_id: parseInt(process.env.DEPLOYMENT_NETWORK_ID),
  network_env: `${process.env.DEPLOYMENT_ENVIRONMENT}`,
  rpc_url: process.env.RPC_ENDPOINT,
  etherscan_key: process.env.ETHERSCAN_KEY,
};

const HUNDRED_ETH = new BigNumber(100).pow(18).toString();

const config: BuidlerConfig = {
  defaultNetwork: 'buidlerevm',
  solc: {
    version: '0.5.16',
    // optimizer: {
    //   runs: 10000,
    // },
  },
  networks: {
    rinkeby: {
      url: params.rpc_url,
      accounts: [params.private_key],
    },
    coverage: {
      url: 'http://127.0.0.1:8555', // Coverage launches its own ganache-cli client
    },
    buidlerevm: {
      hardfork: 'istanbul',
      blockGasLimit: 12500000,
      accounts: privateKeys.map((key) => {
        return {
          privateKey: key,
          balance: HUNDRED_ETH,
        };
      }),
    },
  },
  etherscan: {
    // The url for the Etherscan API you want to use.
    url: 'https://api-rinkeby.etherscan.io/api',
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: params.etherscan_key,
  },
};

export default config;
