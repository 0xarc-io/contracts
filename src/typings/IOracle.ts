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

interface IOracleInterface extends Interface {
  functions: {
    fetchCurrentPrice: TypedFunctionDescription<{ encode([]: []): string }>;
  };
  events: {};
}

export interface IOracle extends Contract {
  interface: IOracleInterface;
  connect(signerOrProvider: Signer | Provider | string): IOracle;
  attach(addressOrName: string): IOracle;
  deployed(): Promise<IOracle>;
  on(event: EventFilter | string, listener: Listener): IOracle;
  once(event: EventFilter | string, listener: Listener): IOracle;
  addListener(eventName: EventFilter | string, listener: Listener): IOracle;
  removeAllListeners(eventName: EventFilter | string): IOracle;
  removeListener(eventName: any, listener: Listener): IOracle;

  fetchCurrentPrice(): Promise<{ value: BigNumber }>;

  estimate: {
    fetchCurrentPrice(): Promise<BigNumber>;
  };
}

export class IOracle {
  public static at(signer: Signer, addressOrName: string): IOracle {
    return this.getFactory(signer).attach(addressOrName) as IOracle;
  }

  public static deploy(signer: Signer): Promise<IOracle> {
    return this.getFactory(signer).deploy() as Promise<IOracle>;
  }

  public static getDeployTransaction(signer: Signer): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction();
  }

  public static async awaitDeployment(
    signer: Signer,
    overrides?: DeploymentOverrides
  ): Promise<IOracle> {
    const tx = IOracle.getDeployTransaction(signer);
    return awaitContractDeployment(signer, IOracle.ABI, tx, overrides);
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"constant":true,"inputs":[],"name":"fetchCurrentPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"}]';
  public static Bytecode = "0x";
}
