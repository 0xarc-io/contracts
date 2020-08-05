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

interface TestTokenInterface extends Interface {
  functions: {
    allowance: TypedFunctionDescription<{
      encode([owner, spender]: [string, string]): string;
    }>;

    approve: TypedFunctionDescription<{
      encode([spender, value]: [string, BigNumberish]): string;
    }>;

    approvedCollateral: TypedFunctionDescription<{
      encode([]: [string]): string;
    }>;

    balanceOf: TypedFunctionDescription<{ encode([who]: [string]): string }>;

    decimals: TypedFunctionDescription<{ encode([]: []): string }>;

    mintShare: TypedFunctionDescription<{
      encode([to, value]: [string, BigNumberish]): string;
    }>;

    name: TypedFunctionDescription<{ encode([]: []): string }>;

    redeemShare: TypedFunctionDescription<{
      encode([from, value]: [string, BigNumberish]): string;
    }>;

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

export interface TestToken extends Contract {
  interface: TestTokenInterface;
  connect(signerOrProvider: Signer | Provider | string): TestToken;
  attach(addressOrName: string): TestToken;
  deployed(): Promise<TestToken>;
  on(event: EventFilter | string, listener: Listener): TestToken;
  once(event: EventFilter | string, listener: Listener): TestToken;
  addListener(eventName: EventFilter | string, listener: Listener): TestToken;
  removeAllListeners(eventName: EventFilter | string): TestToken;
  removeListener(eventName: any, listener: Listener): TestToken;

  allowance(owner: string, spender: string): Promise<BigNumber>;
  approve(
    spender: string,
    value: BigNumberish,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  approvedCollateral(arg0: string): Promise<boolean>;
  balanceOf(who: string): Promise<BigNumber>;
  decimals(): Promise<number>;
  mintShare(
    to: string,
    value: BigNumberish,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  name(): Promise<string>;
  redeemShare(
    from: string,
    value: BigNumberish,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
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
    approvedCollateral(arg0: string): Promise<BigNumber>;
    balanceOf(who: string): Promise<BigNumber>;
    decimals(): Promise<BigNumber>;
    mintShare(to: string, value: BigNumberish): Promise<BigNumber>;
    name(): Promise<BigNumber>;
    redeemShare(from: string, value: BigNumberish): Promise<BigNumber>;
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

export class TestToken {
  public static at(signer: Signer, addressOrName: string): TestToken {
    return this.getFactory(signer).attach(addressOrName) as TestToken;
  }

  public static deploy(
    signer: Signer,
    _name: string,
    _symbol: string
  ): Promise<TestToken> {
    return this.getFactory(signer).deploy(_name, _symbol) as Promise<TestToken>;
  }

  public static getDeployTransaction(
    signer: Signer,
    _name: string,
    _symbol: string
  ): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction(_name, _symbol);
  }

  public static async awaitDeployment(
    signer: Signer,
    _name: string,
    _symbol: string,
    overrides?: DeploymentOverrides
  ): Promise<TestToken> {
    const tx = TestToken.getDeployTransaction(signer, _name, _symbol);
    return awaitContractDeployment(signer, TestToken.ABI, tx, overrides);
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"inputs":[{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_symbol","type":"string"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"address","name":"from","type":"address"},{"indexed":false,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"approvedCollateral","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"who","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"mintShare","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"redeemShare","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
  public static Bytecode =
    "0x60806040523480156200001157600080fd5b506040516200183938038062001839833981810160405260408110156200003757600080fd5b81019080805160405193929190846401000000008211156200005857600080fd5b838201915060208201858111156200006f57600080fd5b82518660018202830111640100000000821117156200008d57600080fd5b8083526020830192505050908051906020019080838360005b83811015620000c3578082015181840152602081019050620000a6565b50505050905090810190601f168015620000f15780820380516001836020036101000a031916815260200191505b50604052602001805160405193929190846401000000008211156200011557600080fd5b838201915060208201858111156200012c57600080fd5b82518660018202830111640100000000821117156200014a57600080fd5b8083526020830192505050908051906020019080838360005b838110156200018057808201518184015260208101905062000163565b50505050905090810190601f168015620001ae5780820380516001836020036101000a031916815260200191505b5060405250505081818160009080519060200190620001cf9291906200020f565b508060019080519060200190620001e89291906200020f565b506012600360006101000a81548160ff021916908360ff16021790555050505050620002be565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106200025257805160ff191683800117855562000283565b8280016001018555821562000283579182015b828111156200028257825182559160200191906001019062000265565b5b50905062000292919062000296565b5090565b620002bb91905b80821115620002b75760008160009055506001016200029d565b5090565b90565b61156b80620002ce6000396000f3fe608060405234801561001057600080fd5b50600436106100b45760003560e01c80637ac2a520116100715780637ac2a520146102c257806395d89b4114610310578063a9059cbb14610393578063b050b672146103f9578063c2f04b0a14610455578063dd62ed3e146104a3576100b4565b806306fdde03146100b9578063095ea7b31461013c57806318160ddd146101a257806323b872dd146101c0578063313ce5671461024657806370a082311461026a575b600080fd5b6100c161051b565b6040518080602001828103825283818151815260200191508051906020019080838360005b838110156101015780820151818401526020810190506100e6565b50505050905090810190601f16801561012e5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b6101886004803603604081101561015257600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506105bd565b604051808215151515815260200191505060405180910390f35b6101aa6105d2565b6040518082815260200191505060405180910390f35b61022c600480360360608110156101d657600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506105dc565b604051808215151515815260200191505060405180910390f35b61024e6109cf565b604051808260ff1660ff16815260200191505060405180910390f35b6102ac6004803603602081101561028057600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291905050506109e6565b6040518082815260200191505060405180910390f35b61030e600480360360408110156102d857600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610a2f565b005b610318610a3d565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561035857808201518184015260208101905061033d565b50505050905090810190601f1680156103855780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b6103df600480360360408110156103a957600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610adf565b604051808215151515815260200191505060405180910390f35b61043b6004803603602081101561040f57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610d38565b604051808215151515815260200191505060405180910390f35b6104a16004803603604081101561046b57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610d58565b005b610505600480360360408110156104b957600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610d66565b6040518082815260200191505060405180910390f35b606060008054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156105b35780601f10610588576101008083540402835291602001916105b3565b820191906000526020600020905b81548152906001019060200180831161059657829003601f168201915b5050505050905090565b60006105ca338484610ded565b905092915050565b6000600254905090565b600081600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054101580156106a9575081600560008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410155b156109c35761070082600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610f4e90919063ffffffff16565b600460008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555061079582600460008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610fd690919063ffffffff16565b600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555061086782600560008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610fd690919063ffffffff16565b600560008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055507fd1398bee19313d6bf672ccb116e51f4a1a947e91c757907f51fbb5b5e56c698f30858585604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a1600190506109c8565b600090505b9392505050565b6000600360009054906101000a900460ff16905090565b6000600460008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b610a398282611020565b5050565b606060018054600181600116156101000203166002900480601f016020809104026020016040519081016040528092919081815260200182805460018160011615610100020316600290048015610ad55780601f10610aaa57610100808354040283529160200191610ad5565b820191906000526020600020905b815481529060010190602001808311610ab857829003601f168201915b5050505050905090565b600081600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410610d2d57610b7982600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610fd690919063ffffffff16565b600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550610c0e82600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610f4e90919063ffffffff16565b600460008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055507fd1398bee19313d6bf672ccb116e51f4a1a947e91c757907f51fbb5b5e56c698f30338585604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a160019050610d32565b600090505b92915050565b60066020528060005260406000206000915054906101000a900460ff1681565b610d62828261124b565b5050565b6000600560008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b600081600560008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055507fa0175360a15bca328baf7ea85c7b784d58b222a50d0ce760b10dba336d226a6130858585604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a1600190509392505050565b600080828401905083811015610fcc576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601b8152602001807f536166654d6174683a206164646974696f6e206f766572666c6f77000000000081525060200191505060405180910390fd5b8091505092915050565b600061101883836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f770000815250611476565b905092915050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614156110c3576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260138152602001807f43616e6e6f74206275726e20746f207a65726f0000000000000000000000000081525060200191505060405180910390fd5b61111581600460008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610fd690919063ffffffff16565b600460008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555061116d81600254610fd690919063ffffffff16565b6002819055507fd1398bee19313d6bf672ccb116e51f4a1a947e91c757907f51fbb5b5e56c698f3083600084604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a15050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1614156112ee576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601b8152602001807f43616e6e6f74206d696e7420746f207a65726f2061646472657373000000000081525060200191505060405180910390fd5b61134081600460008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610f4e90919063ffffffff16565b600460008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555061139881600254610f4e90919063ffffffff16565b6002819055507fd1398bee19313d6bf672ccb116e51f4a1a947e91c757907f51fbb5b5e56c698f3060008484604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a15050565b6000838311158290611523576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825283818151815260200191508051906020019080838360005b838110156114e85780820151818401526020810190506114cd565b50505050905090810190601f1680156115155780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b506000838503905080915050939250505056fea265627a7a723158208ab8db2e5e7745848cd30ae61e059b8fb0f7dcdd00c4efb8b8205ef2df28230a64736f6c63430005100032";
}
