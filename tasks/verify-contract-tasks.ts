import 'module-alias/register';

import shell from 'shelljs';

import { task } from 'hardhat/config';

require('dotenv').config({ path: '.env' }).parsed;

task('verify-contract', 'Verify a contract on Etherscan')
  .addParam('path', 'The path of the contract you would like to verify')
  .addParam('address', 'The address of the contract you want to verify')
  .setAction(async (taskArgs, hre) => {
    const path = taskArgs.path;
    const address = taskArgs.address;

    const pathArray = path.split('/');
    const name = pathArray[pathArray.length - 1].split('.')[0];

    await shell.exec(`solt write ${path}`);
    await shell.exec(
      `solt verify solc-input-${name.toLowerCase()}.json ${address} ${name} --compiler v0.5.16 --etherscan ${
        process.env.ETHERSCAN_KEY
      } --infura ${process.env.INFURA_PROJECT_ID} --network ${
        hre.network.name === 'playnet' ? 'mainnet' : hre.network.name
      }`,
    );
  });
