

import { StateMutability } from './solidity-types';

export interface ABIParameter {
  name: string;
  internalType?: string;
  type: string;
  components?: Array<ABIParameter>;
  indexed: boolean;
}

export interface ABIDefinition {
  name: string;
  constant: boolean;
  payable: boolean;
  stateMutability?: StateMutability; // for older ABIs this will be undefined
  inputs: Array<ABIParameter>;
  outputs: Array<ABIParameter>;
  type: string;
}

export interface EventABIDefinition {
  type: "event";
  anonymous: boolean;
  name: string;
  inputs: Array<EventArgABIDefinition>;
}
  
export interface EventArgABIDefinition {
  indexed: boolean;
  name: string;
  type: string;
}
  
