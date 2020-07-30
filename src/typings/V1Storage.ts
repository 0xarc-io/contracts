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

interface V1StorageInterface extends Interface {
  functions: {
    stableLimit: TypedFunctionDescription<{ encode([]: []): string }>;

    state: TypedFunctionDescription<{ encode([]: []): string }>;

    syntheticLimit: TypedFunctionDescription<{ encode([]: []): string }>;
  };
  events: {};
}

export interface V1Storage extends Contract {
  interface: V1StorageInterface;
  connect(signerOrProvider: Signer | Provider | string): V1Storage;
  attach(addressOrName: string): V1Storage;
  deployed(): Promise<V1Storage>;
  on(event: EventFilter | string, listener: Listener): V1Storage;
  once(event: EventFilter | string, listener: Listener): V1Storage;
  addListener(eventName: EventFilter | string, listener: Listener): V1Storage;
  removeAllListeners(eventName: EventFilter | string): V1Storage;
  removeListener(eventName: any, listener: Listener): V1Storage;

  stableLimit(): Promise<BigNumber>;
  state(): Promise<string>;
  syntheticLimit(): Promise<BigNumber>;

  estimate: {
    stableLimit(): Promise<BigNumber>;
    state(): Promise<BigNumber>;
    syntheticLimit(): Promise<BigNumber>;
  };
}

export class V1Storage {
  public static at(signer: Signer, addressOrName: string): V1Storage {
    return this.getFactory(signer).attach(addressOrName) as V1Storage;
  }

  public static deploy(signer: Signer): Promise<V1Storage> {
    return this.getFactory(signer).deploy() as Promise<V1Storage>;
  }

  public static getDeployTransaction(signer: Signer): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction();
  }

  public static async awaitDeployment(
    signer: Signer,
    overrides?: DeploymentOverrides
  ): Promise<V1Storage> {
    const tx = V1Storage.getDeployTransaction(signer);
    return awaitContractDeployment(signer, V1Storage.ABI, tx, overrides);
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"constant":true,"inputs":[],"name":"stableLimit","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"state","outputs":[{"internalType":"contract StateV1","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"syntheticLimit","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}]';
  public static Bytecode =
    "0x608060405234801561001057600080fd5b506101b6806100206000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c806375ed45f214610046578063b077e74d14610064578063c19d93fb14610082575b600080fd5b61004e6100a0565b60405161005b919061010a565b60405180910390f35b61006c6100a6565b604051610079919061010a565b60405180910390f35b61008a6100ac565b60405161009791906100ef565b60405180910390f35b60025481565b60015481565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6100da8161014f565b82525050565b6100e981610145565b82525050565b600060208201905061010460008301846100d1565b92915050565b600060208201905061011f60008301846100e0565b92915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b600061015a82610161565b9050919050565b600061016c82610125565b905091905056fea365627a7a72315820aaa9bae7a9cbeba34ed1f7989eafc37b884aa623c344d930c6a76b6b534d18086c6578706572696d656e74616cf564736f6c63430005100040";
}
