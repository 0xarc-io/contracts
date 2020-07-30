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

interface StateV1Interface extends Interface {
  functions: {
    calculateCollateralDelta: TypedFunctionDescription<{
      encode([borrowedAsset, parSupply, parBorrow, borrowIndex, price]: [
        BigNumberish,
        { sign: boolean; value: BigNumberish },
        { sign: boolean; value: BigNumberish },
        {
          borrow: BigNumberish;
          supply: BigNumberish;
          lastUpdate: BigNumberish;
        },
        { value: BigNumberish }
      ]): string;
    }>;

    calculateInverseAmount: TypedFunctionDescription<{
      encode([asset, amount, price]: [
        BigNumberish,
        BigNumberish,
        { value: BigNumberish }
      ]): string;
    }>;

    calculateInverseRequired: TypedFunctionDescription<{
      encode([asset, amount, price]: [
        BigNumberish,
        BigNumberish,
        { value: BigNumberish }
      ]): string;
    }>;

    calculateLiquidationPrice: TypedFunctionDescription<{
      encode([asset]: [BigNumberish]): string;
    }>;

    fetchInterestRate: TypedFunctionDescription<{
      encode([index]: [
        { borrow: BigNumberish; supply: BigNumberish; lastUpdate: BigNumberish }
      ]): string;
    }>;

    fetchNewIndex: TypedFunctionDescription<{
      encode([index]: [
        { borrow: BigNumberish; supply: BigNumberish; lastUpdate: BigNumberish }
      ]): string;
    }>;

    getAddress: TypedFunctionDescription<{
      encode([asset]: [BigNumberish]): string;
    }>;

    getBorrowIndex: TypedFunctionDescription<{
      encode([asset]: [BigNumberish]): string;
    }>;

    getBorrowWei: TypedFunctionDescription<{
      encode([positionId]: [BigNumberish]): string;
    }>;

    getCurrentPrice: TypedFunctionDescription<{ encode([]: []): string }>;

    getIndex: TypedFunctionDescription<{ encode([]: []): string }>;

    getLendAsset: TypedFunctionDescription<{ encode([]: []): string }>;

    getNewParAndDeltaWei: TypedFunctionDescription<{
      encode([currentPar, index, amount]: [
        { sign: boolean; value: BigNumberish },
        {
          borrow: BigNumberish;
          supply: BigNumberish;
          lastUpdate: BigNumberish;
        },
        {
          sign: boolean;
          denomination: BigNumberish;
          ref: BigNumberish;
          value: BigNumberish;
        }
      ]): string;
    }>;

    getPosition: TypedFunctionDescription<{
      encode([id]: [BigNumberish]): string;
    }>;

    getStableAsset: TypedFunctionDescription<{ encode([]: []): string }>;

    getSupplyBalance: TypedFunctionDescription<{
      encode([owner]: [string]): string;
    }>;

    getSupplyWei: TypedFunctionDescription<{
      encode([supplier]: [string]): string;
    }>;

    getSyntheticAsset: TypedFunctionDescription<{ encode([]: []): string }>;

    getTotalPar: TypedFunctionDescription<{ encode([]: []): string }>;

    globalIndex: TypedFunctionDescription<{ encode([]: []): string }>;

    isCollateralized: TypedFunctionDescription<{
      encode([position]: [
        {
          owner: string;
          collateralAsset: BigNumberish;
          borrowedAsset: BigNumberish;
          collateralAmount: { sign: boolean; value: BigNumberish };
          borrowedAmount: { sign: boolean; value: BigNumberish };
        }
      ]): string;
    }>;

    params: TypedFunctionDescription<{ encode([]: []): string }>;

    positionCount: TypedFunctionDescription<{ encode([]: []): string }>;

    positions: TypedFunctionDescription<{ encode([]: [BigNumberish]): string }>;

    removeExcessTokens: TypedFunctionDescription<{
      encode([to]: [string]): string;
    }>;

    savePosition: TypedFunctionDescription<{
      encode([position]: [
        {
          owner: string;
          collateralAsset: BigNumberish;
          borrowedAsset: BigNumberish;
          collateralAmount: { sign: boolean; value: BigNumberish };
          borrowedAmount: { sign: boolean; value: BigNumberish };
        }
      ]): string;
    }>;

    setAmount: TypedFunctionDescription<{
      encode([id, asset, amount]: [
        BigNumberish,
        BigNumberish,
        { sign: boolean; value: BigNumberish }
      ]): string;
    }>;

    setCollateralRatio: TypedFunctionDescription<{
      encode([ratio]: [{ value: BigNumberish }]): string;
    }>;

    setEarningsRate: TypedFunctionDescription<{
      encode([rate]: [{ value: BigNumberish }]): string;
    }>;

    setInterestSetter: TypedFunctionDescription<{
      encode([_setter]: [string]): string;
    }>;

    setLiquidationSpread: TypedFunctionDescription<{
      encode([spread]: [{ value: BigNumberish }]): string;
    }>;

    setOracle: TypedFunctionDescription<{
      encode([_oracle]: [string]): string;
    }>;

    setOriginationFee: TypedFunctionDescription<{
      encode([fee]: [{ value: BigNumberish }]): string;
    }>;

    setSyntheticRatio: TypedFunctionDescription<{
      encode([ratio]: [{ value: BigNumberish }]): string;
    }>;

    totalPar: TypedFunctionDescription<{ encode([]: []): string }>;

    updateIndex: TypedFunctionDescription<{ encode([]: []): string }>;

    updatePositionAmount: TypedFunctionDescription<{
      encode([id, asset, amount]: [
        BigNumberish,
        BigNumberish,
        { sign: boolean; value: BigNumberish }
      ]): string;
    }>;

    updateTotalPar: TypedFunctionDescription<{
      encode([existingPar, newPar]: [
        { sign: boolean; value: BigNumberish },
        { sign: boolean; value: BigNumberish }
      ]): string;
    }>;
  };
  events: {
    GlobalParamsUpdate: TypedEventDescription<{
      encodeTopics([updatedParams]: [null]): string[];
    }>;

    LogIndexUpdate: TypedEventDescription<{
      encodeTopics([updatedIndex]: [null]): string[];
    }>;
  };
}

export interface StateV1 extends Contract {
  interface: StateV1Interface;
  connect(signerOrProvider: Signer | Provider | string): StateV1;
  attach(addressOrName: string): StateV1;
  deployed(): Promise<StateV1>;
  on(event: EventFilter | string, listener: Listener): StateV1;
  once(event: EventFilter | string, listener: Listener): StateV1;
  addListener(eventName: EventFilter | string, listener: Listener): StateV1;
  removeAllListeners(eventName: EventFilter | string): StateV1;
  removeListener(eventName: any, listener: Listener): StateV1;

