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
    GlobalParamsUpdated: TypedEventDescription<{
      encodeTopics([updatedParams]: [null]): string[];
    }>;

    LogIndexUpdated: TypedEventDescription<{
      encodeTopics([updatedIndex]: [null]): string[];
    }>;

    TotalParUpdated: TypedEventDescription<{
      encodeTopics([updatedPar]: [null]): string[];
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

  GlobalParamsUpdated(updatedParams: null): EventFilter;
  LogIndexUpdated(updatedIndex: null): EventFilter;
  TotalParUpdated(updatedPar: null): EventFilter;

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
    '[{"inputs":[{"internalType":"address","name":"_core","type":"address"},{"internalType":"address","name":"_admin","type":"address"},{"components":[{"internalType":"contract IERC20","name":"stableAsset","type":"address"},{"internalType":"contract IMintableToken","name":"lendAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"internalType":"contract IInterestSetter","name":"interestSetter","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"earningsRate","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"internalType":"struct Types.GlobalParams","name":"_globalParams","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"components":[{"internalType":"contract IERC20","name":"stableAsset","type":"address"},{"internalType":"contract IMintableToken","name":"lendAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"internalType":"contract IInterestSetter","name":"interestSetter","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"earningsRate","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"indexed":false,"internalType":"struct Types.GlobalParams","name":"updatedParams","type":"tuple"}],"name":"GlobalParamsUpdated","type":"event"},{"anonymous":false,"inputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"indexed":false,"internalType":"struct Interest.Index","name":"updatedIndex","type":"tuple"}],"name":"LogIndexUpdated","type":"event"},{"anonymous":false,"inputs":[{"components":[{"internalType":"uint128","name":"borrow","type":"uint128"},{"internalType":"uint128","name":"supply","type":"uint128"}],"indexed":false,"internalType":"struct Types.TotalPar","name":"updatedPar","type":"tuple"}],"name":"TotalParUpdated","type":"event"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"parSupply","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"parBorrow","type":"tuple"},{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"borrowIndex","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateCollateralDelta","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateInverseAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateInverseRequired","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"calculateLiquidationPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"index","type":"tuple"}],"name":"fetchInterestRate","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Interest.Rate","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"index","type":"tuple"}],"name":"fetchNewIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"getAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"getBorrowIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"positionId","type":"uint256"}],"name":"getBorrowWei","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getCurrentPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getLendAsset","outputs":[{"internalType":"contract IMintableToken","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"currentPar","type":"tuple"},{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"index","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"enum Types.AssetDenomination","name":"denomination","type":"uint8"},{"internalType":"enum Types.AssetReference","name":"ref","type":"uint8"},{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Types.AssetAmount","name":"amount","type":"tuple"}],"name":"getNewParAndDeltaWei","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Types.Wei","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getPosition","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getStableAsset","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"getSupplyBalance","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"supplier","type":"address"}],"name":"getSupplyWei","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getSyntheticAsset","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getTotalPar","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"globalIndex","outputs":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"position","type":"tuple"}],"name":"isCollateralized","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"params","outputs":[{"internalType":"contract IERC20","name":"stableAsset","type":"address"},{"internalType":"contract IMintableToken","name":"lendAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"internalType":"contract IInterestSetter","name":"interestSetter","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"earningsRate","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"positionCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"positions","outputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"removeExcessTokens","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"position","type":"tuple"}],"name":"savePosition","outputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"amount","type":"tuple"}],"name":"setAmount","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"ratio","type":"tuple"}],"name":"setCollateralRatio","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"rate","type":"tuple"}],"name":"setEarningsRate","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_setter","type":"address"}],"name":"setInterestSetter","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"spread","type":"tuple"}],"name":"setLiquidationSpread","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_oracle","type":"address"}],"name":"setOracle","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"fee","type":"tuple"}],"name":"setOriginationFee","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"ratio","type":"tuple"}],"name":"setSyntheticRatio","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalPar","outputs":[{"internalType":"uint128","name":"borrow","type":"uint128"},{"internalType":"uint128","name":"supply","type":"uint128"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"updateIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"amount","type":"tuple"}],"name":"updatePositionAmount","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"existingPar","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"newPar","type":"tuple"}],"name":"updateTotalPar","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
  public static Bytecode =
    "0x60806040523480156200001157600080fd5b506040516200671f3803806200671f833981810160405262000037919081019062000669565b826000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555081600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555080600260008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160010160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060408201518160020160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060608201518160030160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060808201518160040160008201518160000155505060a08201518160050160008201518160000155505060c08201518160060160008201518160000155505060e082015181600701600082015181600001555050610100820151816008016000820151816000015550506101208201518160090160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550905050620002a16200034460201b6200421f1760201c565b600d60008201518160000160006101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff160217905550602082015181600001600c6101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff16021790555060408201518160000160186101000a81548163ffffffff021916908363ffffffff160217905550905050505050620008bb565b6200034e6200043f565b6040518060600160405280670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001620003ba620003c860201b62003f451760201c565b63ffffffff16815250905090565b6000620003e042620003e560201b620044a91760201c565b905090565b600080829050828163ffffffff161462000436576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016200042d9062000702565b60405180910390fd5b80915050919050565b604051806060016040528060006bffffffffffffffffffffffff16815260200160006bffffffffffffffffffffffff168152602001600063ffffffff1681525090565b600081519050620004938162000805565b92915050565b600081519050620004aa816200081f565b92915050565b600081519050620004c18162000839565b92915050565b600081519050620004d88162000853565b92915050565b600081519050620004ef816200086d565b92915050565b600081519050620005068162000887565b92915050565b6000602082840312156200051f57600080fd5b6200052b602062000724565b905060006200053d8482850162000652565b60008301525092915050565b600061014082840312156200055d57600080fd5b6200056a61014062000724565b905060006200057c8482850162000499565b60008301525060206200059284828501620004c7565b6020830152506040620005a884828501620004f5565b6040830152506060620005be84828501620004b0565b6060830152506080620005d4848285016200050c565b60808301525060a0620005ea848285016200050c565b60a08301525060c062000600848285016200050c565b60c08301525060e062000616848285016200050c565b60e0830152506101006200062d848285016200050c565b610100830152506101206200064584828501620004de565b6101208301525092915050565b6000815190506200066381620008a1565b92915050565b600080600061018084860312156200068057600080fd5b6000620006908682870162000482565b9350506020620006a38682870162000482565b9250506040620006b68682870162000549565b9150509250925092565b6000620006cf601b8362000752565b91507f4d6174683a20556e73616665206361737420746f2075696e74333200000000006000830152602082019050919050565b600060208201905081810360008301526200071d81620006c0565b9050919050565b6000604051905081810181811067ffffffffffffffff821117156200074857600080fd5b8060405250919050565b600082825260208201905092915050565b60006200077082620007db565b9050919050565b6000620007848262000763565b9050919050565b6000620007988262000763565b9050919050565b6000620007ac8262000763565b9050919050565b6000620007c08262000763565b9050919050565b6000620007d48262000763565b9050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b620008108162000763565b81146200081c57600080fd5b50565b6200082a8162000777565b81146200083657600080fd5b50565b62000844816200078b565b81146200085057600080fd5b50565b6200085e816200079f565b81146200086a57600080fd5b50565b6200087881620007b3565b81146200088457600080fd5b50565b6200089281620007c7565b81146200089e57600080fd5b50565b620008ac81620007fb565b8114620008b857600080fd5b50565b615e5480620008cb6000396000f3fe608060405234801561001057600080fd5b50600436106102325760003560e01c80639997640d11610130578063e043095a116100b8578063eb02c3011161007c578063eb02c30114610711578063eb91d37e14610741578063ef9d39261461075f578063f38e266a1461078f578063f9bd3235146107bf57610232565b8063e043095a14610659578063e2e02e0c14610675578063e2f6720e146106a5578063e7702d05146106d5578063e7a45f2e146106f357610232565b8063b9f412b0116100ff578063b9f412b014610594578063bcaa0c55146105b2578063bf0b4927146105e2578063cff0ab9614610612578063d890a8701461063957610232565b80639997640d1461050757806399fbab8814610523578063b17e32f914610557578063b44c061f1461057557610232565b8063599b81e7116101be5780637adbf973116101825780637adbf9731461043d5780637c7c200a1461045957806381045ead146104895780638a627d0d146104a757806396d7d7e1146104d757610232565b8063599b81e714610398578063651fafe1146103c85780636e830f4a146103e4578063740e67ef14610400578063743bd7c91461041e57610232565b80632626ab08116102055780632626ab08146102e45780632863612b1461030057806340052049146103305780634c2fbfc61461036057806356cffd131461037c57610232565b80630625dce1146102375780630e884c12146102535780631896174e146102845780631e31274a146102b4575b600080fd5b610251600480360361024c9190810190614c1c565b6107ef565b005b61026d60048036036102689190810190614c97565b6108cd565b60405161027b9291906157fa565b60405180910390f35b61029e60048036036102999190810190614d23565b610a8a565b6040516102ab919061589d565b60405180910390f35b6102ce60048036036102c99190810190614d23565b610cbd565b6040516102db91906155a3565b60405180910390f35b6102fe60048036036102f99190810190614c1c565b610dd5565b005b61031a60048036036103159190810190614b2b565b610eb3565b6040516103279190615772565b60405180910390f35b61034a60048036036103459190810190614dc7565b611000565b6040516103579190615823565b60405180910390f35b61037a60048036036103759190810190614c1c565b611369565b005b61039660048036036103919190810190614ce7565b611447565b005b6103b260048036036103ad9190810190614c6e565b6117c3565b6040516103bf919061583e565b60405180910390f35b6103e260048036036103dd9190810190614c1c565b61197d565b005b6103fe60048036036103f99190810190614c1c565b611a5b565b005b610408611b39565b60405161041591906155be565b60405180910390f35b610426611b66565b604051610434929190615874565b60405180910390f35b61045760048036036104529190810190614ad9565b611bb0565b005b610473600480360361046e9190810190614bcd565b611cbf565b604051610480919061589d565b60405180910390f35b610491611d29565b60405161049e91906157a9565b60405180910390f35b6104c160048036036104bc9190810190614c6e565b611de5565b6040516104ce91906157a9565b60405180910390f35b6104f160048036036104ec9190810190614bcd565b611ecd565b6040516104fe91906157df565b60405180910390f35b610521600480360361051c9190810190614ad9565b611fae565b005b61053d60048036036105389190810190614d75565b6120bd565b60405161054e9594939291906154f0565b60405180910390f35b61055f61220b565b60405161056c9190615675565b60405180910390f35b61057d612238565b60405161058b9291906158b8565b60405180910390f35b61059c6122b1565b6040516105a991906157a9565b60405180910390f35b6105cc60048036036105c79190810190614b2b565b6125dd565b6040516105d991906154d5565b60405180910390f35b6105fc60048036036105f79190810190614b54565b612654565b60405161060991906157df565b60405180910390f35b61061a61270a565b6040516106309a999897969594939291906155d9565b60405180910390f35b610641612850565b604051610650939291906158e1565b60405180910390f35b610673600480360361066e9190810190614ad9565b6128a8565b005b61068f600480360361068a9190810190614dc7565b612a05565b60405161069c9190615823565b60405180910390f35b6106bf60048036036106ba9190810190614d75565b612e78565b6040516106cc919061589d565b60405180910390f35b6106dd61307f565b6040516106ea919061589d565b60405180910390f35b6106fb613085565b60405161070891906155be565b60405180910390f35b61072b60048036036107269190810190614d75565b6130b1565b6040516107389190615823565b60405180910390f35b610749613280565b6040516107569190615772565b60405180910390f35b61077960048036036107749190810190614b2b565b613330565b60405161078691906157a9565b60405180910390f35b6107a960048036036107a49190810190614ad9565b61341d565b6040516107b691906157df565b60405180910390f35b6107d960048036036107d49190810190614ad9565b61350b565b6040516107e6919061589d565b60405180910390f35b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461087f576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610876906156b2565b60405180910390fd5b806002600801600082015181600001559050507f7c85c90b8ff61ba78a1692eb94f4fdbcdb33027886e8fc1fef34f01dd1af879360026040516108c2919061578d565b60405180910390a150565b6108d561460e565b6108dd61463c565b6000836060015114801561090b5750600060018111156108f957fe5b8360400151600181111561090957fe5b145b156109225784610919613552565b91509150610a82565b61092a61463c565b6109348686613578565b905061093e61460e565b61094661463c565b6000600181111561095357fe5b8660200151600181111561096357fe5b14156109e55760405180604001604052808760000151151581526020018760600151815250905060018081111561099657fe5b866040015160018111156109a657fe5b14156109c2576109bf838261365790919063ffffffff16565b90505b6109de6109d8828561367990919063ffffffff16565b8861374f565b9150610a78565b6040518060400160405280876000015115158152602001610a09886060015161384d565b6fffffffffffffffffffffffffffffffff16815250915060006001811115610a2d57fe5b86604001516001811115610a3d57fe5b1415610a5957610a5682896138b090919063ffffffff16565b91505b610a7583610a67848a613578565b61365790919063ffffffff16565b90505b8181945094505050505b935093915050565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610b1b576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610b12906156b2565b60405180910390fd5b600e54905081600f6000600e54815260200190815260200160002060008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160000160146101000a81548160ff02191690836001811115610ba157fe5b021790555060408201518160000160156101000a81548160ff02191690836001811115610bca57fe5b021790555060608201518160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550505060808201518160020160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055505050905050600e60008154809291906001019190505550919050565b6000808260800151602001516fffffffffffffffffffffffffffffffff161415610cea5760019050610dd0565b610cf2614658565b600260090160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b158015610d5d57600080fd5b505afa158015610d71573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250610d959190810190614c45565b9050610d9f61460e565b610dc4846040015185606001518660800151610dbe8860400151613330565b86612654565b90508060000151925050505b919050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610e65576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610e5c906156b2565b60405180910390fd5b806002600401600082015181600001559050507f7c85c90b8ff61ba78a1692eb94f4fdbcdb33027886e8fc1fef34f01dd1af87936002604051610ea8919061578d565b60405180910390a150565b610ebb614658565b610ec3614658565b610ecb614658565b600260090160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b158015610f3657600080fd5b505afa158015610f4a573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250610f6e9190810190614c45565b905060006001811115610f7d57fe5b846001811115610f8957fe5b1415610faf57610fa8610f9a613aa0565b600260060160000154613ac4565b9150610fea565b600180811115610fbb57fe5b846001811115610fc757fe5b1415610fe957610fe6610fd8613aa0565b600260060160000154613af9565b91505b5b610ff48183613b2e565b91508192505050919050565b61100861466b565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611097576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161108e906156b2565b60405180910390fd5b6000600f600086815260200190815260200160002090508360018111156110ba57fe5b8160000160149054906101000a900460ff1660018111156110d757fe5b141561114957828160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055509050506111b1565b828160020160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055509050505b806040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff16600181111561123157fe5b600181111561123c57fe5b81526020016000820160159054906101000a900460ff16600181111561125e57fe5b600181111561126957fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509150509392505050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146113f9576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016113f0906156b2565b60405180910390fd5b806002600701600082015181600001559050507f7c85c90b8ff61ba78a1692eb94f4fdbcdb33027886e8fc1fef34f01dd1af8793600260405161143c919061578d565b60405180910390a150565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146114d6576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016114cd906156b2565b60405180910390fd5b6114e08282613b67565b156114ea576117bf565b8160000151156115985761155861155383602001516fffffffffffffffffffffffffffffffff16600c60000160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16613be690919063ffffffff16565b61384d565b600c60000160106101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550611638565b6115fc6115f783602001516fffffffffffffffffffffffffffffffff16600c60000160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16613be690919063ffffffff16565b61384d565b600c60000160006101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055505b8060000151156116e6576116a66116a182602001516fffffffffffffffffffffffffffffffff16600c60000160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16613c3090919063ffffffff16565b61384d565b600c60000160106101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550611786565b61174a61174582602001516fffffffffffffffffffffffffffffffff16600c60000160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16613c3090919063ffffffff16565b61384d565b600c60000160006101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055505b7f75b2b7d760ad7a77bffaa32661004adc0c76b099794ebc52392078f0e41fbf6b600c6040516117b69190615859565b60405180910390a15b5050565b6117cb6146d2565b6117d361463c565b6117db61463c565b611885600c6040518060400160405290816000820160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681526020016000820160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505085613c85565b915091506118916146d2565b600260030160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663e8177dcf600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16846020015186602001516040518463ffffffff1660e01b81526004016119209392919061556c565b60206040518083038186803b15801561193857600080fd5b505afa15801561194c573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506119709190810190614d4c565b9050809350505050919050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611a0d576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611a04906156b2565b60405180910390fd5b806002600601600082015181600001559050507f7c85c90b8ff61ba78a1692eb94f4fdbcdb33027886e8fc1fef34f01dd1af87936002604051611a50919061578d565b60405180910390a150565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611aeb576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611ae2906156b2565b60405180910390fd5b806002600501600082015181600001559050507f7c85c90b8ff61ba78a1692eb94f4fdbcdb33027886e8fc1fef34f01dd1af87936002604051611b2e919061578d565b60405180910390a150565b6000600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b600c8060000160009054906101000a90046fffffffffffffffffffffffffffffffff16908060000160109054906101000a90046fffffffffffffffffffffffffffffffff16905082565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611c40576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611c37906156b2565b60405180910390fd5b80600260090160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507f7c85c90b8ff61ba78a1692eb94f4fdbcdb33027886e8fc1fef34f01dd1af87936002604051611cb4919061578d565b60405180910390a150565b60008060006001811115611ccf57fe5b856001811115611cdb57fe5b1415611cf257611ceb8484613d3e565b9050611d1e565b600180811115611cfe57fe5b856001811115611d0a57fe5b1415611d1d57611d1a8484613d5f565b90505b5b809150509392505050565b611d316146e5565b600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff1681525050905090565b611ded6146e5565b611df56146d2565b611dfe836117c3565b9050611ec58382600c6040518060400160405290816000820160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681526020016000820160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250506002600801604051806020016040529081600082015481525050613d80565b915050919050565b611ed561460e565b6000611ee2858585611cbf565b905060006001811115611ef157fe5b856001811115611efd57fe5b1415611f2d57611f26816002600501604051806020016040529081600082015481525050613d5f565b9050611f72565b600180811115611f3957fe5b856001811115611f4557fe5b1415611f7157611f6e816002600401604051806020016040529081600082015481525050613d5f565b90505b5b6040518060400160405280600115158152602001611f8f8361384d565b6fffffffffffffffffffffffffffffffff168152509150509392505050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461203e576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401612035906156b2565b60405180910390fd5b80600260030160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507f7c85c90b8ff61ba78a1692eb94f4fdbcdb33027886e8fc1fef34f01dd1af879360026040516120b2919061578d565b60405180910390a150565b600f6020528060005260406000206000915090508060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060000160149054906101000a900460ff16908060000160159054906101000a900460ff1690806001016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505090806002016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050905085565b6000600260010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b600080600c60000160109054906101000a90046fffffffffffffffffffffffffffffffff16600c60000160009054906101000a90046fffffffffffffffffffffffffffffffff16816fffffffffffffffffffffffffffffffff169150806fffffffffffffffffffffffffffffffff169050915091509091565b6122b96146e5565b6122c1613f45565b63ffffffff16600d60000160189054906101000a900463ffffffff1663ffffffff16141561239f57600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff168152505090506125da565b612456600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff1681525050611de5565b600d60008201518160000160006101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff160217905550602082015181600001600c6101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff16021790555060408201518160000160186101000a81548163ffffffff021916908363ffffffff1602179055509050507ff00967a8d0b79ea69bdcdcabbfeb9c638db50c18f641a9685a09db0998ade11f600d60405161252091906157c4565b60405180910390a1600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff168152505090505b90565b60008060018111156125eb57fe5b8260018111156125f757fe5b14612626576002800160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1661264d565b600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff165b9050919050565b61265c61460e565b61266461460e565b61266c61460e565b61267461463c565b61267e8787613f55565b90506000600181111561268d57fe5b89600181111561269957fe5b14156126b5576126ae89826020015187611ecd565b91506126e6565b6001808111156126c157fe5b8960018111156126cd57fe5b14156126e5576126e289826020015187611ecd565b91505b5b6126f98289613f8d90919063ffffffff16565b925082935050505095945050505050565b60028060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060020160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060030160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690806004016040518060200160405290816000820154815250509080600501604051806020016040529081600082015481525050908060060160405180602001604052908160008201548152505090806007016040518060200160405290816000820154815250509080600801604051806020016040529081600082015481525050908060090160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690508a565b600d8060000160009054906101000a90046bffffffffffffffffffffffff169080600001600c9054906101000a90046bffffffffffffffffffffffff16908060000160189054906101000a900463ffffffff16905083565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614612938576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161292f906156b2565b60405180910390fd5b61294061463c565b612948613faf565b9050600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663a9059cbb8383602001516040518363ffffffff1660e01b81526004016129ae929190615543565b602060405180830381600087803b1580156129c857600080fd5b505af11580156129dc573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250612a009190810190614b02565b505050565b612a0d61466b565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614612a9c576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401612a93906156b2565b60405180910390fd5b6000600f60008681526020019081526020016000209050836001811115612abf57fe5b8160000160149054906101000a900460ff166001811115612adc57fe5b1415612bd357612b6883826001016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250506138b090919063ffffffff16565b8160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550905050612cc0565b612c5983826002016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250506138b090919063ffffffff16565b8160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055509050505b806040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff166001811115612d4057fe5b6001811115612d4b57fe5b81526020016000820160159054906101000a900460ff166001811115612d6d57fe5b6001811115612d7857fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509150509392505050565b6000612e8261466b565b600f60008481526020019081526020016000206040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff166001811115612f1457fe5b6001811115612f1f57fe5b81526020016000820160159054906101000a900460ff166001811115612f4157fe5b6001811115612f4c57fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505081525050905061304c61463c565b61306f61305c8360400151613330565b8360800151613f5590919063ffffffff16565b9050806020015192505050919050565b600e5481565b60006002800160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b6130b961466b565b600f60008381526020019081526020016000206040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff16600181111561314b57fe5b600181111561315657fe5b81526020016000820160159054906101000a900460ff16600181111561317857fe5b600181111561318357fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509050919050565b613288614658565b600260090160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b1580156132f357600080fd5b505afa158015613307573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525061332b9190810190614c45565b905090565b6133386146e5565b6000600181111561334557fe5b82600181111561335157fe5b141561340d57600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff16815250509050613418565b61341561421f565b90505b919050565b61342561460e565b60405180604001604052806001151581526020016134ef600260010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166370a08231866040518263ffffffff1660e01b815260040161349a91906154d5565b60206040518083038186803b1580156134b257600080fd5b505afa1580156134c6573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506134ea9190810190614d9e565b61384d565b6fffffffffffffffffffffffffffffffff168152509050919050565b600061351561460e565b61351e8361341d565b905061352861463c565b613542613533611d29565b83613f5590919063ffffffff16565b9050806020015192505050919050565b61355a61463c565b60405180604001604052806000151581526020016000815250905090565b61358061463c565b600083602001516fffffffffffffffffffffffffffffffff1690508360000151156135fd5760405180604001604052806001151581526020016135f285602001516bffffffffffffffffffffffff16670de0b6b3a764000067ffffffffffffffff16856142949092919063ffffffff16565b815250915050613651565b604051806040016040528060001515815260200161364a85600001516bffffffffffffffffffffffff16670de0b6b3a764000067ffffffffffffffff16856142c49092919063ffffffff16565b8152509150505b92915050565b61365f61463c565b6136718361366c84614340565b613679565b905092915050565b61368161463c565b61368961463c565b826000015115158460000151151514156136d15783600001518160000190151590811515815250506136c384602001518460200151613c30565b816020018181525050613745565b826020015184602001511061371457836000015181600001901515908115158152505061370684602001518460200151613be6565b816020018181525050613744565b826000015181600001901515908115158152505061373a83602001518560200151613be6565b8160200181815250505b5b8091505092915050565b61375761460e565b8260000151156137d65760405180604001604052806001151581526020016137ba6137b5670de0b6b3a764000067ffffffffffffffff1686602001516bffffffffffffffffffffffff1688602001516142949092919063ffffffff16565b61384d565b6fffffffffffffffffffffffffffffffff168152509050613847565b604051806040016040528060001515815260200161382f61382a670de0b6b3a764000067ffffffffffffffff1686600001516bffffffffffffffffffffffff1688602001516142c49092919063ffffffff16565b61384d565b6fffffffffffffffffffffffffffffffff1681525090505b92915050565b60008082905082816fffffffffffffffffffffffffffffffff16146138a7576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161389e906156f2565b60405180910390fd5b80915050919050565b6138b861460e565b6138c061460e565b8260000151151584600001511515141561395a57836000015181600001901515908115158152505061392661392185602001516fffffffffffffffffffffffffffffffff1685602001516fffffffffffffffffffffffffffffffff16613c30565b61384d565b81602001906fffffffffffffffffffffffffffffffff1690816fffffffffffffffffffffffffffffffff1681525050613a96565b82602001516fffffffffffffffffffffffffffffffff1684602001516fffffffffffffffffffffffffffffffff1610613a135783600001518160000190151590811515815250506139df6139da85602001516fffffffffffffffffffffffffffffffff1685602001516fffffffffffffffffffffffffffffffff16613be6565b61384d565b81602001906fffffffffffffffffffffffffffffffff1690816fffffffffffffffffffffffffffffffff1681525050613a95565b8260000151816000019015159081151581525050613a65613a6084602001516fffffffffffffffffffffffffffffffff1686602001516fffffffffffffffffffffffffffffffff16613be6565b61384d565b81602001906fffffffffffffffffffffffffffffffff1690816fffffffffffffffffffffffffffffffff16815250505b5b8091505092915050565b613aa8614658565b6040518060200160405280670de0b6b3a7640000815250905090565b613acc614658565b6040518060200160405280613aee848660000151613c3090919063ffffffff16565b815250905092915050565b613b01614658565b6040518060200160405280613b23848660000151613be690919063ffffffff16565b815250905092915050565b613b36614658565b6040518060200160405280613b5c85600001518560000151670de0b6b3a7640000614294565b815250905092915050565b600081602001516fffffffffffffffffffffffffffffffff1683602001516fffffffffffffffffffffffffffffffff161415613bdb57600083602001516fffffffffffffffffffffffffffffffff161415613bc55760019050613be0565b8160000151151583600001511515149050613be0565b600090505b92915050565b6000613c2883836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f77000081525061436f565b905092915050565b600080828401905083811015613c7b576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401613c72906156d2565b60405180910390fd5b8091505092915050565b613c8d61463c565b613c9561463c565b613c9d61460e565b604051806040016040528060011515815260200186602001516fffffffffffffffffffffffffffffffff168152509050613cd561460e565b604051806040016040528060001515815260200187600001516fffffffffffffffffffffffffffffffff168152509050613d0d61463c565b613d178387613578565b9050613d2161463c565b613d2b8388613578565b9050818195509550505050509250929050565b6000613d5783670de0b6b3a76400008460000151614294565b905092915050565b6000613d78838360000151670de0b6b3a7640000614294565b905092915050565b613d886146e5565b613d9061463c565b613d9861463c565b613da28588613c85565b915091506000613db0613f45565b90506000613ded613dda8a6040015163ffffffff168463ffffffff16613be690919063ffffffff16565b89600001516143ca90919063ffffffff16565b90506000613dfa8561443a565b15613e085760009050613e3b565b613e128288613d5f565b9050846020015184602001511015613e3a57613e378185602001518760200151614294565b90505b5b81811115613e4557fe5b6040518060600160405280613eab613ea68d600001516bffffffffffffffffffffffff16613e988f600001516bffffffffffffffffffffffff1688670de0b6b3a764000067ffffffffffffffff16614294565b613c3090919063ffffffff16565b61444a565b6bffffffffffffffffffffffff168152602001613f19613f148d602001516bffffffffffffffffffffffff16613f068f602001516bffffffffffffffffffffffff1687670de0b6b3a764000067ffffffffffffffff16614294565b613c3090919063ffffffff16565b61444a565b6bffffffffffffffffffffffff1681526020018463ffffffff1681525095505050505050949350505050565b6000613f50426144a9565b905090565b613f5d61463c565b613f6683614500565b15613f7a57613f73613552565b9050613f87565b613f848383613578565b90505b92915050565b613f9561460e565b613fa783613fa284614522565b6138b0565b905092915050565b613fb761463c565b613fbf61463c565b6040518060400160405280600115158152602001600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b815260040161403191906154d5565b60206040518083038186803b15801561404957600080fd5b505afa15801561405d573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506140819190810190614d9e565b815250905061408e61463c565b61409661463c565b6141ee600c6040518060400160405290816000820160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681526020016000820160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff1681525050613c85565b9150915061421782614209838661365790919063ffffffff16565b61365790919063ffffffff16565b935050505090565b6142276146e5565b6040518060600160405280670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001614286613f45565b63ffffffff16815250905090565b60006142bb826142ad85876143ca90919063ffffffff16565b61456390919063ffffffff16565b90509392505050565b6000808414806142d45750600083145b156142eb576142e4600083614563565b9050614339565b61433660016143288461431a600161430c898b6143ca90919063ffffffff16565b613be690919063ffffffff16565b61456390919063ffffffff16565b613c3090919063ffffffff16565b90505b9392505050565b61434861463c565b60405180604001604052808360000151151515815260200183602001518152509050919050565b60008383111582906143b7576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016143ae9190615690565b60405180910390fd5b5060008385039050809150509392505050565b6000808314156143dd5760009050614434565b60008284029050828482816143ee57fe5b041461442f576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161442690615752565b60405180910390fd5b809150505b92915050565b6000808260200151149050919050565b60008082905082816bffffffffffffffffffffffff16146144a0576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161449790615712565b60405180910390fd5b80915050919050565b600080829050828163ffffffff16146144f7576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016144ee90615732565b60405180910390fd5b80915050919050565b60008082602001516fffffffffffffffffffffffffffffffff16149050919050565b61452a61460e565b60405180604001604052808360000151151515815260200183602001516fffffffffffffffffffffffffffffffff168152509050919050565b60006145a583836040518060400160405280601a81526020017f536166654d6174683a206469766973696f6e206279207a65726f0000000000008152506145ad565b905092915050565b600080831182906145f4576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016145eb9190615690565b60405180910390fd5b50600083858161460057fe5b049050809150509392505050565b604051806040016040528060001515815260200160006fffffffffffffffffffffffffffffffff1681525090565b6040518060400160405280600015158152602001600081525090565b6040518060200160405280600081525090565b6040518060a00160405280600073ffffffffffffffffffffffffffffffffffffffff168152602001600060018111156146a057fe5b8152602001600060018111156146b257fe5b81526020016146bf614728565b81526020016146cc614728565b81525090565b6040518060200160405280600081525090565b604051806060016040528060006bffffffffffffffffffffffff16815260200160006bffffffffffffffffffffffff168152602001600063ffffffff1681525090565b604051806040016040528060001515815260200160006fffffffffffffffffffffffffffffffff1681525090565b60008135905061476581615d57565b92915050565b60008135905061477a81615d6e565b92915050565b60008151905061478f81615d6e565b92915050565b6000813590506147a481615d85565b92915050565b6000813590506147b981615d95565b92915050565b6000813590506147ce81615da5565b92915050565b6000608082840312156147e657600080fd5b6147f06080615918565b905060006148008482850161476b565b600083015250602061481484828501614795565b6020830152506040614828848285016147aa565b604083015250606061483c84828501614a85565b60608301525092915050565b60006020828403121561485a57600080fd5b6148646020615918565b9050600061487484828501614a85565b60008301525092915050565b60006020828403121561489257600080fd5b61489c6020615918565b905060006148ac84828501614a9a565b60008301525092915050565b6000606082840312156148ca57600080fd5b6148d46060615918565b905060006148e484828501614ac4565b60008301525060206148f884828501614ac4565b602083015250604061490c84828501614aaf565b60408301525092915050565b60006040828403121561492a57600080fd5b6149346040615918565b905060006149448482850161476b565b600083015250602061495884828501614a70565b60208301525092915050565b60006040828403121561497657600080fd5b6149806040615918565b905060006149908482850161476b565b60008301525060206149a484828501614a70565b60208301525092915050565b600060e082840312156149c257600080fd5b6149cc60a0615918565b905060006149dc84828501614756565b60008301525060206149f0848285016147bf565b6020830152506040614a04848285016147bf565b6040830152506060614a1884828501614918565b60608301525060a0614a2c84828501614918565b60808301525092915050565b600060208284031215614a4a57600080fd5b614a546020615918565b90506000614a6484828501614a9a565b60008301525092915050565b600081359050614a7f81615db5565b92915050565b600081359050614a9481615dcc565b92915050565b600081519050614aa981615dcc565b92915050565b600081359050614abe81615de3565b92915050565b600081359050614ad381615dfa565b92915050565b600060208284031215614aeb57600080fd5b6000614af984828501614756565b91505092915050565b600060208284031215614b1457600080fd5b6000614b2284828501614780565b91505092915050565b600060208284031215614b3d57600080fd5b6000614b4b848285016147bf565b91505092915050565b60008060008060006101208688031215614b6d57600080fd5b6000614b7b888289016147bf565b9550506020614b8c88828901614964565b9450506060614b9d88828901614964565b93505060a0614bae888289016148b8565b925050610100614bc088828901614848565b9150509295509295909350565b600080600060608486031215614be257600080fd5b6000614bf0868287016147bf565b9350506020614c0186828701614a85565b9250506040614c1286828701614848565b9150509250925092565b600060208284031215614c2e57600080fd5b6000614c3c84828501614848565b91505092915050565b600060208284031215614c5757600080fd5b6000614c6584828501614880565b91505092915050565b600060608284031215614c8057600080fd5b6000614c8e848285016148b8565b91505092915050565b60008060006101208486031215614cad57600080fd5b6000614cbb86828701614964565b9350506040614ccc868287016148b8565b92505060a0614cdd868287016147d4565b9150509250925092565b60008060808385031215614cfa57600080fd5b6000614d0885828601614964565b9250506040614d1985828601614964565b9150509250929050565b600060e08284031215614d3557600080fd5b6000614d43848285016149b0565b91505092915050565b600060208284031215614d5e57600080fd5b6000614d6c84828501614a38565b91505092915050565b600060208284031215614d8757600080fd5b6000614d9584828501614a85565b91505092915050565b600060208284031215614db057600080fd5b6000614dbe84828501614a9a565b91505092915050565b600080600060808486031215614ddc57600080fd5b6000614dea86828701614a85565b9350506020614dfb868287016147bf565b9250506040614e0c86828701614964565b9150509250925092565b614e1f81615a4f565b82525050565b614e2e81615a4f565b82525050565b614e3d81615a61565b82525050565b614e4c81615a61565b82525050565b614e5b81615aee565b82525050565b614e6a81615aee565b82525050565b614e7981615b12565b82525050565b614e8881615b12565b82525050565b614e9781615b36565b82525050565b614ea681615b36565b82525050565b614eb581615b5a565b82525050565b614ec481615b5a565b82525050565b614ed381615b7e565b82525050565b614ee281615b7e565b82525050565b614ef181615ba2565b82525050565b614f0081615ba2565b82525050565b6000614f1182615945565b614f1b8185615950565b9350614f2b818560208601615bb4565b614f3481615d05565b840191505092915050565b6000614f4c601983615950565b91507f53746174653a206f6e6c7920636f72652063616e2063616c6c000000000000006000830152602082019050919050565b6000614f8c601b83615950565b91507f536166654d6174683a206164646974696f6e206f766572666c6f7700000000006000830152602082019050919050565b6000614fcc601c83615950565b91507f4d6174683a20556e73616665206361737420746f2075696e74313238000000006000830152602082019050919050565b600061500c601b83615950565b91507f4d6174683a20556e73616665206361737420746f2075696e74393600000000006000830152602082019050919050565b600061504c601b83615950565b91507f4d6174683a20556e73616665206361737420746f2075696e74333200000000006000830152602082019050919050565b600061508c602183615950565b91507f536166654d6174683a206d756c7469706c69636174696f6e206f766572666c6f60008301527f77000000000000000000000000000000000000000000000000000000000000006020830152604082019050919050565b6020820160008201516150fb600085018261547b565b50505050565b602082016000820151615117600085018261547b565b50505050565b60208201600080830154905061513281615c83565b61513f600086018261547b565b5050505050565b6101408201600080830154905061515c81615be7565b6151696000860182614e52565b506001830154905061517a81615c1b565b6151876020860182614e8e565b506002830154905061519881615c4f565b6151a56040860182614eca565b50600383015490506151b681615c01565b6151c36060860182614e70565b50600483016151d5608086018261511d565b50600583016151e760a086018261511d565b50600683016151f960c086018261511d565b506007830161520b60e086018261511d565b506008830161521e61010086018261511d565b506009830154905061522f81615c35565b61523d610120860182614eac565b5050505050565b60608201600082015161525a60008501826154b7565b50602082015161526d60208501826154b7565b5060408201516152806040850182615499565b50505050565b60608201600080830154905061529b81615c9d565b6152a860008601826154b7565b506152b281615cb7565b6152bf60208601826154b7565b506152c981615ceb565b6152d66040860182615499565b5050505050565b6040820160008201516152f36000850182614e34565b506020820151615306602085018261545d565b50505050565b6040820160008201516153226000850182614e34565b506020820151615335602085018261545d565b50505050565b6040820160008201516153516000850182614e34565b506020820151615364602085018261545d565b50505050565b60e0820160008201516153806000850182614e16565b5060208201516153936020850182614ee8565b5060408201516153a66040850182614ee8565b5060608201516153b9606085018261530c565b5060808201516153cc60a085018261530c565b50505050565b6020820160008201516153e8600085018261547b565b50505050565b60408201600080830154905061540381615c69565b615410600086018261545d565b5061541a81615cd1565b615427602086018261545d565b5050505050565b6040820160008201516154446000850182614e34565b506020820151615457602085018261547b565b50505050565b61546681615a80565b82525050565b61547581615a80565b82525050565b61548481615abc565b82525050565b61549381615abc565b82525050565b6154a281615ac6565b82525050565b6154b181615ac6565b82525050565b6154c081615ad6565b82525050565b6154cf81615ad6565b82525050565b60006020820190506154ea6000830184614e25565b92915050565b600060e0820190506155056000830188614e25565b6155126020830187614ef7565b61551f6040830186614ef7565b61552c606083018561533b565b61553960a083018461533b565b9695505050505050565b60006040820190506155586000830185614e25565b615565602083018461548a565b9392505050565b60006060820190506155816000830186614e25565b61558e602083018561548a565b61559b604083018461548a565b949350505050565b60006020820190506155b86000830184614e43565b92915050565b60006020820190506155d36000830184614e61565b92915050565b6000610140820190506155ef600083018d614e61565b6155fc602083018c614e9d565b615609604083018b614ed9565b615616606083018a614e7f565b6156236080830189615101565b61563060a0830188615101565b61563d60c0830187615101565b61564a60e0830186615101565b615658610100830185615101565b615666610120830184614ebb565b9b9a5050505050505050505050565b600060208201905061568a6000830184614e9d565b92915050565b600060208201905081810360008301526156aa8184614f06565b905092915050565b600060208201905081810360008301526156cb81614f3f565b9050919050565b600060208201905081810360008301526156eb81614f7f565b9050919050565b6000602082019050818103600083015261570b81614fbf565b9050919050565b6000602082019050818103600083015261572b81614fff565b9050919050565b6000602082019050818103600083015261574b8161503f565b9050919050565b6000602082019050818103600083015261576b8161507f565b9050919050565b600060208201905061578760008301846150e5565b92915050565b6000610140820190506157a36000830184615146565b92915050565b60006060820190506157be6000830184615244565b92915050565b60006060820190506157d96000830184615286565b92915050565b60006040820190506157f460008301846152dd565b92915050565b600060808201905061580f60008301856152dd565b61581c604083018461542e565b9392505050565b600060e082019050615838600083018461536a565b92915050565b600060208201905061585360008301846153d2565b92915050565b600060408201905061586e60008301846153ee565b92915050565b6000604082019050615889600083018561546c565b615896602083018461546c565b9392505050565b60006020820190506158b2600083018461548a565b92915050565b60006040820190506158cd600083018561548a565b6158da602083018461548a565b9392505050565b60006060820190506158f660008301866154c6565b61590360208301856154c6565b61591060408301846154a8565b949350505050565b6000604051905081810181811067ffffffffffffffff8211171561593b57600080fd5b8060405250919050565b600081519050919050565b600082825260208201905092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006fffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b600063ffffffff82169050919050565b60006bffffffffffffffffffffffff82169050919050565b6000615a5a82615a9c565b9050919050565b60008115159050919050565b6000819050615a7b82615d4a565b919050565b60006fffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b600063ffffffff82169050919050565b60006bffffffffffffffffffffffff82169050919050565b6000615af982615b00565b9050919050565b6000615b0b82615a9c565b9050919050565b6000615b1d82615b24565b9050919050565b6000615b2f82615a9c565b9050919050565b6000615b4182615b48565b9050919050565b6000615b5382615a9c565b9050919050565b6000615b6582615b6c565b9050919050565b6000615b7782615a9c565b9050919050565b6000615b8982615b90565b9050919050565b6000615b9b82615a9c565b9050919050565b6000615bad82615a6d565b9050919050565b60005b83811015615bd2578082015181840152602081019050615bb7565b83811115615be1576000848401525b50505050565b6000615bfa615bf583615d16565b615961565b9050919050565b6000615c14615c0f83615d16565b615981565b9050919050565b6000615c2e615c2983615d16565b6159a1565b9050919050565b6000615c48615c4383615d16565b6159c1565b9050919050565b6000615c62615c5d83615d16565b6159e1565b9050919050565b6000615c7c615c7783615d16565b615a01565b9050919050565b6000615c96615c9183615d16565b615a1d565b9050919050565b6000615cb0615cab83615d16565b615a37565b9050919050565b6000615cca615cc583615d3d565b615a37565b9050919050565b6000615ce4615cdf83615d23565b615a01565b9050919050565b6000615cfe615cf983615d30565b615a27565b9050919050565b6000601f19601f8301169050919050565b60008160001c9050919050565b60008160801c9050919050565b60008160c01c9050919050565b60008160601c9050919050565b60028110615d5457fe5b50565b615d6081615a4f565b8114615d6b57600080fd5b50565b615d7781615a61565b8114615d8257600080fd5b50565b60028110615d9257600080fd5b50565b60028110615da257600080fd5b50565b60028110615db257600080fd5b50565b615dbe81615a80565b8114615dc957600080fd5b50565b615dd581615abc565b8114615de057600080fd5b50565b615dec81615ac6565b8114615df757600080fd5b50565b615e0381615ad6565b8114615e0e57600080fd5b5056fea365627a7a72315820b9378f85d8d7be7ca395d827d4cb54e9f74420ab2c14861418a99fc96f4994106c6578706572696d656e74616cf564736f6c63430005100040";
}
