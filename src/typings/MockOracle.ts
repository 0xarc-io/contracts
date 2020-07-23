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

interface MockOracleInterface extends Interface {
  functions: {
    CURRENT_PRICE: TypedFunctionDescription<{ encode([]: []): string }>;

    fetchCurrentPrice: TypedFunctionDescription<{ encode([]: []): string }>;

    setPrice: TypedFunctionDescription<{
      encode([price]: [{ value: BigNumberish }]): string;
    }>;
  };
  events: {};
}

export interface MockOracle extends Contract {
  interface: MockOracleInterface;
  connect(signerOrProvider: Signer | Provider | string): MockOracle;
  attach(addressOrName: string): MockOracle;
  deployed(): Promise<MockOracle>;
  on(event: EventFilter | string, listener: Listener): MockOracle;
  once(event: EventFilter | string, listener: Listener): MockOracle;
  addListener(eventName: EventFilter | string, listener: Listener): MockOracle;
  removeAllListeners(eventName: EventFilter | string): MockOracle;
  removeListener(eventName: any, listener: Listener): MockOracle;

  CURRENT_PRICE(): Promise<BigNumber>;
  fetchCurrentPrice(): Promise<{ value: BigNumber }>;
  setPrice(
    price: { value: BigNumberish },
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;

  estimate: {
    CURRENT_PRICE(): Promise<BigNumber>;
    fetchCurrentPrice(): Promise<BigNumber>;
    setPrice(price: { value: BigNumberish }): Promise<BigNumber>;
  };
}

export class MockOracle {
  public static at(signer: Signer, addressOrName: string): MockOracle {
    return this.getFactory(signer).attach(addressOrName) as MockOracle;
  }

  public static deploy(signer: Signer): Promise<MockOracle> {
    return this.getFactory(signer).deploy() as Promise<MockOracle>;
  }

  public static getDeployTransaction(signer: Signer): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction();
  }

  public static async awaitDeployment(
    signer: Signer,
    overrides?: DeploymentOverrides
  ): Promise<MockOracle> {
    const tx = MockOracle.getDeployTransaction(signer);
    return awaitContractDeployment(signer, MockOracle.ABI, tx, overrides);
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"constant":true,"inputs":[],"name":"CURRENT_PRICE","outputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"fetchCurrentPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"setPrice","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
  public static Bytecode =
    "0x60806040526040518060200160405280678ac7230489e800008152506000808201518160000155505034801561003457600080fd5b5061026a806100446000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c80630c15e407146100465780634b369a611461006257806396a0e5e314610080575b600080fd5b610060600480360361005b9190810190610140565b61009e565b005b61006a6100b0565b60405161007791906101be565b60405180910390f35b6100886100bc565b60405161009591906101a3565b60405180910390f35b80600080820151816000015590505050565b60008060000154905081565b6100c46100e0565b6000604051806020016040529081600082015481525050905090565b6040518060200160405280600081525090565b60006020828403121561010557600080fd5b61010f60206101d9565b9050600061011f8482850161012b565b60008301525092915050565b60008135905061013a81610210565b92915050565b60006020828403121561015257600080fd5b6000610160848285016100f3565b91505092915050565b60208201600082015161017f6000850182610185565b50505050565b61018e81610206565b82525050565b61019d81610206565b82525050565b60006020820190506101b86000830184610169565b92915050565b60006020820190506101d36000830184610194565b92915050565b6000604051905081810181811067ffffffffffffffff821117156101fc57600080fd5b8060405250919050565b6000819050919050565b61021981610206565b811461022457600080fd5b5056fea365627a7a72315820a02abd3d95b48adae00eb9bd233d13ea8fb959c12a1ff70c571fbcdcd997d6e16c6578706572696d656e74616cf564736f6c63430005100040";
}
