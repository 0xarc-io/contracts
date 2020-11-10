import { Address } from '@graphprotocol/graph-ts';
import { Synth } from '../generated/schema';
import { StateV1 } from '../generated/StateV1/StateV1';
import { BASE } from './constants';

export function createOrLoadSynth(address: Address): Synth {
  let stateContract = StateV1.bind(address);
  let coreAddress = stateContract.core();

  let synth = Synth.load(coreAddress.toHex());

  if (synth == null) {
    synth = new Synth(coreAddress.toHex());
    synth.borrowIndex = BASE;
    synth.paused = false;
  }

  return synth as Synth;
}
