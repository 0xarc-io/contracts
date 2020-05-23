import { Contract } from "../parse/complex-solidity-types";
import { ABIDefinition } from "../parse/abi-types";

export interface BindingGenerator {
    parse(artifact: Artifact): Contract;
    convert(contract: Contract): TSFile;
    write(outDir: string, generated: TSFile): void;
}

export interface Artifact {
    name: string;
    abi: Array<ABIDefinition>;
    bytecode: string;
}

export interface TSFile {
    name: string;
    body: string;
}

export interface Options {
    pattern: string;
    outDir: string;
}