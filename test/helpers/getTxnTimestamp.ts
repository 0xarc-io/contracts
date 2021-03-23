import { providers } from 'ethers';

export async function getTxnTimestamp(provider: providers.Provider, transaction): Promise<number> {
  const block = await provider.getBlock((await transaction).blockHash);
  return block.timestamp;
}
