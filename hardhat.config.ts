import fs from 'fs';

import { HardhatUserConfig } from 'hardhat/config';
import { BigNumber } from 'ethers';
import { privateKeys } from './test/helpers/generatedWallets';

import 'hardhat-preprocessor';
import 'hardhat-spdx-license-identifier';
import 'hardhat-contract-sizer';
import 'hardhat-typechain';
import 'hardhat-watcher';

import 'solidity-coverage';

import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-etherscan';

import './tasks/type-extensions';

if (fs.existsSync('src/typings/BaseErc20Factory.ts')) {
  /* eslint-disable @typescript-eslint/no-var-requires */
  require('./tasks');
}

require('dotenv').config({ path: '.env' }).parsed;

export const params = {
  testnet_private_key: process.env.TESTNET_DEPLOY_PRIVATE_KEY || '',
  deploy_private_key: process.env.DEPLOY_PRIVATE_KEY || '',
  infura_key: process.env.INFURA_PROJECT_ID || '',
  etherscan_key: process.env.ETHERSCAN_KEY || '',
  mainnet_alchemy_url: process.env.MAINNET_ALCHEMY || '',
};

export function getNetworkUrl(network: string) {
  let prefix = '';

  if (network === 'mumbai' || network === 'polygon') {
    prefix = 'polygon-';
  } else if (network === 'mainnet') {
    return params.mainnet_alchemy_url;
  }

  return `https://${prefix}${network}.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;
}

const HUNDRED_THOUSAND_ETH = BigNumber.from(100000).pow(18).toString();

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    version: '0.8.4',
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
      users: {
        eoaOwner: '0xAF36712cb4ebD3BD706E898F5703ce3Ca96E8982',
      },
    },
    coverage: {
      url: 'http://127.0.0.1:8555', // Coverage launches its own ganache-cli client
    },
    rinkeby: {
      url: getNetworkUrl('rinkeby'),
      accounts: [params.testnet_private_key],
      gasPrice: 2 * 10 ** 9,
      users: {
        eoaOwner: '0xa8C01EfD74A206Bb2d769b6b3a5759508c83F20C',
      },
    },
    mumbai: {
      url: getNetworkUrl('mumbai'),
      accounts: [params.testnet_private_key],
      users: {
        eoaOwner: '0xa8C01EfD74A206Bb2d769b6b3a5759508c83F20C',
      },
    },
    fuji: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      chainId: 43113,
      accounts: [params.testnet_private_key],
      users: {
        eoaOwner: '0xa8C01EfD74A206Bb2d769b6b3a5759508c83F20C',
      },
    },
    avalanche: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      chainId: 43114,
      accounts: [params.deploy_private_key],
      users: {
        eoaOwner: '0x62f31e08e279f3091d9755a09914df97554eae0b',
        multisigOwner: '0x859a95b2b50c1fc25560a2c6dad5b3d0ba34b6e9',
        arcxDeployer: '0x9c767178528c8a205df63305ebda4bb6b147889b',
      },
    },
    mainnet: {
      url: getNetworkUrl('mainnet'),
      accounts: [params.deploy_private_key],
      users: {
        eoaOwner: '0x62f31e08e279f3091d9755a09914df97554eae0b',
        multisigOwner: '0x859a95b2b50c1fc25560a2c6dad5b3d0ba34b6e9',
        arcxDeployer: '0x9c767178528c8a205df63305ebda4bb6b147889b',
      },
    },
    playnet: {
      url: getNetworkUrl('mainnet'),
      accounts: [params.deploy_private_key],
      gasPrice: 119 * 10 ** 9,
      users: {
        eoaOwner: '0x9c767178528c8a205DF63305ebdA4BB6B147889b',
        multisigOwner: '0xFe1AaAAEc2cFd70E89037F489d4eB362a169631e',
      },
    },
  },
  typechain: {
    outDir: './src/typings',
    target: 'ethers-v5',
  },
  etherscan: {
    apiKey: params.etherscan_key,
  },
  // watcher: {
  //   compilation: {
  //     tasks: ["compile"],
  //     files: ["./contracts"],
  //     verbose: true,
  //   },
  //   ci: {
  //     tasks: ["clean", { command: "compile", params: { quiet: true } }, { command: "test", params: { noCompile: true, testFiles: ["./.ts"] } } ],
  //   }
  // },
};

export default config;
