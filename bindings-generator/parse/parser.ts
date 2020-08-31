

import { 
    Contract, Constructor, 
    SolidityFunction, SolidityEvent, 
    SolidityOutputParameter, SolidityEventArgument, SolidityParameter 
} from './complex-solidity-types';
import { ABIDefinition, ABIParameter, EventArgABIDefinition } from './abi-types';
import { StateMutability, SolidityType, parseSolidityType } from './solidity-types';
import { Artifact } from '../core/types';

export function parseABI(artifact: Artifact): Contract {

    let constructors: Array<Constructor> = [];
    let functions: Array<SolidityFunction> = [];
    let events: Array<SolidityEvent> = [];
    let fallback: SolidityFunction;

    artifact.abi.forEach(definition => {
        switch (definition.type) {
            case "constructor":
                constructors.push(parseConstructor(definition));
                break;
            case "function":
                functions.push(parseFunction(definition));
                break;
            case "event":
                events.push(parseEvent(definition));
                break;
            case "fallback":
                fallback = parseFallback(definition);
                break;
            default:
                throw new Error('Unrecognised ABI Element Type: ' + definition.type);
        }
    });

    return { 
        name: artifact.name,
        constructors: constructors,
        functions: mapify(functions),
        events: mapify(events),
        abiString: JSON.stringify(artifact.abi),
        bytecode: artifact.bytecode
    }
}

function mapify(fns: Array<{name: string}>) {
    let map = new Map();
    fns.forEach(fn => map.set(fn.name, fn));
    return map;
}

function parseFunction(def: ABIDefinition): SolidityFunction {
    return {
        name: def.name,
        inputs: def.inputs.map(parseRawABIParameter),
        outputs: parseOutputs(def.outputs),
        mutability: determineStateMutability(def),
    };
}

function parseRawEventArg(eventArg: EventArgABIDefinition): SolidityEventArgument {
    return {
        name: eventArg.name,
        isIndexed: eventArg.indexed,
        type: parseRawABIParameterType(eventArg),
    };
}

function parseConstructor(def: ABIDefinition): Constructor {
    return {
        name: "constructor",
        inputs: def.inputs.map(parseRawABIParameter),
        mutability: determineStateMutability(def),
    };
}

function parseFallback(def: ABIDefinition): SolidityFunction {
    return {
      name: "fallback",
      inputs: [],
      outputs: parseOutputs(def.outputs),
      mutability: determineStateMutability(def),
    };
}

function parseEvent(def: ABIDefinition): SolidityEvent {
    return {
        name: def.name,
        inputs: def.inputs.map(parseRawEventArg)
    }
}

function parseOutputs(outputs: Array<ABIParameter>): Array<SolidityOutputParameter> {
    if (!outputs || outputs.length === 0) {
        return [{ name: "", type: { type: "void" } }];
    } else {
        return outputs.map(parseRawABIParameter);
    }
}

function determineStateMutability(def: ABIDefinition): StateMutability {
    if (def.stateMutability) {
        return def.stateMutability;
    }
    if (def.constant) {
        return "view";
    }
    return def.payable ? "payable" : "nonpayable";
}

function parseRawABIParameter(param: ABIParameter): SolidityParameter {
    return {
        name: param.name,
        type: parseRawABIParameterType(param),
    };
}
  
function parseRawABIParameterType(param: ABIParameter): SolidityType {
    const components =
      param.components &&
      param.components.map(component => ({
        name: component.name,
        type: parseRawABIParameterType(component),
      }));
    return parseSolidityType(param.type, components, param.internalType);
}

export function ensure0xPrefix(hex: string): string {
    return hex.startsWith("0x") ? hex : '0x' + hex;
}
  
export function isConstant(fn: SolidityFunction): boolean {
    return (
        (fn.mutability === "pure" || fn.mutability === "view") &&
        fn.inputs.length === 0 &&
        fn.outputs.length === 1
    );
}
  
export function isConstantFn(fn: SolidityFunction): boolean {
    return (fn.mutability === "pure" || fn.mutability === "view") && !isConstant(fn);
}