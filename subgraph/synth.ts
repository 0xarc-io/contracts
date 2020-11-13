import { SynthAdded, SynthRegistry } from '../generated/SynthRegistry/SynthRegistry';
import {
  SynthAdded as SynthAddedV2,
  SynthRegistryV2,
} from '../generated/SynthRegistryV2/SynthRegistryV2';

import {
  BaseERC20 as BaseERC20Template,
  StateV1 as StateV1Template,
  CoreV1 as CoreV1Template,
  D2CoreV1 as D2CoreV1Template,
} from '../generated/templates';

import { CoreV1 } from '../generated/templates/CoreV1/CoreV1';

import { log } from '@graphprotocol/graph-ts';

export function synthV1Added(event: SynthAdded): void {
  let synthRegistryContract = SynthRegistry.bind(event.address);
  let synthDetails = synthRegistryContract.synthsByAddress(event.params.synth);

  BaseERC20Template.create(event.params.synth);
  let proxyAddress = synthDetails.value1;

  log.info('Version indexing: 1', []);
  CoreV1Template.create(proxyAddress);
  let coreContract = CoreV1.bind(proxyAddress);
  let stateAddress = coreContract.state();
  StateV1Template.create(stateAddress);
}

export function synthV2Added(event: SynthAddedV2): void {
  log.info('Version indexing: 2', []);

  BaseERC20Template.create(event.params.synth);
  D2CoreV1Template.create(event.params.proxy);
}
