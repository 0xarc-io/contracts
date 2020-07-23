import {
  Contract,
  ContractFactory,
  ContractTransaction,
  EventFilter,
  Signer,
} from "ethers";
import { Listener, Provider } from "ethers/providers";
import {
  Arrayish,
  BigNumber,
  BigNumberish,
  Interface,
  UnsignedTransaction,
  getContractAddress,
} from "ethers/utils";
import {
  TransactionOverrides,
  TypedFunctionDescription,
  TypedEventDescription,
  awaitContractDeployment,
  DeploymentOverrides,
} from ".";

interface ISyntheticTokenInterface extends Interface {
  functions: {
    burn: TypedFunctionDescription<{
      encode([to, value]: [string, BigNumberish]): string;
    }>;

    mint: TypedFunctionDescription<{
      encode([to, value]: [string, BigNumberish]): string;
    }>;

    transferCollateral: TypedFunctionDescription<{
      encode([token, to, value]: [string, string, BigNumberish]): string;
    }>;
  };
  events: {};
}

export interface ISyntheticToken extends Contract {
  interface: ISyntheticTokenInterface;
  connect(signerOrProvider: Signer | Provider | string): ISyntheticToken;
  attach(addressOrName: string): ISyntheticToken;
  deployed(): Promise<ISyntheticToken>;
  on(event: EventFilter | string, listener: Listener): ISyntheticToken;
  once(event: EventFilter | string, listener: Listener): ISyntheticToken;
  addListener(
    eventName: EventFilter | string,
    listener: Listener
  ): ISyntheticToken;
  removeAllListeners(eventName: EventFilter | string): ISyntheticToken;
  removeListener(eventName: any, listener: Listener): ISyntheticToken;

  burn(
    to: string,
    value: BigNumberish,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  mint(
    to: string,
    value: BigNumberish,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  transferCollateral(
    token: string,
    to: string,
    value: BigNumberish,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;

  estimate: {
    burn(to: string, value: BigNumberish): Promise<BigNumber>;
    mint(to: string, value: BigNumberish): Promise<BigNumber>;
    transferCollateral(
      token: string,
      to: string,
      value: BigNumberish
    ): Promise<BigNumber>;
  };
}

export class ISyntheticToken {
  public static at(signer: Signer, addressOrName: string): ISyntheticToken {
    return this.getFactory(signer).attach(addressOrName) as ISyntheticToken;
  }

  public static deploy(signer: Signer): Promise<ISyntheticToken> {
    return this.getFactory(signer).deploy() as Promise<ISyntheticToken>;
  }

  public static getDeployTransaction(signer: Signer): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction();
  }

  public static async awaitDeployment(
    signer: Signer,
    overrides?: DeploymentOverrides
  ): Promise<ISyntheticToken> {
    const tx = ISyntheticToken.getDeployTransaction(signer);
    return awaitContractDeployment(signer, ISyntheticToken.ABI, tx, overrides);
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"burn","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"mint","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferCollateral","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
  public static Bytecode = "0x";
}
