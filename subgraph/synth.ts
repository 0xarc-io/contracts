import {
  SynthAdded as SynthAddedV1,
  SynthRegistry,
} from '../generated/SynthRegistry/SynthRegistry';

import { SynthAdded as SynthAddedV2 } from '../generated/SynthRegistryV2/SynthRegistryV2';

import {
  BaseERC20 as BaseERC20Template,
  StateV1 as StateV1Template,
  CoreV1 as CoreV1Template,
  MozartV1 as MozartV1Template,
} from '../generated/templates';

import { CoreV1 } from '../generated/templates/CoreV1/CoreV1';

import { Address, log } from '@graphprotocol/graph-ts';
import { returnSynthVersion } from './constants';
import { BaseERC20 } from '../generated/SynthRegistry/BaseERC20';

export function synthV1Added(event: SynthAddedV1): void {
  let synthRegistryContract = SynthRegistry.bind(event.address);
  let synthDetails = synthRegistryContract.synthsByAddress(event.params.synth);

  let tokenContract = BaseERC20.bind(event.params.synth);
  let synthVersion = returnSynthVersion(tokenContract.name());

  if (synthVersion != 1) {
    log.info(`Teminated indexing: {} {}`, [tokenContract.name(), synthVersion.toString()]);
    return;
  }

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

  if (
    event.params.synth.equals(Address.fromString('0xb40d0e40adaac7302d820fbb9544769696c3077d')) ||
    event.params.proxy.equals(Address.fromString('0x50e625821435e953acd82df154fdb5c7173d35df'))
  ) {
    return;
  }

  BaseERC20Template.create(event.params.synth);
  MozartV1Template.create(event.params.proxy);
}
