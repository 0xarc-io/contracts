import * as fs from 'fs';
import * as path from 'path';
import { TSFile } from './types';
import { Options as PrettierOptions, format } from 'prettier';

export function writeIndex(outDir: string, contractNames: Array<string>): void {
  const file = {
    name: 'index.ts',
    body: `
import {
    BigNumberish, EventDescription, FunctionDescription, UnsignedTransaction
} from 'ethers/utils';
import { Signer, Contract } from 'ethers'

${contractNames.map((name) => `export { ${name} } from './${name}';`).join('\n')}

export interface TransactionOverrides {
    nonce?: BigNumberish | Promise<BigNumberish>;
    gasLimit?: BigNumberish | Promise<BigNumberish>;
    gasPrice?: BigNumberish | Promise<BigNumberish>;
    value?: BigNumberish | Promise<BigNumberish>;
    chainId?: number | Promise<number>;
    from?: Wallet;
}

export interface TypedEventDescription<
    T extends Pick<EventDescription, "encodeTopics">
> extends EventDescription {
    encodeTopics: T["encodeTopics"];
}

export interface TypedFunctionDescription<
    T extends Pick<FunctionDescription, "encode">
> extends FunctionDescription {
    encode: T["encode"];
}

export class DeploymentOverrides {
    nonce?: number;
    gasLimit?: BigNumberish;
    gasPrice?: BigNumberish;
    value?: BigNumberish;
    chainId?: number;
}

export function applyOverrides(tx: UnsignedTransaction, overrides: DeploymentOverrides): UnsignedTransaction {
    return {
        data: tx.data,
        to: tx.to,
        nonce: overrides.nonce ? overrides.nonce : tx.nonce,
        chainId: overrides.chainId ? overrides.chainId : tx.chainId,
        gasLimit: overrides.gasLimit ? overrides.gasLimit: tx.gasLimit,
        gasPrice: overrides.gasPrice ? overrides.gasPrice : tx.gasPrice,
        value: overrides.value ? overrides.value : tx.value,
    }
}

export async function awaitContractDeployment<T extends Contract>(
    signer: Signer,
    abi: string,
    tx: UnsignedTransaction,
    overrides?: DeploymentOverrides
): Promise<T> {
    if (overrides) {
        tx = applyOverrides(tx, overrides);
    }
    const sent = await signer.sendTransaction(tx);
    const receipt = await sent.wait();
    const code = await signer.provider?.getCode(receipt.contractAddress || '') || '';
    if (code.length <= 2) {
        throw new Error(
        "Contract not deployed correctly. Is this an abstract contract?"
        );
    }
    return new Contract(
        receipt.contractAddress  || '',
        abi,
        signer
    ) as T;
}
`,
  };
  writeTSFile(outDir, file);
}

export function writeTSFile(outDir: string, file: TSFile): void {
  const finalPath = path.join(outDir, file.name);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
  }
  if (fs.existsSync(finalPath)) {
    fs.unlinkSync(finalPath);
  }
  const prettierCfg: PrettierOptions = { parser: 'typescript' };
  const output = format(file.body, prettierCfg);
  fs.writeFileSync(finalPath, output);
}
