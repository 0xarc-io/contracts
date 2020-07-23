import { Provider } from 'ethers/providers';
import fs from 'fs-extra';

import { returnValidAddresses } from '../utils/returnValidAddresses';

export type AddressBook = {
  stateV1?: string;
  proxy?: string;
  coreV1?: string;
  syntheticToken?: string;
  oracle?: string;
  interestSetter?: string;
  stableAsset?: string;
};

export async function retrieveAddressBookFrom(path, provider: Provider): Promise<AddressBook> {
  await fs.ensureFile(path);
  const jsonFile = (await fs.readJson(path, { throws: false })) || {};
  return returnValidAddresses(jsonFile, provider);
}
