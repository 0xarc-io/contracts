import { Contract, providers } from 'ethers';

export async function getEvent(
  txPromise:
    | Promise<providers.TransactionResponse>
    | providers.TransactionResponse,
  contract: Contract,
  eventName: string,
) {
  const tx = await txPromise;
  const receipt = await contract.provider.getTransactionReceipt(tx.hash);
  const eventFragment = contract.interface.getEvent(eventName);
  const topic = contract.interface.getEventTopic(eventFragment);
  const logs = receipt.logs.filter((log) => log.topics.includes(topic));
  if (logs.length === 0) {
    throw Error(`Event ${eventName} was not emmited`);
  }
  return contract.interface.parseLog(logs[0]);
}
