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

interface BaseERC20Interface extends Interface {
  functions: {
    allowance: TypedFunctionDescription<{
      encode([owner, spender]: [string, string]): string;
    }>;

    approve: TypedFunctionDescription<{
      encode([spender, value]: [string, BigNumberish]): string;
    }>;

    balanceOf: TypedFunctionDescription<{ encode([who]: [string]): string }>;

    decimals: TypedFunctionDescription<{ encode([]: []): string }>;

    name: TypedFunctionDescription<{ encode([]: []): string }>;

    symbol: TypedFunctionDescription<{ encode([]: []): string }>;

    totalSupply: TypedFunctionDescription<{ encode([]: []): string }>;

    transfer: TypedFunctionDescription<{
      encode([to, value]: [string, BigNumberish]): string;
    }>;

    transferFrom: TypedFunctionDescription<{
      encode([from, to, value]: [string, string, BigNumberish]): string;
    }>;
  };
  events: {
    Approval: TypedEventDescription<{
      encodeTopics([owner, spender, value]: [
        string | null,
        string | null,
        null
      ]): string[];
    }>;

    Transfer: TypedEventDescription<{
      encodeTopics([from, to, value]: [
        string | null,
        string | null,
        null
      ]): string[];
    }>;
  };
}

export interface BaseERC20 extends Contract {
  interface: BaseERC20Interface;
  connect(signerOrProvider: Signer | Provider | string): BaseERC20;
  attach(addressOrName: string): BaseERC20;
  deployed(): Promise<BaseERC20>;
  on(event: EventFilter | string, listener: Listener): BaseERC20;
  once(event: EventFilter | string, listener: Listener): BaseERC20;
  addListener(eventName: EventFilter | string, listener: Listener): BaseERC20;
  removeAllListeners(eventName: EventFilter | string): BaseERC20;
  removeListener(eventName: any, listener: Listener): BaseERC20;

