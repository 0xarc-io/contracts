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

interface StableTokenInterface extends Interface {
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

    mintShare: TypedFunctionDescription<{ encode([]: []): string }>;

    name: TypedFunctionDescription<{ encode([]: []): string }>;

    owner: TypedFunctionDescription<{ encode([]: []): string }>;

    redeemShare: TypedFunctionDescription<{ encode([]: []): string }>;

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

export interface StableToken extends Contract {
  interface: StableTokenInterface;
  connect(signerOrProvider: Signer | Provider | string): StableToken;
  attach(addressOrName: string): StableToken;
  deployed(): Promise<StableToken>;
  on(event: EventFilter | string, listener: Listener): StableToken;
  once(event: EventFilter | string, listener: Listener): StableToken;
  addListener(eventName: EventFilter | string, listener: Listener): StableToken;
  removeAllListeners(eventName: EventFilter | string): StableToken;
  removeListener(eventName: any, listener: Listener): StableToken;

  allowance(owner: string, spender: string): Promise<BigNumber>;
  approve(
    spender: string,
    value: BigNumberish,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  approvedCollateral(arg0: string): Promise<boolean>;
  balanceOf(who: string): Promise<BigNumber>;
  decimals(): Promise<number>;
  mintShare(overrides?: TransactionOverrides): Promise<ContractTransaction>;
  name(): Promise<string>;
  owner(): Promise<string>;
  redeemShare(overrides?: TransactionOverrides): Promise<ContractTransaction>;
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
    mintShare(): Promise<BigNumber>;
    name(): Promise<BigNumber>;
    owner(): Promise<BigNumber>;
    redeemShare(): Promise<BigNumber>;
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

export class StableToken {
  public static at(signer: Signer, addressOrName: string): StableToken {
    return this.getFactory(signer).attach(addressOrName) as StableToken;
  }

  public static deploy(signer: Signer): Promise<StableToken> {
    return this.getFactory(signer).deploy() as Promise<StableToken>;
  }

  public static getDeployTransaction(signer: Signer): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction();
  }

  public static async awaitDeployment(
    signer: Signer,
    overrides?: DeploymentOverrides
  ): Promise<StableToken> {
    const tx = StableToken.getDeployTransaction(signer);
    return awaitContractDeployment(signer, StableToken.ABI, tx, overrides);
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"address","name":"from","type":"address"},{"indexed":false,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"approvedCollateral","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"who","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"mintShare","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"redeemShare","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
  public static Bytecode =
    "0x60806040523480156200001157600080fd5b506040518060400160405280600c81526020017f537461626c6520546f6b656e00000000000000000000000000000000000000008152506040518060400160405280600281526020017f5354000000000000000000000000000000000000000000000000000000000000815250816000908051906020019062000096929190620000d4565b508060019080519060200190620000af929190620000d4565b506012600360006101000a81548160ff021916908360ff160217905550505062000183565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106200011757805160ff191683800117855562000148565b8280016001018555821562000148579182015b82811115620001475782518255916020019190600101906200012a565b5b5090506200015791906200015b565b5090565b6200018091905b808211156200017c57600081600090555060010162000162565b5090565b90565b61110080620001936000396000f3fe608060405234801561001057600080fd5b50600436106100cf5760003560e01c80636a3356d31161008c57806395d89b411161006657806395d89b411461033b578063a9059cbb146103be578063b050b67214610424578063dd62ed3e14610480576100cf565b80636a3356d31461028f57806370a08231146102995780638da5cb5b146102f1576100cf565b806304f07e29146100d457806306fdde03146100de578063095ea7b31461016157806318160ddd146101c757806323b872dd146101e5578063313ce5671461026b575b600080fd5b6100dc6104f8565b005b6100e66104fa565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561012657808201518184015260208101905061010b565b50505050905090810190601f1680156101535780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b6101ad6004803603604081101561017757600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291908035906020019092919050505061059c565b604051808215151515815260200191505060405180910390f35b6101cf6105b1565b6040518082815260200191505060405180910390f35b610251600480360360608110156101fb57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506105bb565b604051808215151515815260200191505060405180910390f35b6102736109ae565b604051808260ff1660ff16815260200191505060405180910390f35b6102976109c5565b005b6102db600480360360208110156102af57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291905050506109c7565b6040518082815260200191505060405180910390f35b6102f9610a10565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b610343610a36565b6040518080602001828103825283818151815260200191508051906020019080838360005b83811015610383578082015181840152602081019050610368565b50505050905090810190601f1680156103b05780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b61040a600480360360408110156103d457600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff16906020019092919080359060200190929190505050610ad8565b604051808215151515815260200191505060405180910390f35b6104666004803603602081101561043a57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610d31565b604051808215151515815260200191505060405180910390f35b6104e26004803603604081101561049657600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610d51565b6040518082815260200191505060405180910390f35b565b606060008054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156105925780601f1061056757610100808354040283529160200191610592565b820191906000526020600020905b81548152906001019060200180831161057557829003601f168201915b5050505050905090565b60006105a9338484610dd8565b905092915050565b6000600254905090565b600081600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410158015610688575081600560008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410155b156109a2576106df82600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610f3990919063ffffffff16565b600460008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555061077482600460008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610fc190919063ffffffff16565b600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000208190555061084682600560008773ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610fc190919063ffffffff16565b600560008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055507fd1398bee19313d6bf672ccb116e51f4a1a947e91c757907f51fbb5b5e56c698f30858585604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a1600190506109a7565b600090505b9392505050565b6000600360009054906101000a900460ff16905090565b565b6000600460008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b600660009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b606060018054600181600116156101000203166002900480601f016020809104026020016040519081016040528092919081815260200182805460018160011615610100020316600290048015610ace5780601f10610aa357610100808354040283529160200191610ace565b820191906000526020600020905b815481529060010190602001808311610ab157829003601f168201915b5050505050905090565b600081600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410610d2657610b7282600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610fc190919063ffffffff16565b600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002081905550610c0782600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610f3990919063ffffffff16565b600460008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055507fd1398bee19313d6bf672ccb116e51f4a1a947e91c757907f51fbb5b5e56c698f30338585604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a160019050610d2b565b600090505b92915050565b60076020528060005260406000206000915054906101000a900460ff1681565b6000600560008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b600081600560008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055507fa0175360a15bca328baf7ea85c7b784d58b222a50d0ce760b10dba336d226a6130858585604051808573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182815260200194505050505060405180910390a1600190509392505050565b600080828401905083811015610fb7576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040180806020018281038252601b8152602001807f536166654d6174683a206164646974696f6e206f766572666c6f77000000000081525060200191505060405180910390fd5b8091505092915050565b600061100383836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f77000081525061100b565b905092915050565b60008383111582906110b8576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825283818151815260200191508051906020019080838360005b8381101561107d578082015181840152602081019050611062565b50505050905090810190601f1680156110aa5780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b506000838503905080915050939250505056fea265627a7a723158204cb193cd018820da0f7765bd77230b2e534eb1cb9f95ace83f9a21efa02ebc4d64736f6c63430005100032";
}
