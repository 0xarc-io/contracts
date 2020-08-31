
import { Contract, SolidityFunction, SolidityOutputParameter, SolidityParameter, SolidityEvent, SolidityEventArgument } from "../parse/complex-solidity-types";
import { SolidityType, TupleType } from "../parse/solidity-types";
import { isConstant, isConstantFn } from "../parse/parser";
import { TSFile } from "./types";

function hasConstructorParameters(contract: Contract): boolean {
  const cs = contract.constructors;
  return cs.length > 0 && cs[0].inputs.length > 0;
}

export function generateEthers(contract: Contract): TSFile {

  const constructorInputTypes = hasConstructorParameters(contract) ? ', ' + generateInputTypes(contract.constructors[0].inputs) : '';
  const constructorInputTypeNames = hasConstructorParameters(contract) ? getInputTypeNames(contract.constructors[0].inputs) : '';

  const constructorCallNames = constructorInputTypeNames.length > 0 ? ', ' + constructorInputTypeNames : '';

  return {
    name: contract.name + '.ts',
    body: `
import { Contract, ContractFactory, ContractTransaction, EventFilter, Signer } from "ethers";
import { Listener, Provider } from 'ethers/providers';
import { Arrayish, BigNumber, BigNumberish, Interface, UnsignedTransaction, getContractAddress } from "ethers/utils";
import { 
  TransactionOverrides, TypedFunctionDescription, TypedEventDescription, 
  awaitContractDeployment, DeploymentOverrides
} from ".";

interface ${contract.name}Interface extends Interface {
  functions: {
    ${Array.from(contract.functions.values()).map(generateInterfaceFunctionDescription).join('\n')}
  };
  events: {
    ${Array.from(contract.events.values()).map(generateInterfaceEventDescription).join('\n')}
  };
}

export interface ${contract.name} extends Contract {

  interface: ${contract.name}Interface;
  connect(signerOrProvider: Signer | Provider | string): ${contract.name};
  attach(addressOrName: string): ${contract.name};
  deployed(): Promise<${contract.name}>;
  on(event: EventFilter | string, listener: Listener): ${contract.name};
  once(event: EventFilter | string, listener: Listener): ${contract.name};
  addListener(eventName: EventFilter | string, listener: Listener): ${contract.name};
  removeAllListeners(eventName: EventFilter | string): ${contract.name};
  removeListener(eventName: any, listener: Listener): ${contract.name};

  ${Array.from(contract.functions.values()).map(generateFunction).join('\n')}

  ${Array.from(contract.events.values()).map(generateEvent).join('\n')}

  estimate: {
      ${Array.from(contract.functions.values()).map(generateEstimateFunction).join('\n')}
  };
}

export class ${contract.name} {

  public static at(signer: Signer, addressOrName: string): ${contract.name} {
      return this.getFactory(signer).attach(addressOrName) as ${contract.name};
  }

  public static deploy(signer: Signer${constructorInputTypes}): Promise<${contract.name}> {
    return this.getFactory(signer).deploy(${constructorInputTypeNames}) as Promise<${contract.name}>;
  }

  public static getDeployTransaction(signer: Signer${constructorInputTypes}): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction(${constructorInputTypeNames});
  }

  public static async awaitDeployment(signer: Signer${constructorInputTypes}, overrides?: DeploymentOverrides): Promise<${contract.name}> {
    const tx = ${contract.name}.getDeployTransaction(signer${constructorCallNames});
    return awaitContractDeployment(signer, ${contract.name}.ABI, tx, overrides);
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI = '${contract.abiString}';
  public static Bytecode = '${contract.bytecode}';
 
}`
  };
}

function generateFunction(fn: SolidityFunction): string {
  const outputTypes = fn.mutability === "pure" || fn.mutability === "view" ? generateOutputTypes(fn.outputs) : "ContractTransaction";
  let input = generateInputTypes(fn.inputs);
  if (!isConstant(fn) && !isConstantFn(fn)) {
    input += (input.length > 0) ? ', ' : '';
    input += 'overrides?: TransactionOverrides';
  }
  return `${fn.name}(${input}): Promise<${outputTypes}>;`;
}