  allowance(owner: string, spender: string): Promise<BigNumber>;
  approve(
    spender: string,
    value: BigNumberish,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  balanceOf(who: string): Promise<BigNumber>;
  decimals(): Promise<number>;
  name(): Promise<string>;
  symbol(): Promise<string>;
  totalSupply(): Promise<BigNumber>;
  transfer(
    to: string,
    value: BigNumberish,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  transferFrom(
    from: string,
    to: string,
    value: BigNumberish,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;

  Approval(
    owner: string | null,
    spender: string | null,
    value: null
  ): EventFilter;
  Transfer(from: string | null, to: string | null, value: null): EventFilter;

  estimate: {
    allowance(owner: string, spender: string): Promise<BigNumber>;
    approve(spender: string, value: BigNumberish): Promise<BigNumber>;
    balanceOf(who: string): Promise<BigNumber>;
    decimals(): Promise<BigNumber>;
    name(): Promise<BigNumber>;
    symbol(): Promise<BigNumber>;
    totalSupply(): Promise<BigNumber>;
    transfer(to: string, value: BigNumberish): Promise<BigNumber>;
    transferFrom(
      from: string,
      to: string,
      value: BigNumberish
    ): Promise<BigNumber>;
  };
}

export class BaseERC20 {
  public static at(signer: Signer, addressOrName: string): BaseERC20 {
    return this.getFactory(signer).attach(addressOrName) as BaseERC20;
  }

  public static deploy(
    signer: Signer,
    name: string,
    symbol: string
  ): Promise<BaseERC20> {
    return this.getFactory(signer).deploy(name, symbol) as Promise<BaseERC20>;
  }

  public static getDeployTransaction(
    signer: Signer,
    name: string,
    symbol: string
  ): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction(name, symbol);
  }

  public static async awaitDeployment(
    signer: Signer,
    name: string,
    symbol: string,
    overrides?: DeploymentOverrides
  ): Promise<BaseERC20> {
    const tx = BaseERC20.getDeployTransaction(signer, name, symbol);
    return awaitContractDeployment(signer, BaseERC20.ABI, tx, overrides);
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"inputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"symbol","type":"string"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"address","name":"from","type":"address"},{"indexed":false,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"who","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
  public static Bytecode =
    "0x60806040523480156200001157600080fd5b506040516200123238038062001232833981810160405262000037919081019062000198565b81600090805190602001906200004f9291906200008d565b508060019080519060200190620000689291906200008d565b506012600360006101000a81548160ff021916908360ff16021790555050506200029c565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10620000d057805160ff191683800117855562000101565b8280016001018555821562000101579182015b8281111562000100578251825591602001919060010190620000e3565b5b50905062000110919062000114565b5090565b6200013991905b80821115620001355760008160009055506001016200011b565b5090565b90565b600082601f8301126200014e57600080fd5b8151620001656200015f8262000239565b6200020b565b915080825260208301602083018583830111156200018257600080fd5b6200018f83828462000266565b50505092915050565b60008060408385031215620001ac57600080fd5b600083015167ffffffffffffffff811115620001c757600080fd5b620001d5858286016200013c565b925050602083015167ffffffffffffffff811115620001f357600080fd5b62000201858286016200013c565b9150509250929050565b6000604051905081810181811067ffffffffffffffff821117156200022f57600080fd5b8060405250919050565b600067ffffffffffffffff8211156200025157600080fd5b601f19601f8301169050602081019050919050565b60005b838110156200028657808201518184015260208101905062000269565b8381111562000296576000848401525b50505050565b610f8680620002ac6000396000f3fe608060405234801561001057600080fd5b50600436106100935760003560e01c8063313ce56711610066578063313ce5671461013457806370a082311461015257806395d89b4114610182578063a9059cbb146101a0578063dd62ed3e146101d057610093565b806306fdde0314610098578063095ea7b3146100b657806318160ddd146100e657806323b872dd14610104575b600080fd5b6100a0610200565b6040516100ad9190610db2565b60405180910390f35b6100d060048036036100cb9190810190610c0d565b6102a2565b6040516100dd9190610d97565b60405180910390f35b6100ee6102b7565b6040516100fb9190610df4565b60405180910390f35b61011e60048036036101199190810190610bbe565b6102c1565b60405161012b9190610d97565b60405180910390f35b61013c61061e565b6040516101499190610e0f565b60405180910390f35b61016c60048036036101679190810190610b59565b610635565b6040516101799190610df4565b60405180910390f35b61018a61067e565b6040516101979190610db2565b60405180910390f35b6101ba60048036036101b59190810190610c0d565b610720565b6040516101c79190610d97565b60405180910390f35b6101ea60048036036101e59190810190610b82565b6108e3565b6040516101f79190610df4565b60405180910390f35b606060008054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156102985780601f1061026d57610100808354040283529160200191610298565b820191906000526020600020905b81548152906001019060200180831161027b57829003601f168201915b5050505050905090565b60006102af33848461096a565b905092915050565b6000600254905090565b600081600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020541015801561038e575081600560008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410155b15610612576103e582600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610a3590919063ffffffff16565b600460008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555061047a82600460008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610a8a90919063ffffffff16565b600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555061054c82600560008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610a8a90919063ffffffff16565b600560008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055507fd1398bee19313d6bf672ccb116e51f4a1a947e91c757907f51fbb5b5e56c698f308585856040516106019493929190610d52565b60405180910390a160019050610617565b600090505b9392505050565b6000600360009054906101000a900460ff16905090565b6000600460008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b606060018054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156107165780601f106106eb57610100808354040283529160200191610716565b820191906000526020600020905b8154815290600101906020018083116106f957829003601f168201915b5050505050905090565b600081600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054106108d8576107ba82600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610a8a90919063ffffffff16565b600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555061084f82600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610a3590919063ffffffff16565b600460008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055507fd1398bee19313d6bf672ccb116e51f4a1a947e91c757907f51fbb5b5e56c698f303385856040516108c79493929190610d0d565b60405180910390a1600190506108dd565b600090505b92915050565b6000600560008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b600081600560008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055507fa0175360a15bca328baf7ea85c7b784d58b222a50d0ce760b10dba336d226a6130858585604051610a229493929190610d52565b60405180910390a1600190509392505050565b600080828401905083811015610a80576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610a7790610dd4565b60405180910390fd5b8091505092915050565b6000610acc83836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f770000815250610ad4565b905092915050565b6000838311158290610b1c576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610b139190610db2565b60405180910390fd5b5060008385039050809150509392505050565b600081359050610b3e81610f15565b92915050565b600081359050610b5381610f2c565b92915050565b600060208284031215610b6b57600080fd5b6000610b7984828501610b2f565b91505092915050565b60008060408385031215610b9557600080fd5b6000610ba385828601610b2f565b9250506020610bb485828601610b2f565b9150509250929050565b600080600060608486031215610bd357600080fd5b6000610be186828701610b2f565b9350506020610bf286828701610b2f565b9250506040610c0386828701610b44565b9150509250925092565b60008060408385031215610c2057600080fd5b6000610c2e85828601610b2f565b9250506020610c3f85828601610b44565b9150509250929050565b610c5281610e9b565b82525050565b610c6181610e46565b82525050565b610c7081610e58565b82525050565b6000610c8182610e2a565b610c8b8185610e35565b9350610c9b818560208601610ed1565b610ca481610f04565b840191505092915050565b6000610cbc601b83610e35565b91507f536166654d6174683a206164646974696f6e206f766572666c6f7700000000006000830152602082019050919050565b610cf881610e84565b82525050565b610d0781610e8e565b82525050565b6000608082019050610d226000830187610c58565b610d2f6020830186610c49565b610d3c6040830185610c58565b610d496060830184610cef565b95945050505050565b6000608082019050610d676000830187610c58565b610d746020830186610c58565b610d816040830185610c58565b610d8e6060830184610cef565b95945050505050565b6000602082019050610dac6000830184610c67565b92915050565b60006020820190508181036000830152610dcc8184610c76565b905092915050565b60006020820190508181036000830152610ded81610caf565b9050919050565b6000602082019050610e096000830184610cef565b92915050565b6000602082019050610e246000830184610cfe565b92915050565b600081519050919050565b600082825260208201905092915050565b6000610e5182610e64565b9050919050565b60008115159050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b600060ff82169050919050565b6000610ea682610ead565b9050919050565b6000610eb882610ebf565b9050919050565b6000610eca82610e64565b9050919050565b60005b83811015610eef578082015181840152602081019050610ed4565b83811115610efe576000848401525b50505050565b6000601f19601f8301169050919050565b610f1e81610e46565b8114610f2957600080fd5b50565b610f3581610e84565b8114610f4057600080fd5b5056fea365627a7a72315820b37fc46e7828a1330779f15675f2b410039c9a031b79532164a2d2918b103b5b6c6578706572696d656e74616cf564736f6c63430005100040";
}
