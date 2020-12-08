import 'module-alias/register';

import { task } from 'hardhat/config';
import { red, yellow, green, magenta } from 'chalk';
import { asyncForEach } from '@src/utils/asyncForEach';
import { OwnableFactory } from '@src/typings/OwnableFactory';
import { AdminableFactory, ArcProxyFactory } from '@src/typings';

task('transfer-ownership', 'Transfer ownership of deployed contracts')
  .addParam('addresses', 'The addresses you would like to transfer ownership for')
  .setAction(async (taskArgs, hre) => {
    const addresses = taskArgs.addresses;

    const signer = (await hre.ethers.getSigners())[0];
    const network = hre.network.name;
    const networkObject = hre.config.networks[network];

    const ultimateOwner = networkObject['users'].owner.toLowerCase();

    await asyncForEach(addresses.split(','), async (address) => {
      const contract = OwnableFactory.connect(address, signer);

      if ((await contract.owner()).toLowerCase() != ultimateOwner) {
        console.log(yellow(`Changing owner for ${address} to ${ultimateOwner}`));
        try {
          await contract.transferOwnership(ultimateOwner);
          console.log(green(`Owner changed for ${address}`));
        } catch (e) {
          console.log(red(`Owner already set for ${address}`));
        }
      } else {
        console.log(magenta(`Owner has already been set for ${address}`));
      }
    });
  });

task('change-admin', 'Transfer ownership of deployed contracts')
  .addParam('addresses', 'The addresses you would like to transfer ownership for')
  .setAction(async (taskArgs, hre) => {
    const addresses = taskArgs.addresses;

    const signer = (await hre.ethers.getSigners())[0];
    const network = hre.network.name;
    const networkObject = hre.config.networks[network];

    const ultimateOwner = networkObject['users'].owner.toLowerCase();

    await asyncForEach(addresses.split(','), async (address) => {
      const contract = AdminableFactory.connect(address, signer);

      if ((await (await contract.getAdmin()).toLowerCase()) != ultimateOwner) {
        console.log(yellow(`Changing admin for ${address} to ${ultimateOwner}`));
        try {
          await ArcProxyFactory.connect(address, signer).changeAdmin(ultimateOwner);
          console.log(green(`Admin changed for ${address}`));
        } catch (e) {
          console.log(red(`Admin already set for ${address}`));
        }
      } else {
        console.log(magenta(`Admin has already been set for ${address}`));
      }
    });
  });
