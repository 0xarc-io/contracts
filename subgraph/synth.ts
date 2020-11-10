import { SynthAdded, SynthRegistry } from '../generated/SynthRegistry/SynthRegistry';
import {
  BaseERC20 as BaseERC20Template,
  StateV1 as StateV1Template,
  CoreV1 as CoreV1Template,
  D2CoreV1 as D2CoreV1Template,
} from '../generated/templates';
import { BaseERC20 } from '../generated/templates/BaseERC20/BaseERC20';
import { returnSynthVersion } from './constants';
import { CoreV1 } from '../generated/templates/CoreV1/CoreV1';

export function synthAdded(event: SynthAdded): void {
  let synthRegistryContract = SynthRegistry.bind(event.address);
  let synthDetails = synthRegistryContract.synthsByAddress(event.params.synth);

  BaseERC20Template.create(event.params.synth);
  let tokenContract = BaseERC20.bind(event.params.synth);

  let indexVersion = returnSynthVersion(tokenContract.symbol());
  let proxyAddress = synthDetails.value1;

  if (indexVersion == 1) {
    CoreV1Template.create(proxyAddress);
    let coreContract = CoreV1.bind(proxyAddress);
    let stateAddress = coreContract.state();
    StateV1Template.create(stateAddress);
  }

  if (indexVersion == 2) {
    D2CoreV1Template.create(proxyAddress);
  }
}