function generateInputTypes(input: Array<SolidityParameter>): string {
    if (input.length === 0) {
      return "";
    }
    return input
        .map((input, index) => `${input.name || `arg${index}`}: ${generateInputType(input.type)}`)
        .join(", ");
}

function getInputTypeNames(input: Array<SolidityParameter>): string {
  if (input.length === 0) {
    return "";
  }
  return input.map(i => i.name).join(', ');
}

function generateEstimateFunction(fn: SolidityFunction): string {
    return `${fn.name}(${generateInputTypes(fn.inputs)}): Promise<BigNumber>;`;
}

function generateEvent(event: SolidityEvent) {
    return `${event.name}(${generateEventTypes(event.inputs)}): EventFilter;`;
}

function generateEventTypes(eventArgs: Array<SolidityEventArgument>) {
    if (eventArgs.length === 0) {
        return "";
    }
    return (
      eventArgs
        .map(arg => `${arg.name}: ${generateEventArgType(arg)}`)
        .join(", ")
    );
}

function generateEventArgType(eventArg: SolidityEventArgument): string {
    return eventArg.isIndexed ? `${generateInputType(eventArg.type)} | null` : "null";
}

function generateOutputTypes(outputs: Array<SolidityOutputParameter>): string {
    if (outputs.length === 1) {
      return generateOutputType(outputs[0].type);
    } else {
      return `{ 
        ${outputs.map(t => t.name && `${t.name}: ${generateOutputType(t.type)}, `).join("")}
        ${outputs.map((t, i) => `${i}: ${generateOutputType(t.type)}`).join(", ")}
        }`;
    }
}

function generateOutputType(evmType: SolidityType): string {
    switch (evmType.type) {
      case "int":
      case "uint":
        return evmType.bits <= 48 ? "number" : "BigNumber";
      case "address":
        return "string";
      case "void":
        return "void";
      case "bytes":
      case "dynamic-bytes":
        return "string";
      case "array":
        return `(Array<${generateOutputType(evmType.itemType)}>)`;
      case "boolean":
        return "boolean";
      case "string":
        return "string";
      case "tuple":
        return generateTupleType(evmType, generateOutputType);
    }
    return '';
}

function generateInputType(type: SolidityType): string {
    switch (type.type) {
        case "int":
            return "BigNumberish";
        case "uint":
            return "BigNumberish";
        case "address":
            return "string";
        case "bytes":
        case "dynamic-bytes":
            return "Arrayish";
        case "array":
            return `(Array<${generateInputType(type.itemType)}>)`;
        case "boolean":
            return "boolean";
        case "string":
            return "string";
        case "void":
            return "void";
        case "tuple":
            return generateTupleType(type, generateInputType);
    }
    return '';
}

function generateTupleType(tuple: TupleType, generator: (evmType: SolidityType) => string) {
    return (
      "{" +
      tuple.components
        .map(component => `${component.name}: ${generator(component.type)}`)
        .join(", ") +
      "}"
    );
}

function generateInterfaceFunctionDescription(fn: SolidityFunction): string {
  return `
  ${fn.name}: TypedFunctionDescription<{ encode(${generateParamArrayNames(
    fn.inputs,
  )}: ${generateParamArrayTypes(fn.inputs)}): string; }>;
`;
}

function generateParamArrayTypes(params: Array<SolidityParameter>): string {
  return `[${params.map(param => generateInputType(param.type)).join(", ")}]`;
}

function generateParamNames(params: Array<SolidityParameter | SolidityEventArgument>): string {
  return params.map(param => param.name).join(", ");
}

function generateParamArrayNames(params: Array<SolidityParameter | SolidityEventArgument>): string {
  return `[${generateParamNames(params)}]`;
}

function generateInterfaceEventDescription(event: SolidityEvent): string {
  return `
  ${event.name}: TypedEventDescription<{ encodeTopics(${generateParamArrayNames(
    event.inputs,
  )}: ${generateEventTopicTypes(event.inputs)}): string[]; }>;
`;
}

function generateEventTopicTypes(eventArgs: Array<SolidityEventArgument>): string {
  return `[${eventArgs.map(generateEventArgType).join(", ")}]`;
}