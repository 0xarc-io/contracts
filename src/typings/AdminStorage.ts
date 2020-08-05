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

interface AdminStorageInterface extends Interface {
  functions: {
    admin: TypedFunctionDescription<{ encode([]: []): string }>;

    coreImplementation: TypedFunctionDescription<{ encode([]: []): string }>;

    pendingAdmin: TypedFunctionDescription<{ encode([]: []): string }>;

    pendingCoreImplementation: TypedFunctionDescription<{
      encode([]: []): string;
    }>;
  };
  events: {
    NewAdmin: TypedEventDescription<{
      encodeTopics([oldAdmin, newAdmin]: [null, null]): string[];
    }>;

    NewImplementation: TypedEventDescription<{
      encodeTopics([oldImplementation, newImplementation]: [
        null,
        null
      ]): string[];
    }>;

    NewPendingAdmin: TypedEventDescription<{
      encodeTopics([oldPendingAdmin, newPendingAdmin]: [null, null]): string[];
    }>;

    NewPendingImplementation: TypedEventDescription<{
      encodeTopics([oldPendingImplementation, newPendingImplementation]: [
        null,
        null
      ]): string[];
    }>;
  };
}

export interface AdminStorage extends Contract {
  interface: AdminStorageInterface;
  connect(signerOrProvider: Signer | Provider | string): AdminStorage;
  attach(addressOrName: string): AdminStorage;
  deployed(): Promise<AdminStorage>;
  on(event: EventFilter | string, listener: Listener): AdminStorage;
  once(event: EventFilter | string, listener: Listener): AdminStorage;
  addListener(
    eventName: EventFilter | string,
    listener: Listener
  ): AdminStorage;
  removeAllListeners(eventName: EventFilter | string): AdminStorage;
  removeListener(eventName: any, listener: Listener): AdminStorage;

  admin(): Promise<string>;
  coreImplementation(): Promise<string>;
  pendingAdmin(): Promise<string>;
  pendingCoreImplementation(): Promise<string>;

  NewAdmin(oldAdmin: null, newAdmin: null): EventFilter;
  NewImplementation(
    oldImplementation: null,
    newImplementation: null
  ): EventFilter;
  NewPendingAdmin(oldPendingAdmin: null, newPendingAdmin: null): EventFilter;
  NewPendingImplementation(
    oldPendingImplementation: null,
    newPendingImplementation: null
  ): EventFilter;

  estimate: {
    admin(): Promise<BigNumber>;
    coreImplementation(): Promise<BigNumber>;
    pendingAdmin(): Promise<BigNumber>;
    pendingCoreImplementation(): Promise<BigNumber>;
  };
}

export class AdminStorage {
  public static at(signer: Signer, addressOrName: string): AdminStorage {
    return this.getFactory(signer).attach(addressOrName) as AdminStorage;
  }

  public static deploy(signer: Signer): Promise<AdminStorage> {
    return this.getFactory(signer).deploy() as Promise<AdminStorage>;
  }

  public static getDeployTransaction(signer: Signer): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction();
  }

  public static async awaitDeployment(
    signer: Signer,
    overrides?: DeploymentOverrides
  ): Promise<AdminStorage> {
    const tx = AdminStorage.getDeployTransaction(signer);
    return awaitContractDeployment(signer, AdminStorage.ABI, tx, overrides);
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"oldAdmin","type":"address"},{"indexed":false,"internalType":"address","name":"newAdmin","type":"address"}],"name":"NewAdmin","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"oldImplementation","type":"address"},{"indexed":false,"internalType":"address","name":"newImplementation","type":"address"}],"name":"NewImplementation","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"oldPendingAdmin","type":"address"},{"indexed":false,"internalType":"address","name":"newPendingAdmin","type":"address"}],"name":"NewPendingAdmin","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"oldPendingImplementation","type":"address"},{"indexed":false,"internalType":"address","name":"newPendingImplementation","type":"address"}],"name":"NewPendingImplementation","type":"event"},{"constant":true,"inputs":[],"name":"admin","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"coreImplementation","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"pendingAdmin","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"pendingCoreImplementation","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"}]';
  public static Bytecode =
    "0x608060405234801561001057600080fd5b506101ff806100206000396000f3fe608060405234801561001057600080fd5b506004361061004c5760003560e01c806326782247146100515780633cf217381461006f5780639d492a2c1461008d578063f851a440146100ab575b600080fd5b6100596100c9565b604051610066919061016f565b60405180910390f35b6100776100ef565b604051610084919061016f565b60405180910390f35b610095610115565b6040516100a2919061016f565b60405180910390f35b6100b361013b565b6040516100c0919061016f565b60405180910390f35b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600260009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6101698161018a565b82525050565b60006020820190506101846000830184610160565b92915050565b60006101958261019c565b9050919050565b600073ffffffffffffffffffffffffffffffffffffffff8216905091905056fea365627a7a7231582088a68fff20324222f438d82b01dd2c6a19f62295f4d5d1c82c93774adaf474f06c6578706572696d656e74616cf564736f6c63430005100040";
}
