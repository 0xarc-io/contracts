import { BuidlerConfig, usePlugin } from '@nomiclabs/buidler/config';
import { privateKeys } from './src/utils/generatedWallets';
import { BigNumber } from 'ethers/utils';

usePlugin('@nomiclabs/buidler-etherscan');
usePlugin('buidler-typechain');
usePlugin('solidity-coverage');

const INFURA_API_KEY = '';
const RINKEBY_PRIVATE_KEY = '';
const ETHERSCAN_API_KEY = '';

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
      url: `https://rinkeby.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [RINKEBY_PRIVATE_KEY],
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
    apiKey: ETHERSCAN_API_KEY,
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers',
  },
};

export default config;
