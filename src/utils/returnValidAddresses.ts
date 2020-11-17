import { Provider } from 'ethers/providers';
import { asyncForEach } from './asyncForEach';

export async function returnValidAddresses(addresses: any, provider: Provider) {
  const filteredAddresses = {};

  await asyncForEach(Object.entries(addresses), async (object) => {
    const address: string = object[1].toString();
    const code = await provider.getCode(address);
    if (code.length > 3) {
      filteredAddresses[object[0]] = object[1];
    }
  });

  return filteredAddresses;
}