  calculateCollateralDelta(
    borrowedAsset: BigNumberish,
    parSupply: { sign: boolean; value: BigNumberish },
    parBorrow: { sign: boolean; value: BigNumberish },
    borrowIndex: {
      borrow: BigNumberish;
      supply: BigNumberish;
      lastUpdate: BigNumberish;
    },
    price: { value: BigNumberish }
  ): Promise<{ sign: boolean; value: BigNumber }>;
  calculateInverseAmount(
    asset: BigNumberish,
    amount: BigNumberish,
    price: { value: BigNumberish }
  ): Promise<BigNumber>;
  calculateInverseRequired(
    asset: BigNumberish,
    amount: BigNumberish,
    price: { value: BigNumberish }
  ): Promise<{ sign: boolean; value: BigNumber }>;
  calculateLiquidationPrice(asset: BigNumberish): Promise<{ value: BigNumber }>;
  fetchInterestRate(index: {
    borrow: BigNumberish;
    supply: BigNumberish;
    lastUpdate: BigNumberish;
  }): Promise<{ value: BigNumber }>;
  fetchNewIndex(index: {
    borrow: BigNumberish;
    supply: BigNumberish;
    lastUpdate: BigNumberish;
  }): Promise<{ borrow: BigNumber; supply: BigNumber; lastUpdate: number }>;
  getAddress(asset: BigNumberish): Promise<string>;
  getBorrowIndex(
    asset: BigNumberish
  ): Promise<{ borrow: BigNumber; supply: BigNumber; lastUpdate: number }>;
  getBorrowWei(positionId: BigNumberish): Promise<BigNumber>;
  getCurrentPrice(): Promise<{ value: BigNumber }>;
  getIndex(): Promise<{
    borrow: BigNumber;
    supply: BigNumber;
    lastUpdate: number;
  }>;
  getLendAsset(): Promise<string>;
  getNewParAndDeltaWei(
    currentPar: { sign: boolean; value: BigNumberish },
    index: {
      borrow: BigNumberish;
      supply: BigNumberish;
      lastUpdate: BigNumberish;
    },
    amount: {
      sign: boolean;
      denomination: BigNumberish;
      ref: BigNumberish;
      value: BigNumberish;
    }
  ): Promise<{
    0: { sign: boolean; value: BigNumber };
    1: { sign: boolean; value: BigNumber };
  }>;
  getPosition(
    id: BigNumberish
  ): Promise<{
    owner: string;
    collateralAsset: number;
    borrowedAsset: number;
    collateralAmount: { sign: boolean; value: BigNumber };
    borrowedAmount: { sign: boolean; value: BigNumber };
  }>;
  getStableAsset(): Promise<string>;
  getSupplyBalance(owner: string): Promise<{ sign: boolean; value: BigNumber }>;
  getSupplyWei(supplier: string): Promise<BigNumber>;
  getSyntheticAsset(): Promise<string>;
  getTotalPar(): Promise<{
    0: BigNumber;
    1: BigNumber;
  }>;
  globalIndex(): Promise<{
    borrow: BigNumber;
    supply: BigNumber;
    lastUpdate: number;
    0: BigNumber;
    1: BigNumber;
    2: number;
  }>;
  isCollateralized(position: {
    owner: string;
    collateralAsset: BigNumberish;
    borrowedAsset: BigNumberish;
    collateralAmount: { sign: boolean; value: BigNumberish };
    borrowedAmount: { sign: boolean; value: BigNumberish };
  }): Promise<boolean>;
  params(): Promise<{
    stableAsset: string;
    lendAsset: string;
    syntheticAsset: string;
    interestSetter: string;
    collateralRatio: { value: BigNumber };
    syntheticRatio: { value: BigNumber };
    liquidationSpread: { value: BigNumber };
    originationFee: { value: BigNumber };
    earningsRate: { value: BigNumber };
    oracle: string;
    0: string;
    1: string;
    2: string;
    3: string;
    4: { value: BigNumber };
    5: { value: BigNumber };
    6: { value: BigNumber };
    7: { value: BigNumber };
    8: { value: BigNumber };
    9: string;
  }>;
  positionCount(): Promise<BigNumber>;
  positions(
    arg0: BigNumberish
  ): Promise<{
    owner: string;
    collateralAsset: number;
    borrowedAsset: number;
    collateralAmount: { sign: boolean; value: BigNumber };
    borrowedAmount: { sign: boolean; value: BigNumber };
    0: string;
    1: number;
    2: number;
    3: { sign: boolean; value: BigNumber };
    4: { sign: boolean; value: BigNumber };
  }>;
  removeExcessTokens(
    to: string,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  savePosition(
    position: {
      owner: string;
      collateralAsset: BigNumberish;
      borrowedAsset: BigNumberish;
      collateralAmount: { sign: boolean; value: BigNumberish };
      borrowedAmount: { sign: boolean; value: BigNumberish };
    },
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  setAmount(
    id: BigNumberish,
    asset: BigNumberish,
    amount: { sign: boolean; value: BigNumberish },
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  setCollateralRatio(
    ratio: { value: BigNumberish },
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  setEarningsRate(
    rate: { value: BigNumberish },
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  setInterestSetter(
    _setter: string,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  setLiquidationSpread(
    spread: { value: BigNumberish },
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  setOracle(
    _oracle: string,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  setOriginationFee(
    fee: { value: BigNumberish },
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  setSyntheticRatio(
    ratio: { value: BigNumberish },
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  totalPar(): Promise<{
    borrow: BigNumber;
    supply: BigNumber;
    0: BigNumber;
    1: BigNumber;
  }>;
  updateIndex(overrides?: TransactionOverrides): Promise<ContractTransaction>;
  updatePositionAmount(
    id: BigNumberish,
    asset: BigNumberish,
    amount: { sign: boolean; value: BigNumberish },
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  updateTotalPar(
    existingPar: { sign: boolean; value: BigNumberish },
    newPar: { sign: boolean; value: BigNumberish },
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;

  GlobalParamsUpdate(updatedParams: null): EventFilter;
  LogIndexUpdate(updatedIndex: null): EventFilter;

  estimate: {
    calculateCollateralDelta(
      borrowedAsset: BigNumberish,
      parSupply: { sign: boolean; value: BigNumberish },
      parBorrow: { sign: boolean; value: BigNumberish },
      borrowIndex: {
        borrow: BigNumberish;
        supply: BigNumberish;
        lastUpdate: BigNumberish;
      },
      price: { value: BigNumberish }
    ): Promise<BigNumber>;
    calculateInverseAmount(
      asset: BigNumberish,
      amount: BigNumberish,
      price: { value: BigNumberish }
    ): Promise<BigNumber>;
    calculateInverseRequired(
      asset: BigNumberish,
      amount: BigNumberish,
      price: { value: BigNumberish }
    ): Promise<BigNumber>;
    calculateLiquidationPrice(asset: BigNumberish): Promise<BigNumber>;
    fetchInterestRate(index: {
      borrow: BigNumberish;
      supply: BigNumberish;
      lastUpdate: BigNumberish;
    }): Promise<BigNumber>;
    fetchNewIndex(index: {
      borrow: BigNumberish;
      supply: BigNumberish;
      lastUpdate: BigNumberish;
    }): Promise<BigNumber>;
    getAddress(asset: BigNumberish): Promise<BigNumber>;
    getBorrowIndex(asset: BigNumberish): Promise<BigNumber>;
    getBorrowWei(positionId: BigNumberish): Promise<BigNumber>;
    getCurrentPrice(): Promise<BigNumber>;
    getIndex(): Promise<BigNumber>;
    getLendAsset(): Promise<BigNumber>;
    getNewParAndDeltaWei(
      currentPar: { sign: boolean; value: BigNumberish },
      index: {
        borrow: BigNumberish;
        supply: BigNumberish;
        lastUpdate: BigNumberish;
      },
      amount: {
        sign: boolean;
        denomination: BigNumberish;
        ref: BigNumberish;
        value: BigNumberish;
      }
    ): Promise<BigNumber>;
    getPosition(id: BigNumberish): Promise<BigNumber>;
    getStableAsset(): Promise<BigNumber>;
    getSupplyBalance(owner: string): Promise<BigNumber>;
    getSupplyWei(supplier: string): Promise<BigNumber>;
    getSyntheticAsset(): Promise<BigNumber>;
    getTotalPar(): Promise<BigNumber>;
    globalIndex(): Promise<BigNumber>;
    isCollateralized(position: {
      owner: string;
      collateralAsset: BigNumberish;
      borrowedAsset: BigNumberish;
      collateralAmount: { sign: boolean; value: BigNumberish };
      borrowedAmount: { sign: boolean; value: BigNumberish };
    }): Promise<BigNumber>;
    params(): Promise<BigNumber>;
    positionCount(): Promise<BigNumber>;
    positions(arg0: BigNumberish): Promise<BigNumber>;
    removeExcessTokens(to: string): Promise<BigNumber>;
    savePosition(position: {
      owner: string;
      collateralAsset: BigNumberish;
      borrowedAsset: BigNumberish;
      collateralAmount: { sign: boolean; value: BigNumberish };
      borrowedAmount: { sign: boolean; value: BigNumberish };
    }): Promise<BigNumber>;
    setAmount(
      id: BigNumberish,
      asset: BigNumberish,
      amount: { sign: boolean; value: BigNumberish }
    ): Promise<BigNumber>;
    setCollateralRatio(ratio: { value: BigNumberish }): Promise<BigNumber>;
    setEarningsRate(rate: { value: BigNumberish }): Promise<BigNumber>;
    setInterestSetter(_setter: string): Promise<BigNumber>;
    setLiquidationSpread(spread: { value: BigNumberish }): Promise<BigNumber>;
    setOracle(_oracle: string): Promise<BigNumber>;
    setOriginationFee(fee: { value: BigNumberish }): Promise<BigNumber>;
    setSyntheticRatio(ratio: { value: BigNumberish }): Promise<BigNumber>;
    totalPar(): Promise<BigNumber>;
    updateIndex(): Promise<BigNumber>;
    updatePositionAmount(
      id: BigNumberish,
      asset: BigNumberish,
      amount: { sign: boolean; value: BigNumberish }
    ): Promise<BigNumber>;
    updateTotalPar(
      existingPar: { sign: boolean; value: BigNumberish },
      newPar: { sign: boolean; value: BigNumberish }
    ): Promise<BigNumber>;
  };
}

export class StateV1 {
  public static at(signer: Signer, addressOrName: string): StateV1 {
    return this.getFactory(signer).attach(addressOrName) as StateV1;
  }

  public static deploy(
    signer: Signer,
    _core: string,
    _admin: string,
    _globalParams: {
      stableAsset: string;
      lendAsset: string;
      syntheticAsset: string;
      interestSetter: string;
      collateralRatio: { value: BigNumberish };
      syntheticRatio: { value: BigNumberish };
      liquidationSpread: { value: BigNumberish };
      originationFee: { value: BigNumberish };
      earningsRate: { value: BigNumberish };
      oracle: string;
    }
  ): Promise<StateV1> {
    return this.getFactory(signer).deploy(
      _core,
      _admin,
      _globalParams
    ) as Promise<StateV1>;
  }

  public static getDeployTransaction(
    signer: Signer,
    _core: string,
    _admin: string,
    _globalParams: {
      stableAsset: string;
      lendAsset: string;
      syntheticAsset: string;
      interestSetter: string;
      collateralRatio: { value: BigNumberish };
      syntheticRatio: { value: BigNumberish };
      liquidationSpread: { value: BigNumberish };
      originationFee: { value: BigNumberish };
      earningsRate: { value: BigNumberish };
      oracle: string;
    }
  ): UnsignedTransaction {
    return this.getFactory(signer).getDeployTransaction(
      _core,
      _admin,
      _globalParams
    );
  }

  public static async awaitDeployment(
    signer: Signer,
    _core: string,
    _admin: string,
    _globalParams: {
      stableAsset: string;
      lendAsset: string;
      syntheticAsset: string;
      interestSetter: string;
      collateralRatio: { value: BigNumberish };
      syntheticRatio: { value: BigNumberish };
      liquidationSpread: { value: BigNumberish };
      originationFee: { value: BigNumberish };
      earningsRate: { value: BigNumberish };
      oracle: string;
    },
    overrides?: DeploymentOverrides
  ): Promise<StateV1> {
    const tx = StateV1.getDeployTransaction(
      signer,
      _core,
      _admin,
      _globalParams
    );
    return awaitContractDeployment(signer, StateV1.ABI, tx, overrides);
  }

  private static getFactory(signer: Signer): ContractFactory {
    return new ContractFactory(this.ABI, this.Bytecode, signer);
  }

  public static ABI =
    '[{"inputs":[{"internalType":"address","name":"_core","type":"address"},{"internalType":"address","name":"_admin","type":"address"},{"components":[{"internalType":"contract IERC20","name":"stableAsset","type":"address"},{"internalType":"contract IMintableToken","name":"lendAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"internalType":"contract IInterestSetter","name":"interestSetter","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"earningsRate","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"internalType":"struct Types.GlobalParams","name":"_globalParams","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"components":[{"internalType":"contract IERC20","name":"stableAsset","type":"address"},{"internalType":"contract IMintableToken","name":"lendAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"internalType":"contract IInterestSetter","name":"interestSetter","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"earningsRate","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"indexed":false,"internalType":"struct Types.GlobalParams","name":"updatedParams","type":"tuple"}],"name":"GlobalParamsUpdate","type":"event"},{"anonymous":false,"inputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"indexed":false,"internalType":"struct Interest.Index","name":"updatedIndex","type":"tuple"}],"name":"LogIndexUpdate","type":"event"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"parSupply","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"parBorrow","type":"tuple"},{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"borrowIndex","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateCollateralDelta","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateInverseAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateInverseRequired","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"calculateLiquidationPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"index","type":"tuple"}],"name":"fetchInterestRate","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Interest.Rate","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"index","type":"tuple"}],"name":"fetchNewIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"getAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"getBorrowIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"positionId","type":"uint256"}],"name":"getBorrowWei","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getCurrentPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendAsset","outputs":[{"internalType":"contract IMintableToken","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"currentPar","type":"tuple"},{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"index","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"enum Types.AssetDenomination","name":"denomination","type":"uint8"},{"internalType":"enum Types.AssetReference","name":"ref","type":"uint8"},{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Types.AssetAmount","name":"amount","type":"tuple"}],"name":"getNewParAndDeltaWei","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Types.Wei","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getPosition","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getStableAsset","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"getSupplyBalance","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"supplier","type":"address"}],"name":"getSupplyWei","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getSyntheticAsset","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getTotalPar","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"globalIndex","outputs":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"position","type":"tuple"}],"name":"isCollateralized","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"params","outputs":[{"internalType":"contract IERC20","name":"stableAsset","type":"address"},{"internalType":"contract IMintableToken","name":"lendAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"internalType":"contract IInterestSetter","name":"interestSetter","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"earningsRate","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"positionCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"positions","outputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"removeExcessTokens","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"position","type":"tuple"}],"name":"savePosition","outputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"amount","type":"tuple"}],"name":"setAmount","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"ratio","type":"tuple"}],"name":"setCollateralRatio","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"rate","type":"tuple"}],"name":"setEarningsRate","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_setter","type":"address"}],"name":"setInterestSetter","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"spread","type":"tuple"}],"name":"setLiquidationSpread","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_oracle","type":"address"}],"name":"setOracle","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"fee","type":"tuple"}],"name":"setOriginationFee","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"ratio","type":"tuple"}],"name":"setSyntheticRatio","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalPar","outputs":[{"internalType":"uint128","name":"borrow","type":"uint128"},{"internalType":"uint128","name":"supply","type":"uint128"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"updateIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"amount","type":"tuple"}],"name":"updatePositionAmount","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"existingPar","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"newPar","type":"tuple"}],"name":"updateTotalPar","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
  public static Bytecode =
    "0x60806040523480156200001157600080fd5b506040516200662f3803806200662f833981810160405262000037919081019062000669565b826000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555081600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555080600260008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160010160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060408201518160020160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060608201518160030160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060808201518160040160008201518160000155505060a08201518160050160008201518160000155505060c08201518160060160008201518160000155505060e082015181600701600082015181600001555050610100820151816008016000820151816000015550506101208201518160090160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550905050620002a16200034460201b620041e71760201c565b600d60008201518160000160006101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff160217905550602082015181600001600c6101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff16021790555060408201518160000160186101000a81548163ffffffff021916908363ffffffff160217905550905050505050620008bb565b6200034e6200043f565b6040518060600160405280670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001620003ba620003c860201b62003f0d1760201c565b63ffffffff16815250905090565b6000620003e042620003e560201b620044711760201c565b905090565b600080829050828163ffffffff161462000436576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016200042d9062000702565b60405180910390fd5b80915050919050565b604051806060016040528060006bffffffffffffffffffffffff16815260200160006bffffffffffffffffffffffff168152602001600063ffffffff1681525090565b600081519050620004938162000805565b92915050565b600081519050620004aa816200081f565b92915050565b600081519050620004c18162000839565b92915050565b600081519050620004d88162000853565b92915050565b600081519050620004ef816200086d565b92915050565b600081519050620005068162000887565b92915050565b6000602082840312156200051f57600080fd5b6200052b602062000724565b905060006200053d8482850162000652565b60008301525092915050565b600061014082840312156200055d57600080fd5b6200056a61014062000724565b905060006200057c8482850162000499565b60008301525060206200059284828501620004c7565b6020830152506040620005a884828501620004f5565b6040830152506060620005be84828501620004b0565b6060830152506080620005d4848285016200050c565b60808301525060a0620005ea848285016200050c565b60a08301525060c062000600848285016200050c565b60c08301525060e062000616848285016200050c565b60e0830152506101006200062d848285016200050c565b610100830152506101206200064584828501620004de565b6101208301525092915050565b6000815190506200066381620008a1565b92915050565b600080600061018084860312156200068057600080fd5b6000620006908682870162000482565b9350506020620006a38682870162000482565b9250506040620006b68682870162000549565b9150509250925092565b6000620006cf601b8362000752565b91507f4d6174683a20556e73616665206361737420746f2075696e74333200000000006000830152602082019050919050565b600060208201905081810360008301526200071d81620006c0565b9050919050565b6000604051905081810181811067ffffffffffffffff821117156200074857600080fd5b8060405250919050565b600082825260208201905092915050565b60006200077082620007db565b9050919050565b6000620007848262000763565b9050919050565b6000620007988262000763565b9050919050565b6000620007ac8262000763565b9050919050565b6000620007c08262000763565b9050919050565b6000620007d48262000763565b9050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b620008108162000763565b81146200081c57600080fd5b50565b6200082a8162000777565b81146200083657600080fd5b50565b62000844816200078b565b81146200085057600080fd5b50565b6200085e816200079f565b81146200086a57600080fd5b50565b6200087881620007b3565b81146200088457600080fd5b50565b6200089281620007c7565b81146200089e57600080fd5b50565b620008ac81620007fb565b8114620008b857600080fd5b50565b615d6480620008cb6000396000f3fe608060405234801561001057600080fd5b50600436106102325760003560e01c80639997640d11610130578063e043095a116100b8578063eb02c3011161007c578063eb02c30114610711578063eb91d37e14610741578063ef9d39261461075f578063f38e266a1461078f578063f9bd3235146107bf57610232565b8063e043095a14610659578063e2e02e0c14610675578063e2f6720e146106a5578063e7702d05146106d5578063e7a45f2e146106f357610232565b8063b9f412b0116100ff578063b9f412b014610594578063bcaa0c55146105b2578063bf0b4927146105e2578063cff0ab9614610612578063d890a8701461063957610232565b80639997640d1461050757806399fbab8814610523578063b17e32f914610557578063b44c061f1461057557610232565b8063599b81e7116101be5780637adbf973116101825780637adbf9731461043d5780637c7c200a1461045957806381045ead146104895780638a627d0d146104a757806396d7d7e1146104d757610232565b8063599b81e714610398578063651fafe1146103c85780636e830f4a146103e4578063740e67ef14610400578063743bd7c91461041e57610232565b80632626ab08116102055780632626ab08146102e45780632863612b1461030057806340052049146103305780634c2fbfc61461036057806356cffd131461037c57610232565b80630625dce1146102375780630e884c12146102535780631896174e146102845780631e31274a146102b4575b600080fd5b610251600480360361024c9190810190614be4565b6107ef565b005b61026d60048036036102689190810190614c5f565b6108cd565b60405161027b929190615782565b60405180910390f35b61029e60048036036102999190810190614ceb565b610a8a565b6040516102ab919061580a565b60405180910390f35b6102ce60048036036102c99190810190614ceb565b610cbd565b6040516102db919061552b565b60405180910390f35b6102fe60048036036102f99190810190614be4565b610dd5565b005b61031a60048036036103159190810190614af3565b610eb3565b60405161032791906156fa565b60405180910390f35b61034a60048036036103459190810190614d8f565b611000565b60405161035791906157ab565b60405180910390f35b61037a60048036036103759190810190614be4565b611369565b005b61039660048036036103919190810190614caf565b611447565b005b6103b260048036036103ad9190810190614c36565b61178b565b6040516103bf91906157c6565b60405180910390f35b6103e260048036036103dd9190810190614be4565b611945565b005b6103fe60048036036103f99190810190614be4565b611a23565b005b610408611b01565b6040516104159190615546565b60405180910390f35b610426611b2e565b6040516104349291906157e1565b60405180910390f35b61045760048036036104529190810190614aa1565b611b78565b005b610473600480360361046e9190810190614b95565b611c87565b604051610480919061580a565b60405180910390f35b610491611cf1565b60405161049e9190615731565b60405180910390f35b6104c160048036036104bc9190810190614c36565b611dad565b6040516104ce9190615731565b60405180910390f35b6104f160048036036104ec9190810190614b95565b611e95565b6040516104fe9190615767565b60405180910390f35b610521600480360361051c9190810190614aa1565b611f76565b005b61053d60048036036105389190810190614d3d565b612085565b60405161054e959493929190615478565b60405180910390f35b61055f6121d3565b60405161056c91906155fd565b60405180910390f35b61057d612200565b60405161058b929190615825565b60405180910390f35b61059c612279565b6040516105a99190615731565b60405180910390f35b6105cc60048036036105c79190810190614af3565b6125a5565b6040516105d9919061545d565b60405180910390f35b6105fc60048036036105f79190810190614b1c565b61261c565b6040516106099190615767565b60405180910390f35b61061a6126d2565b6040516106309a99989796959493929190615561565b60405180910390f35b610641612818565b6040516106509392919061584e565b60405180910390f35b610673600480360361066e9190810190614aa1565b612870565b005b61068f600480360361068a9190810190614d8f565b6129cd565b60405161069c91906157ab565b60405180910390f35b6106bf60048036036106ba9190810190614d3d565b612e40565b6040516106cc919061580a565b60405180910390f35b6106dd613047565b6040516106ea919061580a565b60405180910390f35b6106fb61304d565b6040516107089190615546565b60405180910390f35b61072b60048036036107269190810190614d3d565b613079565b60405161073891906157ab565b60405180910390f35b610749613248565b60405161075691906156fa565b60405180910390f35b61077960048036036107749190810190614af3565b6132f8565b6040516107869190615731565b60405180910390f35b6107a960048036036107a49190810190614aa1565b6133e5565b6040516107b69190615767565b60405180910390f35b6107d960048036036107d49190810190614aa1565b6134d3565b6040516107e6919061580a565b60405180910390f35b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461087f576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016108769061563a565b60405180910390fd5b806002600801600082015181600001559050507f26dc705bd82557c9b04b12ffc791436879cc8ea5bb10fb1fa1d1e6ff2293774060026040516108c29190615715565b60405180910390a150565b6108d56145d6565b6108dd614604565b6000836060015114801561090b5750600060018111156108f957fe5b8360400151600181111561090957fe5b145b15610922578461091961351a565b91509150610a82565b61092a614604565b6109348686613540565b905061093e6145d6565b610946614604565b6000600181111561095357fe5b8660200151600181111561096357fe5b14156109e55760405180604001604052808760000151151581526020018760600151815250905060018081111561099657fe5b866040015160018111156109a657fe5b14156109c2576109bf838261361f90919063ffffffff16565b90505b6109de6109d8828561364190919063ffffffff16565b88613717565b9150610a78565b6040518060400160405280876000015115158152602001610a098860600151613815565b6fffffffffffffffffffffffffffffffff16815250915060006001811115610a2d57fe5b86604001516001811115610a3d57fe5b1415610a5957610a56828961387890919063ffffffff16565b91505b610a7583610a67848a613540565b61361f90919063ffffffff16565b90505b8181945094505050505b935093915050565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610b1b576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610b129061563a565b60405180910390fd5b600e54905081600f6000600e54815260200190815260200160002060008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160000160146101000a81548160ff02191690836001811115610ba157fe5b021790555060408201518160000160156101000a81548160ff02191690836001811115610bca57fe5b021790555060608201518160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550505060808201518160020160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055505050905050600e60008154809291906001019190505550919050565b6000808260800151602001516fffffffffffffffffffffffffffffffff161415610cea5760019050610dd0565b610cf2614620565b600260090160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b158015610d5d57600080fd5b505afa158015610d71573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250610d959190810190614c0d565b9050610d9f6145d6565b610dc4846040015185606001518660800151610dbe88604001516132f8565b8661261c565b90508060000151925050505b919050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610e65576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610e5c9061563a565b60405180910390fd5b806002600401600082015181600001559050507f26dc705bd82557c9b04b12ffc791436879cc8ea5bb10fb1fa1d1e6ff229377406002604051610ea89190615715565b60405180910390a150565b610ebb614620565b610ec3614620565b610ecb614620565b600260090160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b158015610f3657600080fd5b505afa158015610f4a573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250610f6e9190810190614c0d565b905060006001811115610f7d57fe5b846001811115610f8957fe5b1415610faf57610fa8610f9a613a68565b600260060160000154613a8c565b9150610fea565b600180811115610fbb57fe5b846001811115610fc757fe5b1415610fe957610fe6610fd8613a68565b600260060160000154613ac1565b91505b5b610ff48183613af6565b91508192505050919050565b611008614633565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611097576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161108e9061563a565b60405180910390fd5b6000600f600086815260200190815260200160002090508360018111156110ba57fe5b8160000160149054906101000a900460ff1660018111156110d757fe5b141561114957828160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055509050506111b1565b828160020160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055509050505b806040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff16600181111561123157fe5b600181111561123c57fe5b81526020016000820160159054906101000a900460ff16600181111561125e57fe5b600181111561126957fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509150509392505050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146113f9576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016113f09061563a565b60405180910390fd5b806002600701600082015181600001559050507f26dc705bd82557c9b04b12ffc791436879cc8ea5bb10fb1fa1d1e6ff22937740600260405161143c9190615715565b60405180910390a150565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146114d6576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016114cd9061563a565b60405180910390fd5b6114e08282613b2f565b156114ea57611787565b8160000151156115985761155861155383602001516fffffffffffffffffffffffffffffffff16600c60000160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16613bae90919063ffffffff16565b613815565b600c60000160106101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550611638565b6115fc6115f783602001516fffffffffffffffffffffffffffffffff16600c60000160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16613bae90919063ffffffff16565b613815565b600c60000160006101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055505b8060000151156116e6576116a66116a182602001516fffffffffffffffffffffffffffffffff16600c60000160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16613bf890919063ffffffff16565b613815565b600c60000160106101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550611786565b61174a61174582602001516fffffffffffffffffffffffffffffffff16600c60000160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16613bf890919063ffffffff16565b613815565b600c60000160006101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055505b5b5050565b61179361469a565b61179b614604565b6117a3614604565b61184d600c6040518060400160405290816000820160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681526020016000820160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505085613c4d565b9150915061185961469a565b600260030160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663e8177dcf600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16846020015186602001516040518463ffffffff1660e01b81526004016118e8939291906154f4565b60206040518083038186803b15801561190057600080fd5b505afa158015611914573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506119389190810190614d14565b9050809350505050919050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146119d5576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016119cc9061563a565b60405180910390fd5b806002600601600082015181600001559050507f26dc705bd82557c9b04b12ffc791436879cc8ea5bb10fb1fa1d1e6ff229377406002604051611a189190615715565b60405180910390a150565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611ab3576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611aaa9061563a565b60405180910390fd5b806002600501600082015181600001559050507f26dc705bd82557c9b04b12ffc791436879cc8ea5bb10fb1fa1d1e6ff229377406002604051611af69190615715565b60405180910390a150565b6000600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b600c8060000160009054906101000a90046fffffffffffffffffffffffffffffffff16908060000160109054906101000a90046fffffffffffffffffffffffffffffffff16905082565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611c08576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611bff9061563a565b60405180910390fd5b80600260090160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507f26dc705bd82557c9b04b12ffc791436879cc8ea5bb10fb1fa1d1e6ff229377406002604051611c7c9190615715565b60405180910390a150565b60008060006001811115611c9757fe5b856001811115611ca357fe5b1415611cba57611cb38484613d06565b9050611ce6565b600180811115611cc657fe5b856001811115611cd257fe5b1415611ce557611ce28484613d27565b90505b5b809150509392505050565b611cf96146ad565b600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff1681525050905090565b611db56146ad565b611dbd61469a565b611dc68361178b565b9050611e8d8382600c6040518060400160405290816000820160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681526020016000820160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250506002600801604051806020016040529081600082015481525050613d48565b915050919050565b611e9d6145d6565b6000611eaa858585611c87565b905060006001811115611eb957fe5b856001811115611ec557fe5b1415611ef557611eee816002600501604051806020016040529081600082015481525050613d27565b9050611f3a565b600180811115611f0157fe5b856001811115611f0d57fe5b1415611f3957611f36816002600401604051806020016040529081600082015481525050613d27565b90505b5b6040518060400160405280600115158152602001611f5783613815565b6fffffffffffffffffffffffffffffffff168152509150509392505050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614612006576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611ffd9061563a565b60405180910390fd5b80600260030160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507f26dc705bd82557c9b04b12ffc791436879cc8ea5bb10fb1fa1d1e6ff22937740600260405161207a9190615715565b60405180910390a150565b600f6020528060005260406000206000915090508060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060000160149054906101000a900460ff16908060000160159054906101000a900460ff1690806001016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505090806002016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050905085565b6000600260010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b600080600c60000160109054906101000a90046fffffffffffffffffffffffffffffffff16600c60000160009054906101000a90046fffffffffffffffffffffffffffffffff16816fffffffffffffffffffffffffffffffff169150806fffffffffffffffffffffffffffffffff169050915091509091565b6122816146ad565b612289613f0d565b63ffffffff16600d60000160189054906101000a900463ffffffff1663ffffffff16141561236757600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff168152505090506125a2565b61241e600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff1681525050611dad565b600d60008201518160000160006101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff160217905550602082015181600001600c6101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff16021790555060408201518160000160186101000a81548163ffffffff021916908363ffffffff1602179055509050507fb3ce7cef273a3bb22fa9889926a7512701b5f199b93128282495eceeedbdcd00600d6040516124e8919061574c565b60405180910390a1600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff168152505090505b90565b60008060018111156125b357fe5b8260018111156125bf57fe5b146125ee576002800160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16612615565b600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff165b9050919050565b6126246145d6565b61262c6145d6565b6126346145d6565b61263c614604565b6126468787613f1d565b90506000600181111561265557fe5b89600181111561266157fe5b141561267d5761267689826020015187611e95565b91506126ae565b60018081111561268957fe5b89600181111561269557fe5b14156126ad576126aa89826020015187611e95565b91505b5b6126c18289613f5590919063ffffffff16565b925082935050505095945050505050565b60028060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060020160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060030160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690806004016040518060200160405290816000820154815250509080600501604051806020016040529081600082015481525050908060060160405180602001604052908160008201548152505090806007016040518060200160405290816000820154815250509080600801604051806020016040529081600082015481525050908060090160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690508a565b600d8060000160009054906101000a90046bffffffffffffffffffffffff169080600001600c9054906101000a90046bffffffffffffffffffffffff16908060000160189054906101000a900463ffffffff16905083565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614612900576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016128f79061563a565b60405180910390fd5b612908614604565b612910613f77565b9050600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663a9059cbb8383602001516040518363ffffffff1660e01b81526004016129769291906154cb565b602060405180830381600087803b15801561299057600080fd5b505af11580156129a4573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506129c89190810190614aca565b505050565b6129d5614633565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614612a64576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401612a5b9061563a565b60405180910390fd5b6000600f60008681526020019081526020016000209050836001811115612a8757fe5b8160000160149054906101000a900460ff166001811115612aa457fe5b1415612b9b57612b3083826001016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505061387890919063ffffffff16565b8160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550905050612c88565b612c2183826002016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505061387890919063ffffffff16565b8160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055509050505b806040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff166001811115612d0857fe5b6001811115612d1357fe5b81526020016000820160159054906101000a900460ff166001811115612d3557fe5b6001811115612d4057fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509150509392505050565b6000612e4a614633565b600f60008481526020019081526020016000206040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff166001811115612edc57fe5b6001811115612ee757fe5b81526020016000820160159054906101000a900460ff166001811115612f0957fe5b6001811115612f1457fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509050613014614604565b61303761302483604001516132f8565b8360800151613f1d90919063ffffffff16565b9050806020015192505050919050565b600e5481565b60006002800160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b613081614633565b600f60008381526020019081526020016000206040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff16600181111561311357fe5b600181111561311e57fe5b81526020016000820160159054906101000a900460ff16600181111561314057fe5b600181111561314b57fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509050919050565b613250614620565b600260090160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b1580156132bb57600080fd5b505afa1580156132cf573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506132f39190810190614c0d565b905090565b6133006146ad565b6000600181111561330d57fe5b82600181111561331957fe5b14156133d557600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff168152505090506133e0565b6133dd6141e7565b90505b919050565b6133ed6145d6565b60405180604001604052806001151581526020016134b7600260010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166370a08231866040518263ffffffff1660e01b8152600401613462919061545d565b60206040518083038186803b15801561347a57600080fd5b505afa15801561348e573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506134b29190810190614d66565b613815565b6fffffffffffffffffffffffffffffffff168152509050919050565b60006134dd6145d6565b6134e6836133e5565b90506134f0614604565b61350a6134fb611cf1565b83613f1d90919063ffffffff16565b9050806020015192505050919050565b613522614604565b60405180604001604052806000151581526020016000815250905090565b613548614604565b600083602001516fffffffffffffffffffffffffffffffff1690508360000151156135c55760405180604001604052806001151581526020016135ba85602001516bffffffffffffffffffffffff16670de0b6b3a764000067ffffffffffffffff168561425c9092919063ffffffff16565b815250915050613619565b604051806040016040528060001515815260200161361285600001516bffffffffffffffffffffffff16670de0b6b3a764000067ffffffffffffffff168561428c9092919063ffffffff16565b8152509150505b92915050565b613627614604565b6136398361363484614308565b613641565b905092915050565b613649614604565b613651614604565b8260000151151584600001511515141561369957836000015181600001901515908115158152505061368b84602001518460200151613bf8565b81602001818152505061370d565b82602001518460200151106136dc5783600001518160000190151590811515815250506136ce84602001518460200151613bae565b81602001818152505061370c565b826000015181600001901515908115158152505061370283602001518560200151613bae565b8160200181815250505b5b8091505092915050565b61371f6145d6565b82600001511561379e57604051806040016040528060011515815260200161378261377d670de0b6b3a764000067ffffffffffffffff1686602001516bffffffffffffffffffffffff16886020015161425c9092919063ffffffff16565b613815565b6fffffffffffffffffffffffffffffffff16815250905061380f565b60405180604001604052806000151581526020016137f76137f2670de0b6b3a764000067ffffffffffffffff1686600001516bffffffffffffffffffffffff16886020015161428c9092919063ffffffff16565b613815565b6fffffffffffffffffffffffffffffffff1681525090505b92915050565b60008082905082816fffffffffffffffffffffffffffffffff161461386f576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016138669061567a565b60405180910390fd5b80915050919050565b6138806145d6565b6138886145d6565b826000015115158460000151151514156139225783600001518160000190151590811515815250506138ee6138e985602001516fffffffffffffffffffffffffffffffff1685602001516fffffffffffffffffffffffffffffffff16613bf8565b613815565b81602001906fffffffffffffffffffffffffffffffff1690816fffffffffffffffffffffffffffffffff1681525050613a5e565b82602001516fffffffffffffffffffffffffffffffff1684602001516fffffffffffffffffffffffffffffffff16106139db5783600001518160000190151590811515815250506139a76139a285602001516fffffffffffffffffffffffffffffffff1685602001516fffffffffffffffffffffffffffffffff16613bae565b613815565b81602001906fffffffffffffffffffffffffffffffff1690816fffffffffffffffffffffffffffffffff1681525050613a5d565b8260000151816000019015159081151581525050613a2d613a2884602001516fffffffffffffffffffffffffffffffff1686602001516fffffffffffffffffffffffffffffffff16613bae565b613815565b81602001906fffffffffffffffffffffffffffffffff1690816fffffffffffffffffffffffffffffffff16815250505b5b8091505092915050565b613a70614620565b6040518060200160405280670de0b6b3a7640000815250905090565b613a94614620565b6040518060200160405280613ab6848660000151613bf890919063ffffffff16565b815250905092915050565b613ac9614620565b6040518060200160405280613aeb848660000151613bae90919063ffffffff16565b815250905092915050565b613afe614620565b6040518060200160405280613b2485600001518560000151670de0b6b3a764000061425c565b815250905092915050565b600081602001516fffffffffffffffffffffffffffffffff1683602001516fffffffffffffffffffffffffffffffff161415613ba357600083602001516fffffffffffffffffffffffffffffffff161415613b8d5760019050613ba8565b8160000151151583600001511515149050613ba8565b600090505b92915050565b6000613bf083836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f770000815250614337565b905092915050565b600080828401905083811015613c43576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401613c3a9061565a565b60405180910390fd5b8091505092915050565b613c55614604565b613c5d614604565b613c656145d6565b604051806040016040528060011515815260200186602001516fffffffffffffffffffffffffffffffff168152509050613c9d6145d6565b604051806040016040528060001515815260200187600001516fffffffffffffffffffffffffffffffff168152509050613cd5614604565b613cdf8387613540565b9050613ce9614604565b613cf38388613540565b9050818195509550505050509250929050565b6000613d1f83670de0b6b3a7640000846000015161425c565b905092915050565b6000613d40838360000151670de0b6b3a764000061425c565b905092915050565b613d506146ad565b613d58614604565b613d60614604565b613d6a8588613c4d565b915091506000613d78613f0d565b90506000613db5613da28a6040015163ffffffff168463ffffffff16613bae90919063ffffffff16565b896000015161439290919063ffffffff16565b90506000613dc285614402565b15613dd05760009050613e03565b613dda8288613d27565b9050846020015184602001511015613e0257613dff818560200151876020015161425c565b90505b5b81811115613e0d57fe5b6040518060600160405280613e73613e6e8d600001516bffffffffffffffffffffffff16613e608f600001516bffffffffffffffffffffffff1688670de0b6b3a764000067ffffffffffffffff1661425c565b613bf890919063ffffffff16565b614412565b6bffffffffffffffffffffffff168152602001613ee1613edc8d602001516bffffffffffffffffffffffff16613ece8f602001516bffffffffffffffffffffffff1687670de0b6b3a764000067ffffffffffffffff1661425c565b613bf890919063ffffffff16565b614412565b6bffffffffffffffffffffffff1681526020018463ffffffff1681525095505050505050949350505050565b6000613f1842614471565b905090565b613f25614604565b613f2e836144c8565b15613f4257613f3b61351a565b9050613f4f565b613f4c8383613540565b90505b92915050565b613f5d6145d6565b613f6f83613f6a846144ea565b613878565b905092915050565b613f7f614604565b613f87614604565b6040518060400160405280600115158152602001600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401613ff9919061545d565b60206040518083038186803b15801561401157600080fd5b505afa158015614025573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506140499190810190614d66565b8152509050614056614604565b61405e614604565b6141b6600c6040518060400160405290816000820160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681526020016000820160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff1681525050613c4d565b915091506141df826141d1838661361f90919063ffffffff16565b61361f90919063ffffffff16565b935050505090565b6141ef6146ad565b6040518060600160405280670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff16815260200161424e613f0d565b63ffffffff16815250905090565b600061428382614275858761439290919063ffffffff16565b61452b90919063ffffffff16565b90509392505050565b60008084148061429c5750600083145b156142b3576142ac60008361452b565b9050614301565b6142fe60016142f0846142e260016142d4898b61439290919063ffffffff16565b613bae90919063ffffffff16565b61452b90919063ffffffff16565b613bf890919063ffffffff16565b90505b9392505050565b614310614604565b60405180604001604052808360000151151515815260200183602001518152509050919050565b600083831115829061437f576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016143769190615618565b60405180910390fd5b5060008385039050809150509392505050565b6000808314156143a557600090506143fc565b60008284029050828482816143b657fe5b04146143f7576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016143ee906156da565b60405180910390fd5b809150505b92915050565b6000808260200151149050919050565b60008082905082816bffffffffffffffffffffffff1614614468576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161445f9061569a565b60405180910390fd5b80915050919050565b600080829050828163ffffffff16146144bf576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016144b6906156ba565b60405180910390fd5b80915050919050565b60008082602001516fffffffffffffffffffffffffffffffff16149050919050565b6144f26145d6565b60405180604001604052808360000151151515815260200183602001516fffffffffffffffffffffffffffffffff168152509050919050565b600061456d83836040518060400160405280601a81526020017f536166654d6174683a206469766973696f6e206279207a65726f000000000000815250614575565b905092915050565b600080831182906145bc576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016145b39190615618565b60405180910390fd5b5060008385816145c857fe5b049050809150509392505050565b604051806040016040528060001515815260200160006fffffffffffffffffffffffffffffffff1681525090565b6040518060400160405280600015158152602001600081525090565b6040518060200160405280600081525090565b6040518060a00160405280600073ffffffffffffffffffffffffffffffffffffffff1681526020016000600181111561466857fe5b81526020016000600181111561467a57fe5b81526020016146876146f0565b81526020016146946146f0565b81525090565b6040518060200160405280600081525090565b604051806060016040528060006bffffffffffffffffffffffff16815260200160006bffffffffffffffffffffffff168152602001600063ffffffff1681525090565b604051806040016040528060001515815260200160006fffffffffffffffffffffffffffffffff1681525090565b60008135905061472d81615c67565b92915050565b60008135905061474281615c7e565b92915050565b60008151905061475781615c7e565b92915050565b60008135905061476c81615c95565b92915050565b60008135905061478181615ca5565b92915050565b60008135905061479681615cb5565b92915050565b6000608082840312156147ae57600080fd5b6147b86080615885565b905060006147c884828501614733565b60008301525060206147dc8482850161475d565b60208301525060406147f084828501614772565b604083015250606061480484828501614a4d565b60608301525092915050565b60006020828403121561482257600080fd5b61482c6020615885565b9050600061483c84828501614a4d565b60008301525092915050565b60006020828403121561485a57600080fd5b6148646020615885565b9050600061487484828501614a62565b60008301525092915050565b60006060828403121561489257600080fd5b61489c6060615885565b905060006148ac84828501614a8c565b60008301525060206148c084828501614a8c565b60208301525060406148d484828501614a77565b60408301525092915050565b6000604082840312156148f257600080fd5b6148fc6040615885565b9050600061490c84828501614733565b600083015250602061492084828501614a38565b60208301525092915050565b60006040828403121561493e57600080fd5b6149486040615885565b9050600061495884828501614733565b600083015250602061496c84828501614a38565b60208301525092915050565b600060e0828403121561498a57600080fd5b61499460a0615885565b905060006149a48482850161471e565b60008301525060206149b884828501614787565b60208301525060406149cc84828501614787565b60408301525060606149e0848285016148e0565b60608301525060a06149f4848285016148e0565b60808301525092915050565b600060208284031215614a1257600080fd5b614a1c6020615885565b90506000614a2c84828501614a62565b60008301525092915050565b600081359050614a4781615cc5565b92915050565b600081359050614a5c81615cdc565b92915050565b600081519050614a7181615cdc565b92915050565b600081359050614a8681615cf3565b92915050565b600081359050614a9b81615d0a565b92915050565b600060208284031215614ab357600080fd5b6000614ac18482850161471e565b91505092915050565b600060208284031215614adc57600080fd5b6000614aea84828501614748565b91505092915050565b600060208284031215614b0557600080fd5b6000614b1384828501614787565b91505092915050565b60008060008060006101208688031215614b3557600080fd5b6000614b4388828901614787565b9550506020614b548882890161492c565b9450506060614b658882890161492c565b93505060a0614b7688828901614880565b925050610100614b8888828901614810565b9150509295509295909350565b600080600060608486031215614baa57600080fd5b6000614bb886828701614787565b9350506020614bc986828701614a4d565b9250506040614bda86828701614810565b9150509250925092565b600060208284031215614bf657600080fd5b6000614c0484828501614810565b91505092915050565b600060208284031215614c1f57600080fd5b6000614c2d84828501614848565b91505092915050565b600060608284031215614c4857600080fd5b6000614c5684828501614880565b91505092915050565b60008060006101208486031215614c7557600080fd5b6000614c838682870161492c565b9350506040614c9486828701614880565b92505060a0614ca58682870161479c565b9150509250925092565b60008060808385031215614cc257600080fd5b6000614cd08582860161492c565b9250506040614ce18582860161492c565b9150509250929050565b600060e08284031215614cfd57600080fd5b6000614d0b84828501614978565b91505092915050565b600060208284031215614d2657600080fd5b6000614d3484828501614a00565b91505092915050565b600060208284031215614d4f57600080fd5b6000614d5d84828501614a4d565b91505092915050565b600060208284031215614d7857600080fd5b6000614d8684828501614a62565b91505092915050565b600080600060808486031215614da457600080fd5b6000614db286828701614a4d565b9350506020614dc386828701614787565b9250506040614dd48682870161492c565b9150509250925092565b614de7816159a0565b82525050565b614df6816159a0565b82525050565b614e05816159b2565b82525050565b614e14816159b2565b82525050565b614e2381615a3f565b82525050565b614e3281615a3f565b82525050565b614e4181615a63565b82525050565b614e5081615a63565b82525050565b614e5f81615a87565b82525050565b614e6e81615a87565b82525050565b614e7d81615aab565b82525050565b614e8c81615aab565b82525050565b614e9b81615acf565b82525050565b614eaa81615acf565b82525050565b614eb981615af3565b82525050565b614ec881615af3565b82525050565b6000614ed9826158b2565b614ee381856158bd565b9350614ef3818560208601615b05565b614efc81615c22565b840191505092915050565b6000614f146019836158bd565b91507f53746174653a206f6e6c7920636f72652063616e2063616c6c000000000000006000830152602082019050919050565b6000614f54601b836158bd565b91507f536166654d6174683a206164646974696f6e206f766572666c6f7700000000006000830152602082019050919050565b6000614f94601c836158bd565b91507f4d6174683a20556e73616665206361737420746f2075696e74313238000000006000830152602082019050919050565b6000614fd4601b836158bd565b91507f4d6174683a20556e73616665206361737420746f2075696e74393600000000006000830152602082019050919050565b6000615014601b836158bd565b91507f4d6174683a20556e73616665206361737420746f2075696e74333200000000006000830152602082019050919050565b60006150546021836158bd565b91507f536166654d6174683a206d756c7469706c69636174696f6e206f766572666c6f60008301527f77000000000000000000000000000000000000000000000000000000000000006020830152604082019050919050565b6020820160008201516150c36000850182615403565b50505050565b6020820160008201516150df6000850182615403565b50505050565b6020820160008083015490506150fa81615bba565b6151076000860182615403565b5050505050565b6101408201600080830154905061512481615b38565b6151316000860182614e1a565b506001830154905061514281615b6c565b61514f6020860182614e56565b506002830154905061516081615ba0565b61516d6040860182614e92565b506003830154905061517e81615b52565b61518b6060860182614e38565b506004830161519d60808601826150e5565b50600583016151af60a08601826150e5565b50600683016151c160c08601826150e5565b50600783016151d360e08601826150e5565b50600883016151e66101008601826150e5565b50600983015490506151f781615b86565b615205610120860182614e74565b5050505050565b606082016000820151615222600085018261543f565b506020820151615235602085018261543f565b5060408201516152486040850182615421565b50505050565b60608201600080830154905061526381615bd4565b615270600086018261543f565b5061527a81615bee565b615287602086018261543f565b5061529181615c08565b61529e6040860182615421565b5050505050565b6040820160008201516152bb6000850182614dfc565b5060208201516152ce60208501826153e5565b50505050565b6040820160008201516152ea6000850182614dfc565b5060208201516152fd60208501826153e5565b50505050565b6040820160008201516153196000850182614dfc565b50602082015161532c60208501826153e5565b50505050565b60e0820160008201516153486000850182614dde565b50602082015161535b6020850182614eb0565b50604082015161536e6040850182614eb0565b50606082015161538160608501826152d4565b50608082015161539460a08501826152d4565b50505050565b6020820160008201516153b06000850182615403565b50505050565b6040820160008201516153cc6000850182614dfc565b5060208201516153df6020850182615403565b50505050565b6153ee816159d1565b82525050565b6153fd816159d1565b82525050565b61540c81615a0d565b82525050565b61541b81615a0d565b82525050565b61542a81615a17565b82525050565b61543981615a17565b82525050565b61544881615a27565b82525050565b61545781615a27565b82525050565b60006020820190506154726000830184614ded565b92915050565b600060e08201905061548d6000830188614ded565b61549a6020830187614ebf565b6154a76040830186614ebf565b6154b46060830185615303565b6154c160a0830184615303565b9695505050505050565b60006040820190506154e06000830185614ded565b6154ed6020830184615412565b9392505050565b60006060820190506155096000830186614ded565b6155166020830185615412565b6155236040830184615412565b949350505050565b60006020820190506155406000830184614e0b565b92915050565b600060208201905061555b6000830184614e29565b92915050565b600061014082019050615577600083018d614e29565b615584602083018c614e65565b615591604083018b614ea1565b61559e606083018a614e47565b6155ab60808301896150c9565b6155b860a08301886150c9565b6155c560c08301876150c9565b6155d260e08301866150c9565b6155e06101008301856150c9565b6155ee610120830184614e83565b9b9a5050505050505050505050565b60006020820190506156126000830184614e65565b92915050565b600060208201905081810360008301526156328184614ece565b905092915050565b6000602082019050818103600083015261565381614f07565b9050919050565b6000602082019050818103600083015261567381614f47565b9050919050565b6000602082019050818103600083015261569381614f87565b9050919050565b600060208201905081810360008301526156b381614fc7565b9050919050565b600060208201905081810360008301526156d381615007565b9050919050565b600060208201905081810360008301526156f381615047565b9050919050565b600060208201905061570f60008301846150ad565b92915050565b60006101408201905061572b600083018461510e565b92915050565b6000606082019050615746600083018461520c565b92915050565b6000606082019050615761600083018461524e565b92915050565b600060408201905061577c60008301846152a5565b92915050565b600060808201905061579760008301856152a5565b6157a460408301846153b6565b9392505050565b600060e0820190506157c06000830184615332565b92915050565b60006020820190506157db600083018461539a565b92915050565b60006040820190506157f660008301856153f4565b61580360208301846153f4565b9392505050565b600060208201905061581f6000830184615412565b92915050565b600060408201905061583a6000830185615412565b6158476020830184615412565b9392505050565b6000606082019050615863600083018661544e565b615870602083018561544e565b61587d6040830184615430565b949350505050565b6000604051905081810181811067ffffffffffffffff821117156158a857600080fd5b8060405250919050565b600081519050919050565b600082825260208201905092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b600063ffffffff82169050919050565b60006bffffffffffffffffffffffff82169050919050565b60006159ab826159ed565b9050919050565b60008115159050919050565b60008190506159cc82615c5a565b919050565b60006fffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b600063ffffffff82169050919050565b60006bffffffffffffffffffffffff82169050919050565b6000615a4a82615a51565b9050919050565b6000615a5c826159ed565b9050919050565b6000615a6e82615a75565b9050919050565b6000615a80826159ed565b9050919050565b6000615a9282615a99565b9050919050565b6000615aa4826159ed565b9050919050565b6000615ab682615abd565b9050919050565b6000615ac8826159ed565b9050919050565b6000615ada82615ae1565b9050919050565b6000615aec826159ed565b9050919050565b6000615afe826159be565b9050919050565b60005b83811015615b23578082015181840152602081019050615b08565b83811115615b32576000848401525b50505050565b6000615b4b615b4683615c33565b6158ce565b9050919050565b6000615b65615b6083615c33565b6158ee565b9050919050565b6000615b7f615b7a83615c33565b61590e565b9050919050565b6000615b99615b9483615c33565b61592e565b9050919050565b6000615bb3615bae83615c33565b61594e565b9050919050565b6000615bcd615bc883615c33565b61596e565b9050919050565b6000615be7615be283615c33565b615988565b9050919050565b6000615c01615bfc83615c4d565b615988565b9050919050565b6000615c1b615c1683615c40565b615978565b9050919050565b6000601f19601f8301169050919050565b60008160001c9050919050565b60008160c01c9050919050565b60008160601c9050919050565b60028110615c6457fe5b50565b615c70816159a0565b8114615c7b57600080fd5b50565b615c87816159b2565b8114615c9257600080fd5b50565b60028110615ca257600080fd5b50565b60028110615cb257600080fd5b50565b60028110615cc257600080fd5b50565b615cce816159d1565b8114615cd957600080fd5b50565b615ce581615a0d565b8114615cf057600080fd5b50565b615cfc81615a17565b8114615d0757600080fd5b50565b615d1381615a27565b8114615d1e57600080fd5b5056fea365627a7a72315820f4c9fe807d13917f09958d8de6b50f2c50e1884048c0c5e1783187ccd34ef19f6c6578706572696d656e74616cf564736f6c63430005100040";
}
