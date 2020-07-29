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

interface IMintableTokenInterface extends Interface {
  functions: {
    burn: TypedFunctionDescription<{
      encode([to, value]: [string, BigNumberish]): string;
    }>;

    mint: TypedFunctionDescription<{
      encode([to, value]: [string, BigNumberish]): string;
    }>;
  };
  events: {};
}

export interface IMintableToken extends Contract {
  interface: IMintableTokenInterface;
  connect(signerOrProvider: Signer | Provider | string): IMintableToken;
  attach(addressOrName: string): IMintableToken;
  deployed(): Promise<IMintableToken>;
  on(event: EventFilter | string, listener: Listener): IMintableToken;
  once(event: EventFilter | string, listener: Listener): IMintableToken;
  addListener(
    eventName: EventFilter | string,
    listener: Listener
  ): IMintableToken;
  removeAllListeners(eventName: EventFilter | string): IMintableToken;
  removeListener(eventName: any, listener: Listener): IMintableToken;

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

  estimate: {
    burn(to: string, value: BigNumberish): Promise<BigNumber>;
    mint(to: string, value: BigNumberish): Promise<BigNumber>;
  };
}

export class IMintableToken {
  public static at(signer: Signer, addressOrName: string): IMintableToken {
    return this.getFactory(signer).attach(addressOrName) as IMintableToken;
  }

  public static deploy(signer: Signer): Promise<IMintableToken> {
    return this.getFactory(signer).deploy() as Promise<IMintableToken>;
  }

  public static getDeployTransaction(signer: Signer): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction();
  }

  public static async awaitDeployment(
    signer: Signer,
    overrides?: DeploymentOverrides
  ): Promise<IMintableToken> {
    const tx = IMintableToken.getDeployTransaction(signer);
    return awaitContractDeployment(signer, IMintableToken.ABI, tx, overrides);
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"burn","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"mint","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
  public static Bytecode = "0x";
}
