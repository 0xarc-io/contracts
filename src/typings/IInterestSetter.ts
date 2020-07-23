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

interface IInterestSetterInterface extends Interface {
  functions: {
    getInterestRate: TypedFunctionDescription<{
      encode([, borrowWei, supplyWei]: [
        string,
        BigNumberish,
        BigNumberish
      ]): string;
    }>;
  };
  events: {};
}

export interface IInterestSetter extends Contract {
  interface: IInterestSetterInterface;
  connect(signerOrProvider: Signer | Provider | string): IInterestSetter;
  attach(addressOrName: string): IInterestSetter;
  deployed(): Promise<IInterestSetter>;
  on(event: EventFilter | string, listener: Listener): IInterestSetter;
  once(event: EventFilter | string, listener: Listener): IInterestSetter;
  addListener(
    eventName: EventFilter | string,
    listener: Listener
  ): IInterestSetter;
  removeAllListeners(eventName: EventFilter | string): IInterestSetter;
  removeListener(eventName: any, listener: Listener): IInterestSetter;

  getInterestRate(
    arg0: string,
    borrowWei: BigNumberish,
    supplyWei: BigNumberish
  ): Promise<{ value: BigNumber }>;

  estimate: {
    getInterestRate(
      arg0: string,
      borrowWei: BigNumberish,
      supplyWei: BigNumberish
    ): Promise<BigNumber>;
  };
}

export class IInterestSetter {
  public static at(signer: Signer, addressOrName: string): IInterestSetter {
    return this.getFactory(signer).attach(addressOrName) as IInterestSetter;
  }

  public static deploy(signer: Signer): Promise<IInterestSetter> {
    return this.getFactory(signer).deploy() as Promise<IInterestSetter>;
  }

  public static getDeployTransaction(signer: Signer): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction();
  }

  public static async awaitDeployment(
    signer: Signer,
    overrides?: DeploymentOverrides
  ): Promise<IInterestSetter> {
    const tx = IInterestSetter.getDeployTransaction(signer);
    return awaitContractDeployment(signer, IInterestSetter.ABI, tx, overrides);
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"borrowWei","type":"uint256"},{"internalType":"uint256","name":"supplyWei","type":"uint256"}],"name":"getInterestRate","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Interest.Rate","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"}]';
  public static Bytecode = "0x";
}
