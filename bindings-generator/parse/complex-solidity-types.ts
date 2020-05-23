

import { SolidityType, StateMutability } from './solidity-types';

export interface SolidityParameter {
    name: string;
    type: SolidityType;
}

export interface SolidityOutputParameter {
    name?: string;
    type: SolidityType;
}

export interface SolidityFunction {
    name: string;
    mutability: StateMutability;
    inputs: Array<SolidityParameter>;
    outputs: Array<SolidityOutputParameter>;
}

export interface SolidityEventArgument {
    name: string;
    isIndexed: boolean;
    type: SolidityType;
}

export interface SolidityEvent {
    name: string;
    inputs: Array<SolidityEventArgument>;
}

export interface Constructor {
    name: string;
    mutability: StateMutability;
    inputs: Array<SolidityParameter>;
}

export interface Contract {
    name: string;
    constructors: Array<Constructor>;
    functions: Map<string, SolidityFunction>;
    events: Map<string, SolidityEvent>;
    abiString: string;
    bytecode: string;
}
