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

interface ProxyInterface extends Interface {
  functions: {
    acceptAdmin: TypedFunctionDescription<{ encode([]: []): string }>;

    acceptImplementation: TypedFunctionDescription<{ encode([]: []): string }>;

    admin: TypedFunctionDescription<{ encode([]: []): string }>;

    coreImplementation: TypedFunctionDescription<{ encode([]: []): string }>;

    pendingAdmin: TypedFunctionDescription<{ encode([]: []): string }>;

    pendingCoreImplementation: TypedFunctionDescription<{
      encode([]: []): string;
    }>;

    setPendingAdmin: TypedFunctionDescription<{
      encode([newPendingAdmin]: [string]): string;
    }>;

    setPendingImplementation: TypedFunctionDescription<{
      encode([newPendingImplementation]: [string]): string;
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

export interface Proxy extends Contract {
  interface: ProxyInterface;
  connect(signerOrProvider: Signer | Provider | string): Proxy;
  attach(addressOrName: string): Proxy;
  deployed(): Promise<Proxy>;
  on(event: EventFilter | string, listener: Listener): Proxy;
  once(event: EventFilter | string, listener: Listener): Proxy;
  addListener(eventName: EventFilter | string, listener: Listener): Proxy;
  removeAllListeners(eventName: EventFilter | string): Proxy;
  removeListener(eventName: any, listener: Listener): Proxy;

  acceptAdmin(overrides?: TransactionOverrides): Promise<ContractTransaction>;
  acceptImplementation(
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  admin(): Promise<string>;
  coreImplementation(): Promise<string>;
  pendingAdmin(): Promise<string>;
  pendingCoreImplementation(): Promise<string>;
  setPendingAdmin(
    newPendingAdmin: string,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  setPendingImplementation(
    newPendingImplementation: string,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;

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
    acceptAdmin(): Promise<BigNumber>;
    acceptImplementation(): Promise<BigNumber>;
    admin(): Promise<BigNumber>;
    coreImplementation(): Promise<BigNumber>;
    pendingAdmin(): Promise<BigNumber>;
    pendingCoreImplementation(): Promise<BigNumber>;
    setPendingAdmin(newPendingAdmin: string): Promise<BigNumber>;
    setPendingImplementation(
      newPendingImplementation: string
    ): Promise<BigNumber>;
  };
}

export class Proxy {
  public static at(signer: Signer, addressOrName: string): Proxy {
    return this.getFactory(signer).attach(addressOrName) as Proxy;
  }

  public static deploy(signer: Signer): Promise<Proxy> {
    return this.getFactory(signer).deploy() as Promise<Proxy>;
  }

  public static getDeployTransaction(signer: Signer): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction();
  }

  public static async awaitDeployment(
    signer: Signer,
    overrides?: DeploymentOverrides
  ): Promise<Proxy> {
    const tx = Proxy.getDeployTransaction(signer);
    return awaitContractDeployment(signer, Proxy.ABI, tx, overrides);
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"oldAdmin","type":"address"},{"indexed":false,"internalType":"address","name":"newAdmin","type":"address"}],"name":"NewAdmin","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"oldImplementation","type":"address"},{"indexed":false,"internalType":"address","name":"newImplementation","type":"address"}],"name":"NewImplementation","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"oldPendingAdmin","type":"address"},{"indexed":false,"internalType":"address","name":"newPendingAdmin","type":"address"}],"name":"NewPendingAdmin","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"oldPendingImplementation","type":"address"},{"indexed":false,"internalType":"address","name":"newPendingImplementation","type":"address"}],"name":"NewPendingImplementation","type":"event"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"constant":false,"inputs":[],"name":"acceptAdmin","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"acceptImplementation","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"admin","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"coreImplementation","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"pendingAdmin","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"pendingCoreImplementation","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"newPendingAdmin","type":"address"}],"name":"setPendingAdmin","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"newPendingImplementation","type":"address"}],"name":"setPendingImplementation","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
  public static Bytecode =
    "0x608060405234801561001057600080fd5b50336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550610eaa806100606000396000f3fe60806040526004361061007b5760003560e01c80633cf217381161004e5780633cf21738146101e25780634dd18bf51461020d5780639d492a2c1461024a578063f851a440146102755761007b565b806309ed43c9146101245780630e18b6811461016157806315ba56e51461018c57806326782247146101b7575b6000600260009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166000366040516100c7929190610cf1565b600060405180830381855af49150503d8060008114610102576040519150601f19603f3d011682016040523d82523d6000602084013e610107565b606091505b505090506040513d6000823e8160008114610120573d82f35b3d82fd5b34801561013057600080fd5b5061014b60048036036101469190810190610aed565b6102a0565b6040516101589190610dce565b60405180910390f35b34801561016d57600080fd5b506101766103fa565b6040516101839190610dce565b60405180910390f35b34801561019857600080fd5b506101a161066f565b6040516101ae9190610dce565b60405180910390f35b3480156101c357600080fd5b506101cc610909565b6040516101d99190610d0a565b60405180910390f35b3480156101ee57600080fd5b506101f761092f565b6040516102049190610d0a565b60405180910390f35b34801561021957600080fd5b50610234600480360361022f9190810190610aed565b610955565b6040516102419190610dce565b60405180910390f35b34801561025657600080fd5b5061025f610a8d565b60405161026c9190610d0a565b60405180910390f35b34801561028157600080fd5b5061028a610ab3565b6040516102979190610d0a565b60405180910390f35b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610331576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161032890610dae565b60405180910390fd5b6000600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905082600360006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507fe945ccee5d701fc83f9b8aa8ca94ea4219ec1fcbd4f4cab4f0ea57c5c3e1d81581600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff166040516103ec929190610d25565b60405180910390a150919050565b6000600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614806104855750600073ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614155b6104c4576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104bb90610d8e565b60405180910390fd5b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690506000600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff166000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055506000600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507ff9ffabca9c8276e99321725bcb43fb076a6c66a54b7f21c4e8146d8519b417dc826000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff16604051610607929190610d25565b60405180910390a17fca4f2f25d0898edd99413412fb94012f9e54ec8142f9b093e7720646a95b16a981600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16604051610662929190610d25565b60405180910390a1505090565b6000600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16148061071c5750600073ffffffffffffffffffffffffffffffffffffffff16600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614155b61075b576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161075290610d4e565b60405180910390fd5b6000600260009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690506000600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16600260006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055506000600360006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507fd604de94d45953f9138079ec1b82d533cb2160c906d1076d1f7ed54befbca97a82600260009054906101000a900473ffffffffffffffffffffffffffffffffffffffff166040516108a1929190610d25565b60405180910390a17fe945ccee5d701fc83f9b8aa8ca94ea4219ec1fcbd4f4cab4f0ea57c5c3e1d81581600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff166040516108fc929190610d25565b60405180910390a1505090565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146109e6576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016109dd90610d6e565b60405180910390fd5b6000600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905082600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507fca4f2f25d0898edd99413412fb94012f9e54ec8142f9b093e7720646a95b16a98184604051610a7f929190610d25565b60405180910390a150919050565b600260009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b600081359050610ae781610e50565b92915050565b600060208284031215610aff57600080fd5b6000610b0d84828501610ad8565b91505092915050565b610b1f81610e05565b82525050565b6000610b318385610de9565b9350610b3e838584610e41565b82840190509392505050565b6000610b57603b83610df4565b91507f50726f78792e616363657074496d706c656d656e746174696f6e3a206d75737460008301527f2073657420612076616c696420696d706c656d656e746174696f6e00000000006020830152604082019050919050565b6000610bbd603583610df4565b91507f50726f78792e73657450656e64696e6741646d696e28293a2063616e206f6e6c60008301527f7920626520736574206279207468652061646d696e00000000000000000000006020830152604082019050919050565b6000610c23603683610df4565b91507f50726f78792e61636365707441646d696e28293a206d7573742062652061636360008301527f657074656420627920746865206e65772061646d696e000000000000000000006020830152604082019050919050565b6000610c89603a83610df4565b91507f50726f78792e73657450656e64696e67496d706c656d656e746174696f6e282960008301527f3a2063616e206f6e6c79206265207365742062792061646d696e0000000000006020830152604082019050919050565b610ceb81610e37565b82525050565b6000610cfe828486610b25565b91508190509392505050565b6000602082019050610d1f6000830184610b16565b92915050565b6000604082019050610d3a6000830185610b16565b610d476020830184610b16565b9392505050565b60006020820190508181036000830152610d6781610b4a565b9050919050565b60006020820190508181036000830152610d8781610bb0565b9050919050565b60006020820190508181036000830152610da781610c16565b9050919050565b60006020820190508181036000830152610dc781610c7c565b9050919050565b6000602082019050610de36000830184610ce2565b92915050565b600081905092915050565b600082825260208201905092915050565b6000610e1082610e17565b9050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b82818337600083830152505050565b610e5981610e05565b8114610e6457600080fd5b5056fea365627a7a723158206925fc6564a966a56282c90c3eeca1c4c2a0a6912afe7587fd211b51282673266c6578706572696d656e74616cf564736f6c63430005100040";
}
