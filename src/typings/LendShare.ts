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

interface LendShareInterface extends Interface {
  functions: {
    allowance: TypedFunctionDescription<{
      encode([owner, spender]: [string, string]): string;
    }>;

    approve: TypedFunctionDescription<{
      encode([spender, value]: [string, BigNumberish]): string;
    }>;

    arcAddress: TypedFunctionDescription<{ encode([]: []): string }>;

    balanceOf: TypedFunctionDescription<{ encode([who]: [string]): string }>;

    burn: TypedFunctionDescription<{
      encode([to, value]: [string, BigNumberish]): string;
    }>;

    decimals: TypedFunctionDescription<{ encode([]: []): string }>;

    mint: TypedFunctionDescription<{
      encode([to, value]: [string, BigNumberish]): string;
    }>;

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

export interface LendShare extends Contract {
  interface: LendShareInterface;
  connect(signerOrProvider: Signer | Provider | string): LendShare;
  attach(addressOrName: string): LendShare;
  deployed(): Promise<LendShare>;
  on(event: EventFilter | string, listener: Listener): LendShare;
  once(event: EventFilter | string, listener: Listener): LendShare;
  addListener(eventName: EventFilter | string, listener: Listener): LendShare;
  removeAllListeners(eventName: EventFilter | string): LendShare;
  removeListener(eventName: any, listener: Listener): LendShare;

  allowance(owner: string, spender: string): Promise<BigNumber>;
  approve(
    spender: string,
    value: BigNumberish,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  arcAddress(): Promise<string>;
  balanceOf(who: string): Promise<BigNumber>;
  burn(
    to: string,
    value: BigNumberish,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  decimals(): Promise<number>;
  mint(
    to: string,
    value: BigNumberish,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
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
    arcAddress(): Promise<BigNumber>;
    balanceOf(who: string): Promise<BigNumber>;
    burn(to: string, value: BigNumberish): Promise<BigNumber>;
    decimals(): Promise<BigNumber>;
    mint(to: string, value: BigNumberish): Promise<BigNumber>;
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

export class LendShare {
  public static at(signer: Signer, addressOrName: string): LendShare {
    return this.getFactory(signer).attach(addressOrName) as LendShare;
  }

  public static deploy(
    signer: Signer,
    _arcAddress: string,
    _name: string,
    _symbol: string
  ): Promise<LendShare> {
    return this.getFactory(signer).deploy(
      _arcAddress,
      _name,
      _symbol
    ) as Promise<LendShare>;
  }

  public static getDeployTransaction(
    signer: Signer,
    _arcAddress: string,
    _name: string,
    _symbol: string
  ): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction(
      _arcAddress,
      _name,
      _symbol
    );
  }

  public static async awaitDeployment(
    signer: Signer,
    _arcAddress: string,
    _name: string,
    _symbol: string,
    overrides?: DeploymentOverrides
  ): Promise<LendShare> {
    const tx = LendShare.getDeployTransaction(
      signer,
      _arcAddress,
      _name,
      _symbol
    );
    return awaitContractDeployment(signer, LendShare.ABI, tx, overrides);
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"inputs":[{"internalType":"address","name":"_arcAddress","type":"address"},{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_symbol","type":"string"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"address","name":"from","type":"address"},{"indexed":false,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"arcAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"who","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"burn","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"mint","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
  public static Bytecode =
    "0x60806040523480156200001157600080fd5b50604051620019ff380380620019ff833981810160405260608110156200003757600080fd5b8101908080519060200190929190805160405193929190846401000000008211156200006257600080fd5b838201915060208201858111156200007957600080fd5b82518660018202830111640100000000821117156200009757600080fd5b8083526020830192505050908051906020019080838360005b83811015620000cd578082015181840152602081019050620000b0565b50505050905090810190601f168015620000fb5780820380516001836020036101000a031916815260200191505b50604052602001805160405193929190846401000000008211156200011f57600080fd5b838201915060208201858111156200013657600080fd5b82518660018202830111640100000000821117156200015457600080fd5b8083526020830192505050908051906020019080838360005b838110156200018a5780820151818401526020810190506200016d565b50505050905090810190601f168015620001b85780820380516001836020036101000a031916815260200191505b5060405250505081818160009080519060200190620001d99291906200025b565b508060019080519060200190620001f29291906200025b565b506012600360006101000a81548160ff021916908360ff160217905550505082600660006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505050506200030a565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106200029e57805160ff1916838001178555620002cf565b82800160010185558215620002cf579182015b82811115620002ce578251825591602001919060010190620002b1565b5b509050620002de9190620002e2565b5090565b6200030791905b8082111562000303576000816000905550600101620002e9565b5090565b90565b6116e5806200031a6000396000f3fe608060405234801561001057600080fd5b50600436106100b45760003560e01c806370a082311161007157806370a08231146102b857806395d89b41146103105780639dc29fac14610393578063a9059cbb146103e1578063bf95a2c914610447578063dd62ed3e14610491576100b4565b806306fdde03146100b9578063095ea7b31461013c57806318160ddd146101a257806323b872dd146101c0578063313ce5671461024657806340c10f191461026a575b600080fd5b6100c1610509565b6040518080602001828103825283818151815260200191508051906020019080838360005b838110156101015780820151818401526020810190506100e6565b50505050905090810190601f16801561012e5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b6101886004803603604081101561015257600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506105ab565b604051808215151515815260200191505060405180910390f35b6101aa6105c0565b6040518082815260200191505060405180910390f35b61022c600480360360608110156101d657600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506105ca565b604051808215151515815260200191505060405180910390f35b61024e6109bd565b604051808260ff1660ff16815260200191505060405180910390f35b6102b66004803603604081101561028057600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506109d4565b005b6102fa600480360360208110156102ce57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610aa5565b6040518082815260200191505060405180910390f35b610318610aee565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561035857808201518184015260208101905061033d565b50505050905090810190601f1680156103855780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b6103df600480360360408110156103a957600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610b90565b005b61042d600480360360408110156103f757600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610c61565b604051808215151515815260200191505060405180910390f35b61044f610eba565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b6104f3600480360360408110156104a757600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610ee0565b6040518082815260200191505060405180910390f35b606060008054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156105a15780601f10610576576101008083540402835291602001916105a1565b820191906000526020600020905b81548152906001019060200180831161058457829003601f168201915b5050505050905090565b60006105b8338484610f67565b905092915050565b6000600254905090565b600081600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410158015610697575081600560008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410155b156109b1576106ee82600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546110c890919063ffffffff16565b600460008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555061078382600460008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461115090919063ffffffff16565b600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555061085582600560008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461115090919063ffffffff16565b600560008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055507fd1398bee19313d6bf672ccb116e51f4a1a947e91c757907f51fbb5b5e56c698f30858585604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a1600190506109b6565b600090505b9392505050565b6000600360009054906101000a900460ff16905090565b600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610a97576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601c8152602001807f4c656e6453686172653a206f6e6c79206172632063616e206d696e740000000081525060200191505060405180910390fd5b610aa1828261119a565b5050565b6000600460008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b606060018054600181600116156101000203166002900480601f016020809104026020016040519081016040528092919081815260200182805460018160011615610100020316600290048015610b865780601f10610b5b57610100808354040283529160200191610b86565b820191906000526020600020905b815481529060010190602001808311610b6957829003601f168201915b5050505050905090565b600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610c53576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601c8152602001807f4c656e6453686172653a206f6e6c79206172632063616e206275726e0000000081525060200191505060405180910390fd5b610c5d82826113c5565b5050565b600081600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410610eaf57610cfb82600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461115090919063ffffffff16565b600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550610d9082600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546110c890919063ffffffff16565b600460008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055507fd1398bee19313d6bf672ccb116e51f4a1a947e91c757907f51fbb5b5e56c698f30338585604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a160019050610eb4565b600090505b92915050565b600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6000600560008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b600081600560008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055507fa0175360a15bca328baf7ea85c7b784d58b222a50d0ce760b10dba336d226a6130858585604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a1600190509392505050565b600080828401905083811015611146576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601b8152602001807f536166654d6174683a206164646974696f6e206f766572666c6f77000000000081525060200191505060405180910390fd5b8091505092915050565b600061119283836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f7700008152506115f0565b905092915050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16141561123d576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601b8152602001807f43616e6e6f74206d696e7420746f207a65726f2061646472657373000000000081525060200191505060405180910390fd5b61128f81600460008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546110c890919063ffffffff16565b600460008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506112e7816002546110c890919063ffffffff16565b6002819055507fd1398bee19313d6bf672ccb116e51f4a1a947e91c757907f51fbb5b5e56c698f3060008484604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a15050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff161415611468576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260138152602001807f43616e6e6f74206275726e20746f207a65726f0000000000000000000000000081525060200191505060405180910390fd5b6114ba81600460008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461115090919063ffffffff16565b600460008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506115128160025461115090919063ffffffff16565b6002819055507fd1398bee19313d6bf672ccb116e51f4a1a947e91c757907f51fbb5b5e56c698f3083600084604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a15050565b600083831115829061169d576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825283818151815260200191508051906020019080838360005b83811015611662578082015181840152602081019050611647565b50505050905090810190601f16801561168f5780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b506000838503905080915050939250505056fea265627a7a72315820880baa6d990f92d9e234d6b0ebea534e58fef30929da4dffa8f603d315cee7b664736f6c63430005100032";
}
