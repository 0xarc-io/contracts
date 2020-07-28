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

interface ChainLinkOracleInterface extends Interface {
  functions: {
    CHAIN_LINK_DECIMALS: TypedFunctionDescription<{ encode([]: []): string }>;

    chainLinkAggregator: TypedFunctionDescription<{ encode([]: []): string }>;

    fetchCurrentPrice: TypedFunctionDescription<{ encode([]: []): string }>;
  };
  events: {};
}

export interface ChainLinkOracle extends Contract {
  interface: ChainLinkOracleInterface;
  connect(signerOrProvider: Signer | Provider | string): ChainLinkOracle;
  attach(addressOrName: string): ChainLinkOracle;
  deployed(): Promise<ChainLinkOracle>;
  on(event: EventFilter | string, listener: Listener): ChainLinkOracle;
  once(event: EventFilter | string, listener: Listener): ChainLinkOracle;
  addListener(
    eventName: EventFilter | string,
    listener: Listener
  ): ChainLinkOracle;
  removeAllListeners(eventName: EventFilter | string): ChainLinkOracle;
  removeListener(eventName: any, listener: Listener): ChainLinkOracle;

  CHAIN_LINK_DECIMALS(): Promise<BigNumber>;
  chainLinkAggregator(): Promise<string>;
  fetchCurrentPrice(): Promise<{ value: BigNumber }>;

  estimate: {
    CHAIN_LINK_DECIMALS(): Promise<BigNumber>;
    chainLinkAggregator(): Promise<BigNumber>;
    fetchCurrentPrice(): Promise<BigNumber>;
  };
}

export class ChainLinkOracle {
  public static at(signer: Signer, addressOrName: string): ChainLinkOracle {
    return this.getFactory(signer).attach(addressOrName) as ChainLinkOracle;
  }

  public static deploy(
    signer: Signer,
    _chainLinkAggregator: string
  ): Promise<ChainLinkOracle> {
    return this.getFactory(signer).deploy(_chainLinkAggregator) as Promise<
      ChainLinkOracle
    >;
  }

  public static getDeployTransaction(
    signer: Signer,
    _chainLinkAggregator: string
  ): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction(_chainLinkAggregator);
  }

  public static async awaitDeployment(
    signer: Signer,
    _chainLinkAggregator: string,
    overrides?: DeploymentOverrides
  ): Promise<ChainLinkOracle> {
    const tx = ChainLinkOracle.getDeployTransaction(
      signer,
      _chainLinkAggregator
    );
    return awaitContractDeployment(signer, ChainLinkOracle.ABI, tx, overrides);
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"inputs":[{"internalType":"address","name":"_chainLinkAggregator","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"constant":true,"inputs":[],"name":"CHAIN_LINK_DECIMALS","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"chainLinkAggregator","outputs":[{"internalType":"contract IChainLinkAggregator","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"fetchCurrentPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"}]';
  public static Bytecode =
    "0x608060405234801561001057600080fd5b506040516105503803806105508339818101604052610032919081019061008d565b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550506100ff565b600081519050610087816100e8565b92915050565b60006020828403121561009f57600080fd5b60006100ad84828501610078565b91505092915050565b60006100c1826100c8565b9050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6100f1816100b6565b81146100fc57600080fd5b50565b6104428061010e6000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c806367dbf0c51461004657806396a0e5e314610064578063c72312a014610082575b600080fd5b61004e6100a0565b60405161005b9190610364565b60405180910390f35b61006c6100a8565b6040516100799190610349565b60405180910390f35b61008a610179565b604051610097919061030e565b60405180910390f35b6305f5e10081565b6100b061020e565b60405180602001604052806101716402540be4006000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166350d25bcd6040518163ffffffff1660e01b815260040160206040518083038186803b15801561012b57600080fd5b505afa15801561013f573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506101639190810190610236565b61019e90919063ffffffff16565b815250905090565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6000808314156101b15760009050610208565b60008284029050828482816101c257fe5b0414610203576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016101fa90610329565b60405180910390fd5b809150505b92915050565b6040518060200160405280600081525090565b600081519050610230816103e8565b92915050565b60006020828403121561024857600080fd5b600061025684828501610221565b91505092915050565b610268816103c4565b82525050565b600061027b60218361037f565b91507f536166654d6174683a206d756c7469706c69636174696f6e206f766572666c6f60008301527f77000000000000000000000000000000000000000000000000000000000000006020830152604082019050919050565b6020820160008201516102ea60008501826102f0565b50505050565b6102f9816103ba565b82525050565b610308816103ba565b82525050565b6000602082019050610323600083018461025f565b92915050565b600060208201905081810360008301526103428161026e565b9050919050565b600060208201905061035e60008301846102d4565b92915050565b600060208201905061037960008301846102ff565b92915050565b600082825260208201905092915050565b6000819050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b60006103cf826103d6565b9050919050565b60006103e18261039a565b9050919050565b6103f181610390565b81146103fc57600080fd5b5056fea365627a7a72315820d03b572ad7395ca59af11dddcdce0ef5bb30ce5c0df76d006de81679345d35ca6c6578706572696d656e74616cf564736f6c63430005100040";
}
