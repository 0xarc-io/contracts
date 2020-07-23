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

interface SyntheticTokenInterface extends Interface {
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

    transferCollateral: TypedFunctionDescription<{
      encode([token, to, value]: [string, string, BigNumberish]): string;
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

export interface SyntheticToken extends Contract {
  interface: SyntheticTokenInterface;
  connect(signerOrProvider: Signer | Provider | string): SyntheticToken;
  attach(addressOrName: string): SyntheticToken;
  deployed(): Promise<SyntheticToken>;
  on(event: EventFilter | string, listener: Listener): SyntheticToken;
  once(event: EventFilter | string, listener: Listener): SyntheticToken;
  addListener(
    eventName: EventFilter | string,
    listener: Listener
  ): SyntheticToken;
  removeAllListeners(eventName: EventFilter | string): SyntheticToken;
  removeListener(eventName: any, listener: Listener): SyntheticToken;

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
  transferCollateral(
    token: string,
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
    transferCollateral(
      token: string,
      to: string,
      value: BigNumberish
    ): Promise<BigNumber>;
    transferFrom(
      from: string,
      to: string,
      value: BigNumberish
    ): Promise<BigNumber>;
  };
}

export class SyntheticToken {
  public static at(signer: Signer, addressOrName: string): SyntheticToken {
    return this.getFactory(signer).attach(addressOrName) as SyntheticToken;
  }

  public static deploy(
    signer: Signer,
    _arcAddress: string,
    _name: string,
    _symbol: string
  ): Promise<SyntheticToken> {
    return this.getFactory(signer).deploy(
      _arcAddress,
      _name,
      _symbol
    ) as Promise<SyntheticToken>;
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
  ): Promise<SyntheticToken> {
    const tx = SyntheticToken.getDeployTransaction(
      signer,
      _arcAddress,
      _name,
      _symbol
    );
    return awaitContractDeployment(signer, SyntheticToken.ABI, tx, overrides);
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"inputs":[{"internalType":"address","name":"_arcAddress","type":"address"},{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_symbol","type":"string"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"address","name":"from","type":"address"},{"indexed":false,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"arcAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"who","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"burn","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"mint","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferCollateral","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
  public static Bytecode =
    "0x60806040523480156200001157600080fd5b5060405162001b5838038062001b58833981810160405260608110156200003757600080fd5b8101908080519060200190929190805160405193929190846401000000008211156200006257600080fd5b838201915060208201858111156200007957600080fd5b82518660018202830111640100000000821117156200009757600080fd5b8083526020830192505050908051906020019080838360005b83811015620000cd578082015181840152602081019050620000b0565b50505050905090810190601f168015620000fb5780820380516001836020036101000a031916815260200191505b50604052602001805160405193929190846401000000008211156200011f57600080fd5b838201915060208201858111156200013657600080fd5b82518660018202830111640100000000821117156200015457600080fd5b8083526020830192505050908051906020019080838360005b838110156200018a5780820151818401526020810190506200016d565b50505050905090810190601f168015620001b85780820380516001836020036101000a031916815260200191505b5060405250505081818160009080519060200190620001d99291906200025b565b508060019080519060200190620001f29291906200025b565b506012600360006101000a81548160ff021916908360ff160217905550505082600660006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505050506200030a565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106200029e57805160ff1916838001178555620002cf565b82800160010185558215620002cf579182015b82811115620002ce578251825591602001919060010190620002b1565b5b509050620002de9190620002e2565b5090565b6200030791905b8082111562000303576000816000905550600101620002e9565b5090565b90565b61183e806200031a6000396000f3fe608060405234801561001057600080fd5b50600436106100cf5760003560e01c806370a082311161008c578063a9059cbb11610066578063a9059cbb146103fc578063bf95a2c914610462578063cd60f59f146104ac578063dd62ed3e1461051a576100cf565b806370a08231146102d357806395d89b411461032b5780639dc29fac146103ae576100cf565b806306fdde03146100d4578063095ea7b31461015757806318160ddd146101bd57806323b872dd146101db578063313ce5671461026157806340c10f1914610285575b600080fd5b6100dc610592565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561011c578082015181840152602081019050610101565b50505050905090810190601f1680156101495780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b6101a36004803603604081101561016d57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610634565b604051808215151515815260200191505060405180910390f35b6101c5610649565b6040518082815260200191505060405180910390f35b610247600480360360608110156101f157600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610653565b604051808215151515815260200191505060405180910390f35b610269610a46565b604051808260ff1660ff16815260200191505060405180910390f35b6102d16004803603604081101561029b57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610a5d565b005b610315600480360360208110156102e957600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610b11565b6040518082815260200191505060405180910390f35b610333610b5a565b6040518080602001828103825283818151815260200191508051906020019080838360005b83811015610373578082015181840152602081019050610358565b50505050905090810190601f1680156103a05780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b6103fa600480360360408110156103c457600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610bfc565b005b6104486004803603604081101561041257600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610cb0565b604051808215151515815260200191505060405180910390f35b61046a610f09565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b610518600480360360608110156104c257600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610f2f565b005b61057c6004803603604081101561053057600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610ff7565b6040518082815260200191505060405180910390f35b606060008054600181600116156101000203166002900480601f01602080910402602001604051908101604052809291908181526020018280546001816001161561010002031660029004801561062a5780601f106105ff5761010080835404028352916020019161062a565b820191906000526020600020905b81548152906001019060200180831161060d57829003601f168201915b5050505050905090565b600061064133848461107e565b905092915050565b6000600254905090565b600081600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410158015610720575081600560008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410155b15610a3a5761077782600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546111df90919063ffffffff16565b600460008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555061080c82600460008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461126790919063ffffffff16565b600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506108de82600560008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461126790919063ffffffff16565b600560008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055507fd1398bee19313d6bf672ccb116e51f4a1a947e91c757907f51fbb5b5e56c698f30858585604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a160019050610a3f565b600090505b9392505050565b6000600360009054906101000a900460ff16905090565b600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610b03576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260218152602001806117e96021913960400191505060405180910390fd5b610b0d82826112b1565b5050565b6000600460008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b606060018054600181600116156101000203166002900480601f016020809104026020016040519081016040528092919081815260200182805460018160011615610100020316600290048015610bf25780601f10610bc757610100808354040283529160200191610bf2565b820191906000526020600020905b815481529060010190602001808311610bd557829003601f168201915b5050505050905090565b600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610ca2576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260218152602001806117c86021913960400191505060405180910390fd5b610cac82826114dc565b5050565b600081600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410610efe57610d4a82600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461126790919063ffffffff16565b600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550610ddf82600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546111df90919063ffffffff16565b600460008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055507fd1398bee19313d6bf672ccb116e51f4a1a947e91c757907f51fbb5b5e56c698f30338585604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a160019050610f03565b600090505b92915050565b600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b8273ffffffffffffffffffffffffffffffffffffffff1663a9059cbb83836040518363ffffffff1660e01b8152600401808373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200192505050602060405180830381600087803b158015610fb657600080fd5b505af1158015610fca573d6000803e3d6000fd5b505050506040513d6020811015610fe057600080fd5b810190808051906020019092919050505050505050565b6000600560008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b600081600560008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055507fa0175360a15bca328baf7ea85c7b784d58b222a50d0ce760b10dba336d226a6130858585604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a1600190509392505050565b60008082840190508381101561125d576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601b8152602001807f536166654d6174683a206164646974696f6e206f766572666c6f77000000000081525060200191505060405180910390fd5b8091505092915050565b60006112a983836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f770000815250611707565b905092915050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff161415611354576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601b8152602001807f43616e6e6f74206d696e7420746f207a65726f2061646472657373000000000081525060200191505060405180910390fd5b6113a681600460008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020546111df90919063ffffffff16565b600460008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506113fe816002546111df90919063ffffffff16565b6002819055507fd1398bee19313d6bf672ccb116e51f4a1a947e91c757907f51fbb5b5e56c698f3060008484604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a15050565b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16141561157f576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260138152602001807f43616e6e6f74206275726e20746f207a65726f0000000000000000000000000081525060200191505060405180910390fd5b6115d181600460008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205461126790919063ffffffff16565b600460008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055506116298160025461126790919063ffffffff16565b6002819055507fd1398bee19313d6bf672ccb116e51f4a1a947e91c757907f51fbb5b5e56c698f3083600084604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a15050565b60008383111582906117b4576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825283818151815260200191508051906020019080838360005b8381101561177957808201518184015260208101905061175e565b50505050905090810190601f1680156117a65780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b506000838503905080915050939250505056fe53796e746865746963546f6b656e3a206f6e6c79206172632063616e206275726e53796e746865746963546f6b656e3a206f6e6c79206172632063616e206d696e74a265627a7a72315820ba5790a1b76aa66e8aea6c319a485d6f76e4556a42032661c81b0e0b78ad987464736f6c63430005100032";
}
