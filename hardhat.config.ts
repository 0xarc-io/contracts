import fs from 'fs';

import { HardhatUserConfig } from 'hardhat/config';

import 'hardhat-preprocessor';
import 'hardhat-spdx-license-identifier';
import 'hardhat-contract-sizer';
import 'hardhat-typechain';
import 'hardhat-watcher';

import 'solidity-coverage';

import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-ethers';

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
  etherscan_key: process.env.MAINNET_ETHERSCAN_KEY || '',
  polygon_mumbai_etherscan_key: process.env.MUMBAI_ETHERSCAN_KEY || '',
  mainnet_alchemy_url: process.env.MAINNET_ALCHEMY || '',
};

export function getNetworkUrl(network: string) {
  if (network === 'mainnet') {
    return params.mainnet_alchemy_url;
  }

  let prefix = '';

  switch (network) {
    case 'mumbai':
      prefix = 'polygon-mumbai';
      break;
    case 'polygon':
      if (!process.env.POLYGON_ALCHEMY) {
        throw new Error(`POLYGON_ALCHEMY env var is not set`);
      }

      return process.env.POLYGON_ALCHEMY;
    case 'mainnet':
    case 'rinkeby':
      prefix = network;
      break;
    default:
      throw new Error(`Unsupported network: ${network}`);
  }

  return `https://${prefix}.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;
}

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    compilers: [
      {
        version: '0.8.10',
      },
      {
        version: '0.8.4',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {},
    local: {
      url: 'http://127.0.0.1:8545',
      accounts: [params.deploy_private_key],
      users: {
        eoaOwner: '0xAF36712cb4ebD3BD706E898F5703ce3Ca96E8982',
      },
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
    mainnet: {
      url: getNetworkUrl('mainnet'),
      accounts: [params.deploy_private_key],
      users: {
        eoaOwner: '0x62f31e08e279f3091d9755a09914df97554eae0b',
        multisigOwner: '0x859a95b2b50c1fc25560a2c6dad5b3d0ba34b6e9',
        arcxDeployer: '0x9c767178528c8a205df63305ebda4bb6b147889b',
        guardian: '0xc434C28Da5940462213C0057660a7132337205c1',
      },
    },
    polygon: {
      url: getNetworkUrl('polygon'),
      accounts: [params.deploy_private_key],
      users: {
        arcxDeployer: '0x9c767178528c8a205df63305ebda4bb6b147889b',
        guardian: '0xC033F3488584F4c929b2D78326f0Fb84CbC7d525',
        multisigOwner: '0xE4b3F2E082356f5430bd883A22186a6DDE36952D',
      },
    },
  },
  typechain: {
    outDir: './src/typings',
    target: 'ethers-v5',
  },
  etherscan: {
    apiKey: {
      mainnet: params.etherscan_key,
      polygonMumbai: params.polygon_mumbai_etherscan_key,
      polygon: params.polygon_mumbai_etherscan_key,
    },
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
