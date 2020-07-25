import {
  BigNumberish,
  EventDescription,
  FunctionDescription,
  UnsignedTransaction,
} from "ethers/utils";
import { Signer, Contract } from "ethers";

export { AdminStorage } from "./AdminStorage";
export { BaseERC20 } from "./BaseERC20";
export { CoreV1 } from "./CoreV1";
export { IChainLinkAggregator } from "./IChainLinkAggregator";
export { IERC20 } from "./IERC20";
export { IInterestSetter } from "./IInterestSetter";
export { IOracle } from "./IOracle";
export { ISyntheticToken } from "./ISyntheticToken";
export { MockOracle } from "./MockOracle";
export { PolynomialInterestSetter } from "./PolynomialInterestSetter";
export { Proxy } from "./Proxy";
export { StableShare } from "./StableShare";
export { StableToken } from "./StableToken";
export { StateV1 } from "./StateV1";
export { SyntheticToken } from "./SyntheticToken";
export { V1Storage } from "./V1Storage";

export interface TransactionOverrides {
  nonce?: BigNumberish | Promise<BigNumberish>;
  gasLimit?: BigNumberish | Promise<BigNumberish>;
  gasPrice?: BigNumberish | Promise<BigNumberish>;
  value?: BigNumberish | Promise<BigNumberish>;
  chainId?: number | Promise<number>;
  from?: Signer;
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

export function applyOverrides(
  tx: UnsignedTransaction,
  overrides: DeploymentOverrides
): UnsignedTransaction {
  return {
    data: tx.data,
    to: tx.to,
    nonce: overrides.nonce ? overrides.nonce : tx.nonce,
    chainId: overrides.chainId ? overrides.chainId : tx.chainId,
    gasLimit: overrides.gasLimit ? overrides.gasLimit : tx.gasLimit,
    gasPrice: overrides.gasPrice ? overrides.gasPrice : tx.gasPrice,
    value: overrides.value ? overrides.value : tx.value,
  };
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
  const code =
    (await signer.provider?.getCode(receipt.contractAddress || "")) || "";
  if (code.length <= 2) {
    throw new Error(
      "Contract not deployed correctly. Is this an abstract contract?"
    );
  }
  return new Contract(receipt.contractAddress || "", abi, signer) as T;
}
