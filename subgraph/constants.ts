import { BigInt } from '@graphprotocol/graph-ts';

export let BASE = BigInt.fromI32(10).pow(18);

export function returnSynthVersion(name: string): number {
  if (name == 'LINKUSD') {
    return 1;
  }

  return 2;
}
