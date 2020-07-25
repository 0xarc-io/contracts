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

interface IChainLinkAggregatorInterface extends Interface {
  functions: {
    getAnswer: TypedFunctionDescription<{
      encode([roundId]: [BigNumberish]): string;
    }>;

    getTimestamp: TypedFunctionDescription<{
      encode([roundId]: [BigNumberish]): string;
    }>;

    latestAnswer: TypedFunctionDescription<{ encode([]: []): string }>;

    latestRound: TypedFunctionDescription<{ encode([]: []): string }>;

    latestTimestamp: TypedFunctionDescription<{ encode([]: []): string }>;
  };
  events: {
    AnswerUpdated: TypedEventDescription<{
      encodeTopics([current, roundId, timestamp]: [
        BigNumberish | null,
        BigNumberish | null,
        null
      ]): string[];
    }>;

    NewRound: TypedEventDescription<{
      encodeTopics([roundId, startedBy, startedAt]: [
        BigNumberish | null,
        string | null,
        null
      ]): string[];
    }>;
  };
}

export interface IChainLinkAggregator extends Contract {
  interface: IChainLinkAggregatorInterface;
  connect(signerOrProvider: Signer | Provider | string): IChainLinkAggregator;
  attach(addressOrName: string): IChainLinkAggregator;
  deployed(): Promise<IChainLinkAggregator>;
  on(event: EventFilter | string, listener: Listener): IChainLinkAggregator;
  once(event: EventFilter | string, listener: Listener): IChainLinkAggregator;
  addListener(
    eventName: EventFilter | string,
    listener: Listener
  ): IChainLinkAggregator;
  removeAllListeners(eventName: EventFilter | string): IChainLinkAggregator;
  removeListener(eventName: any, listener: Listener): IChainLinkAggregator;

  getAnswer(roundId: BigNumberish): Promise<BigNumber>;
  getTimestamp(roundId: BigNumberish): Promise<BigNumber>;
  latestAnswer(): Promise<BigNumber>;
  latestRound(): Promise<BigNumber>;
  latestTimestamp(): Promise<BigNumber>;

  AnswerUpdated(
    current: BigNumberish | null,
    roundId: BigNumberish | null,
    timestamp: null
  ): EventFilter;
  NewRound(
    roundId: BigNumberish | null,
    startedBy: string | null,
    startedAt: null
  ): EventFilter;

  estimate: {
    getAnswer(roundId: BigNumberish): Promise<BigNumber>;
    getTimestamp(roundId: BigNumberish): Promise<BigNumber>;
    latestAnswer(): Promise<BigNumber>;
    latestRound(): Promise<BigNumber>;
    latestTimestamp(): Promise<BigNumber>;
  };
}

export class IChainLinkAggregator {
  public static at(
    signer: Signer,
    addressOrName: string
  ): IChainLinkAggregator {
    return this.getFactory(signer).attach(
      addressOrName
    ) as IChainLinkAggregator;
  }

  public static deploy(signer: Signer): Promise<IChainLinkAggregator> {
    return this.getFactory(signer).deploy() as Promise<IChainLinkAggregator>;
  }

  public static getDeployTransaction(signer: Signer): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction();
  }

  public static async awaitDeployment(
    signer: Signer,
    overrides?: DeploymentOverrides
  ): Promise<IChainLinkAggregator> {
    const tx = IChainLinkAggregator.getDeployTransaction(signer);
    return awaitContractDeployment(
      signer,
      IChainLinkAggregator.ABI,
      tx,
      overrides
    );
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"anonymous":false,"inputs":[{"indexed":true,"internalType":"int256","name":"current","type":"int256"},{"indexed":true,"internalType":"uint256","name":"roundId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"AnswerUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"roundId","type":"uint256"},{"indexed":true,"internalType":"address","name":"startedBy","type":"address"},{"indexed":false,"internalType":"uint256","name":"startedAt","type":"uint256"}],"name":"NewRound","type":"event"},{"constant":true,"inputs":[{"internalType":"uint256","name":"roundId","type":"uint256"}],"name":"getAnswer","outputs":[{"internalType":"int256","name":"","type":"int256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"roundId","type":"uint256"}],"name":"getTimestamp","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"latestAnswer","outputs":[{"internalType":"int256","name":"","type":"int256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"latestRound","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"latestTimestamp","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}]';
  public static Bytecode = "0x";
}
