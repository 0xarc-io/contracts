import 'module-alias/register';

import { task } from 'hardhat/config';
import { red, yellow, green, magenta } from 'chalk';
import { asyncForEach } from '@src/utils/asyncForEach';
import { OwnableFactory } from '@src/typings/OwnableFactory';
import { AdminableFactory, ArcProxyFactory, ArcxTokenV2Factory } from '@src/typings';
import { loadDetails } from '../deployments/src';

task('transfer-ownership-single', 'Transfer ownership of a single contract')
  .addParam('contract', 'The address of the contract')
  .addParam('to', 'The new owner')
  .addOptionalParam('other', 'The target contract to call "transferOtherOwnership"')
  .setAction(async (taskArgs, hre) => {
    const contractAddy = taskArgs.contract
    const newOwner = taskArgs.to
    const targetContract = taskArgs.other

    const { signer } = await loadDetails(hre);

    let contract = OwnableFactory.connect(contractAddy, signer)

    console.log(yellow(`Changing owner for ${contractAddy} to ${newOwner}...`))
    
    let tx: any

    if (targetContract) {
      contract = ArcxTokenV2Factory.connect(contractAddy, signer)
      tx = await contract.transferOtherOwnership(targetContract, newOwner)
    } else {
      tx = await contract.transferOwnership(newOwner)
    }
    await tx.wait()

    console.log(green(`Contract owner changed`))
  })

task('transfer-ownership', 'Transfer ownership of deployed contracts')
  .addParam('addresses', 'The addresses you would like to transfer ownership for')
  .setAction(async (taskArgs, hre) => {
    const addresses = taskArgs.addresses;

    const signer = (await hre.ethers.getSigners())[0];
    const network = hre.network.name;
    const networkObject = hre.config.networks[network];

    let ultimateOwner =
      networkObject['users']['multisigOwner'] ||
      networkObject['users']['eoaOwner'] ||
      signer.address;

    ultimateOwner = ultimateOwner.toLowerCase();

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

    let ultimateOwner =
      networkObject['users']['multisigOwner'] ||
      networkObject['users']['eoaOwner'] ||
      signer.address;

    ultimateOwner = ultimateOwner.toLowerCase();

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
