import fs from 'fs-extra';

import { CoreStage } from './core';
import { ethers } from 'ethers';
import { getConfig } from '../src/addresses/Config';
import { AddressBook } from '../src/addresses/AddressBook';
import { Provider } from 'ethers/providers';
import { returnValidAddresses } from '../src/utils/returnValidAddresses';

require('dotenv').config({ path: '.env' }).parsed;

export const params = {
  private_key: process.env.PRIVATE_KEY,
  network_id: parseInt(process.env.DEPLOYMENT_NETWORK_ID),
  network_env: `${process.env.DEPLOYMENT_ENVIRONMENT}`,
  rpc_url: process.env.RPC_ENDPOINT,
};

async function start() {
  const args = require('minimist')(process.argv.slice(2));

  const provider = new ethers.providers.JsonRpcProvider(params.rpc_url, params.network_id);
  const wallet = new ethers.Wallet(params.private_key, provider);
  const path = `${__dirname}/../src/addresses/${params.network_id}.json`;

  let addressBook = await retrieveAddressBookFrom(path, provider);

  let config = getConfig(params.network_id);
  config.name = args.name;
  config.symbol = args.symbol;
  config.owner = args.owner || wallet.address;

  if (!config.name || !config.symbol) {
    throw 'Must provide a name and symbol for the token';
  }

  const coreStage = new CoreStage(wallet, addressBook, config);
  addressBook = await coreStage.deployAll();

  await fs.writeFile(path, JSON.stringify(addressBook, null, 2));
}

export async function retrieveAddressBookFrom(
  path: string,
  provider: Provider,
): Promise<AddressBook> {
  await fs.ensureFile(path);
  const jsonFile = (await fs.readJson(path, { throws: false })) || {};
  return returnValidAddresses(jsonFile, provider);
}

start().catch((e: Error) => {
  console.error(e);
  process.exit(1);
});
