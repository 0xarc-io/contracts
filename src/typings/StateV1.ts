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

    updateSupplyBalance: TypedFunctionDescription<{
      encode([owner, sign, deltaPar]: [
        string,
        boolean,
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
  updateSupplyBalance(
    owner: string,
    sign: boolean,
    deltaPar: { sign: boolean; value: BigNumberish },
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
    updateSupplyBalance(
      owner: string,
      sign: boolean,
      deltaPar: { sign: boolean; value: BigNumberish }
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
    '[{"inputs":[{"internalType":"address","name":"_core","type":"address"},{"internalType":"address","name":"_admin","type":"address"},{"components":[{"internalType":"contract IERC20","name":"stableAsset","type":"address"},{"internalType":"contract IMintableToken","name":"lendAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"internalType":"contract IInterestSetter","name":"interestSetter","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"earningsRate","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"internalType":"struct Types.GlobalParams","name":"_globalParams","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"components":[{"internalType":"contract IERC20","name":"stableAsset","type":"address"},{"internalType":"contract IMintableToken","name":"lendAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"internalType":"contract IInterestSetter","name":"interestSetter","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"earningsRate","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"indexed":false,"internalType":"struct Types.GlobalParams","name":"updatedParams","type":"tuple"}],"name":"GlobalParamsUpdate","type":"event"},{"anonymous":false,"inputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"indexed":false,"internalType":"struct Interest.Index","name":"updatedIndex","type":"tuple"}],"name":"LogIndexUpdate","type":"event"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"parSupply","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"parBorrow","type":"tuple"},{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"borrowIndex","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateCollateralDelta","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateInverseAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateInverseRequired","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"calculateLiquidationPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"index","type":"tuple"}],"name":"fetchInterestRate","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Interest.Rate","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"index","type":"tuple"}],"name":"fetchNewIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"getAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"getBorrowIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"positionId","type":"uint256"}],"name":"getBorrowWei","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getCurrentPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"currentPar","type":"tuple"},{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"index","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"enum Types.AssetDenomination","name":"denomination","type":"uint8"},{"internalType":"enum Types.AssetReference","name":"ref","type":"uint8"},{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Types.AssetAmount","name":"amount","type":"tuple"}],"name":"getNewParAndDeltaWei","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Types.Wei","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getPosition","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getStableAsset","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"getSupplyBalance","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"supplier","type":"address"}],"name":"getSupplyWei","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getSyntheticAsset","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getTotalPar","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"globalIndex","outputs":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"position","type":"tuple"}],"name":"isCollateralized","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"params","outputs":[{"internalType":"contract IERC20","name":"stableAsset","type":"address"},{"internalType":"contract IMintableToken","name":"lendAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"internalType":"contract IInterestSetter","name":"interestSetter","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"earningsRate","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"positionCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"positions","outputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"removeExcessTokens","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"position","type":"tuple"}],"name":"savePosition","outputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"amount","type":"tuple"}],"name":"setAmount","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"ratio","type":"tuple"}],"name":"setCollateralRatio","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"rate","type":"tuple"}],"name":"setEarningsRate","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_setter","type":"address"}],"name":"setInterestSetter","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"spread","type":"tuple"}],"name":"setLiquidationSpread","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_oracle","type":"address"}],"name":"setOracle","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"fee","type":"tuple"}],"name":"setOriginationFee","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"ratio","type":"tuple"}],"name":"setSyntheticRatio","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalPar","outputs":[{"internalType":"uint128","name":"borrow","type":"uint128"},{"internalType":"uint128","name":"supply","type":"uint128"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"updateIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"amount","type":"tuple"}],"name":"updatePositionAmount","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"bool","name":"sign","type":"bool"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"deltaPar","type":"tuple"}],"name":"updateSupplyBalance","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"existingPar","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"newPar","type":"tuple"}],"name":"updateTotalPar","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
  public static Bytecode =
    "0x60806040523480156200001157600080fd5b506040516200682438038062006824833981810160405262000037919081019062000669565b826000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555081600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555080600260008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160010160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060408201518160020160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060608201518160030160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060808201518160040160008201518160000155505060a08201518160050160008201518160000155505060c08201518160060160008201518160000155505060e082015181600701600082015181600001555050610100820151816008016000820151816000015550506101208201518160090160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550905050620002a16200034460201b620043a81760201c565b600d60008201518160000160006101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff160217905550602082015181600001600c6101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff16021790555060408201518160000160186101000a81548163ffffffff021916908363ffffffff160217905550905050505050620008bb565b6200034e6200043f565b6040518060600160405280670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001620003ba620003c860201b620040ce1760201c565b63ffffffff16815250905090565b6000620003e042620003e560201b620046321760201c565b905090565b600080829050828163ffffffff161462000436576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016200042d9062000702565b60405180910390fd5b80915050919050565b604051806060016040528060006bffffffffffffffffffffffff16815260200160006bffffffffffffffffffffffff168152602001600063ffffffff1681525090565b600081519050620004938162000805565b92915050565b600081519050620004aa816200081f565b92915050565b600081519050620004c18162000839565b92915050565b600081519050620004d88162000853565b92915050565b600081519050620004ef816200086d565b92915050565b600081519050620005068162000887565b92915050565b6000602082840312156200051f57600080fd5b6200052b602062000724565b905060006200053d8482850162000652565b60008301525092915050565b600061014082840312156200055d57600080fd5b6200056a61014062000724565b905060006200057c8482850162000499565b60008301525060206200059284828501620004c7565b6020830152506040620005a884828501620004f5565b6040830152506060620005be84828501620004b0565b6060830152506080620005d4848285016200050c565b60808301525060a0620005ea848285016200050c565b60a08301525060c062000600848285016200050c565b60c08301525060e062000616848285016200050c565b60e0830152506101006200062d848285016200050c565b610100830152506101206200064584828501620004de565b6101208301525092915050565b6000815190506200066381620008a1565b92915050565b600080600061018084860312156200068057600080fd5b6000620006908682870162000482565b9350506020620006a38682870162000482565b9250506040620006b68682870162000549565b9150509250925092565b6000620006cf601b8362000752565b91507f4d6174683a20556e73616665206361737420746f2075696e74333200000000006000830152602082019050919050565b600060208201905081810360008301526200071d81620006c0565b9050919050565b6000604051905081810181811067ffffffffffffffff821117156200074857600080fd5b8060405250919050565b600082825260208201905092915050565b60006200077082620007db565b9050919050565b6000620007848262000763565b9050919050565b6000620007988262000763565b9050919050565b6000620007ac8262000763565b9050919050565b6000620007c08262000763565b9050919050565b6000620007d48262000763565b9050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b620008108162000763565b81146200081c57600080fd5b50565b6200082a8162000777565b81146200083657600080fd5b50565b62000844816200078b565b81146200085057600080fd5b50565b6200085e816200079f565b81146200086a57600080fd5b50565b6200087881620007b3565b81146200088457600080fd5b50565b6200089281620007c7565b81146200089e57600080fd5b50565b620008ac81620007fb565b8114620008b857600080fd5b50565b615f5980620008cb6000396000f3fe608060405234801561001057600080fd5b50600436106102325760003560e01c806396d7d7e111610130578063e043095a116100b8578063eb02c3011161007c578063eb02c3011461070f578063eb91d37e1461073f578063ef9d39261461075d578063f38e266a1461078d578063f9bd3235146107bd57610232565b8063e043095a14610657578063e2e02e0c14610673578063e2f6720e146106a3578063e7702d05146106d3578063e7a45f2e146106f157610232565b8063b9f412b0116100ff578063b9f412b014610592578063bcaa0c55146105b0578063bf0b4927146105e0578063cff0ab9614610610578063d890a8701461063757610232565b806396d7d7e1146104f35780639997640d1461052357806399fbab881461053f578063b44c061f1461057357610232565b806356cffd13116101be578063743bd7c911610182578063743bd7c91461043a5780637adbf973146104595780637c7c200a1461047557806381045ead146104a55780638a627d0d146104c357610232565b806356cffd1314610398578063599b81e7146103b4578063651fafe1146103e45780636e830f4a14610400578063740e67ef1461041c57610232565b80632626ab08116102055780632626ab08146102e45780632863612b1461030057806338d86cb114610330578063400520491461034c5780634c2fbfc61461037c57610232565b80630625dce1146102375780630e884c12146102535780631896174e146102845780631e31274a146102b4575b600080fd5b610251600480360361024c9190810190614df4565b6107ed565b005b61026d60048036036102689190810190614e6f565b6108cb565b60405161027b929190615977565b60405180910390f35b61029e60048036036102999190810190614efb565b610a88565b6040516102ab91906159ff565b60405180910390f35b6102ce60048036036102c99190810190614efb565b610cbb565b6040516102db919061573b565b60405180910390f35b6102fe60048036036102f99190810190614df4565b610dd3565b005b61031a60048036036103159190810190614d03565b610eb1565b60405161032791906158ef565b60405180910390f35b61034a60048036036103459190810190614c8b565b610ffe565b005b61036660048036036103619190810190614f9f565b6111ee565b60405161037391906159a0565b60405180910390f35b61039660048036036103919190810190614df4565b611557565b005b6103b260048036036103ad9190810190614ebf565b611635565b005b6103ce60048036036103c99190810190614e46565b611979565b6040516103db91906159bb565b60405180910390f35b6103fe60048036036103f99190810190614df4565b611b33565b005b61041a60048036036104159190810190614df4565b611c11565b005b610424611cef565b6040516104319190615756565b60405180910390f35b610442611d1c565b6040516104509291906159d6565b60405180910390f35b610473600480360361046e9190810190614c62565b611d66565b005b61048f600480360361048a9190810190614da5565b611e75565b60405161049c91906159ff565b60405180910390f35b6104ad611edf565b6040516104ba9190615926565b60405180910390f35b6104dd60048036036104d89190810190614e46565b611f9b565b6040516104ea9190615926565b60405180910390f35b61050d60048036036105089190810190614da5565b612083565b60405161051a919061595c565b60405180910390f35b61053d60048036036105389190810190614c62565b612164565b005b61055960048036036105549190810190614f4d565b612273565b60405161056a959493929190615688565b60405180910390f35b61057b6123c1565b604051610589929190615a1a565b60405180910390f35b61059a61243a565b6040516105a79190615926565b60405180910390f35b6105ca60048036036105c59190810190614d03565b612766565b6040516105d7919061566d565b60405180910390f35b6105fa60048036036105f59190810190614d2c565b6127dd565b604051610607919061595c565b60405180910390f35b610618612893565b60405161062e9a99989796959493929190615771565b60405180910390f35b61063f6129d9565b60405161064e93929190615a43565b60405180910390f35b610671600480360361066c9190810190614c62565b612a31565b005b61068d60048036036106889190810190614f9f565b612b8e565b60405161069a91906159a0565b60405180910390f35b6106bd60048036036106b89190810190614f4d565b613001565b6040516106ca91906159ff565b60405180910390f35b6106db613208565b6040516106e891906159ff565b60405180910390f35b6106f961320e565b6040516107069190615756565b60405180910390f35b61072960048036036107249190810190614f4d565b61323a565b60405161073691906159a0565b60405180910390f35b610747613409565b60405161075491906158ef565b60405180910390f35b61077760048036036107729190810190614d03565b6134b9565b6040516107849190615926565b60405180910390f35b6107a760048036036107a29190810190614c62565b6135a6565b6040516107b4919061595c565b60405180910390f35b6107d760048036036107d29190810190614c62565b613694565b6040516107e491906159ff565b60405180910390f35b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461087d576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016108749061582f565b60405180910390fd5b806002600801600082015181600001559050507f26dc705bd82557c9b04b12ffc791436879cc8ea5bb10fb1fa1d1e6ff2293774060026040516108c0919061590a565b60405180910390a150565b6108d3614797565b6108db6147c5565b600083606001511480156109095750600060018111156108f757fe5b8360400151600181111561090757fe5b145b1561092057846109176136db565b91509150610a80565b6109286147c5565b6109328686613701565b905061093c614797565b6109446147c5565b6000600181111561095157fe5b8660200151600181111561096157fe5b14156109e35760405180604001604052808760000151151581526020018760600151815250905060018081111561099457fe5b866040015160018111156109a457fe5b14156109c0576109bd83826137e090919063ffffffff16565b90505b6109dc6109d6828561380290919063ffffffff16565b886138d8565b9150610a76565b6040518060400160405280876000015115158152602001610a0788606001516139d6565b6fffffffffffffffffffffffffffffffff16815250915060006001811115610a2b57fe5b86604001516001811115610a3b57fe5b1415610a5757610a548289613a3990919063ffffffff16565b91505b610a7383610a65848a613701565b6137e090919063ffffffff16565b90505b8181945094505050505b935093915050565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610b19576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610b109061582f565b60405180910390fd5b600e54905081600f6000600e54815260200190815260200160002060008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160000160146101000a81548160ff02191690836001811115610b9f57fe5b021790555060408201518160000160156101000a81548160ff02191690836001811115610bc857fe5b021790555060608201518160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550505060808201518160020160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055505050905050600e60008154809291906001019190505550919050565b6000808260800151602001516fffffffffffffffffffffffffffffffff161415610ce85760019050610dce565b610cf06147e1565b600260090160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b158015610d5b57600080fd5b505afa158015610d6f573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250610d939190810190614e1d565b9050610d9d614797565b610dc2846040015185606001518660800151610dbc88604001516134b9565b866127dd565b90508060000151925050505b919050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610e63576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610e5a9061582f565b60405180910390fd5b806002600401600082015181600001559050507f26dc705bd82557c9b04b12ffc791436879cc8ea5bb10fb1fa1d1e6ff229377406002604051610ea6919061590a565b60405180910390a150565b610eb96147e1565b610ec16147e1565b610ec96147e1565b600260090160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b158015610f3457600080fd5b505afa158015610f48573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250610f6c9190810190614e1d565b905060006001811115610f7b57fe5b846001811115610f8757fe5b1415610fad57610fa6610f98613c29565b600260060160000154613c4d565b9150610fe8565b600180811115610fb957fe5b846001811115610fc557fe5b1415610fe757610fe4610fd6613c29565b600260060160000154613c82565b91505b5b610ff28183613cb7565b91508192505050919050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461108d576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016110849061582f565b60405180910390fd5b811561114057600260010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166340c10f198483602001516fffffffffffffffffffffffffffffffff166040518363ffffffff1660e01b81526004016111099291906156db565b600060405180830381600087803b15801561112357600080fd5b505af1158015611137573d6000803e3d6000fd5b505050506111e9565b600260010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16639dc29fac8483602001516fffffffffffffffffffffffffffffffff166040518363ffffffff1660e01b81526004016111b69291906156db565b600060405180830381600087803b1580156111d057600080fd5b505af11580156111e4573d6000803e3d6000fd5b505050505b505050565b6111f66147f4565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611285576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161127c9061582f565b60405180910390fd5b6000600f600086815260200190815260200160002090508360018111156112a857fe5b8160000160149054906101000a900460ff1660018111156112c557fe5b141561133757828160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff16021790555090505061139f565b828160020160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055509050505b806040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff16600181111561141f57fe5b600181111561142a57fe5b81526020016000820160159054906101000a900460ff16600181111561144c57fe5b600181111561145757fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509150509392505050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146115e7576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016115de9061582f565b60405180910390fd5b806002600701600082015181600001559050507f26dc705bd82557c9b04b12ffc791436879cc8ea5bb10fb1fa1d1e6ff22937740600260405161162a919061590a565b60405180910390a150565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146116c4576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016116bb9061582f565b60405180910390fd5b6116ce8282613cf0565b156116d857611975565b8160000151156117865761174661174183602001516fffffffffffffffffffffffffffffffff16600c60000160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16613d6f90919063ffffffff16565b6139d6565b600c60000160106101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550611826565b6117ea6117e583602001516fffffffffffffffffffffffffffffffff16600c60000160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16613d6f90919063ffffffff16565b6139d6565b600c60000160006101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055505b8060000151156118d45761189461188f82602001516fffffffffffffffffffffffffffffffff16600c60000160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16613db990919063ffffffff16565b6139d6565b600c60000160106101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550611974565b61193861193382602001516fffffffffffffffffffffffffffffffff16600c60000160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16613db990919063ffffffff16565b6139d6565b600c60000160006101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055505b5b5050565b61198161485b565b6119896147c5565b6119916147c5565b611a3b600c6040518060400160405290816000820160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681526020016000820160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505085613e0e565b91509150611a4761485b565b600260030160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663e8177dcf600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16846020015186602001516040518463ffffffff1660e01b8152600401611ad693929190615704565b60206040518083038186803b158015611aee57600080fd5b505afa158015611b02573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250611b269190810190614f24565b9050809350505050919050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611bc3576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611bba9061582f565b60405180910390fd5b806002600601600082015181600001559050507f26dc705bd82557c9b04b12ffc791436879cc8ea5bb10fb1fa1d1e6ff229377406002604051611c06919061590a565b60405180910390a150565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611ca1576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611c989061582f565b60405180910390fd5b806002600501600082015181600001559050507f26dc705bd82557c9b04b12ffc791436879cc8ea5bb10fb1fa1d1e6ff229377406002604051611ce4919061590a565b60405180910390a150565b6000600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b600c8060000160009054906101000a90046fffffffffffffffffffffffffffffffff16908060000160109054906101000a90046fffffffffffffffffffffffffffffffff16905082565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611df6576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611ded9061582f565b60405180910390fd5b80600260090160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507f26dc705bd82557c9b04b12ffc791436879cc8ea5bb10fb1fa1d1e6ff229377406002604051611e6a919061590a565b60405180910390a150565b60008060006001811115611e8557fe5b856001811115611e9157fe5b1415611ea857611ea18484613ec7565b9050611ed4565b600180811115611eb457fe5b856001811115611ec057fe5b1415611ed357611ed08484613ee8565b90505b5b809150509392505050565b611ee761486e565b600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff1681525050905090565b611fa361486e565b611fab61485b565b611fb483611979565b905061207b8382600c6040518060400160405290816000820160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681526020016000820160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250506002600801604051806020016040529081600082015481525050613f09565b915050919050565b61208b614797565b6000612098858585611e75565b9050600060018111156120a757fe5b8560018111156120b357fe5b14156120e3576120dc816002600501604051806020016040529081600082015481525050613ee8565b9050612128565b6001808111156120ef57fe5b8560018111156120fb57fe5b141561212757612124816002600401604051806020016040529081600082015481525050613ee8565b90505b5b6040518060400160405280600115158152602001612145836139d6565b6fffffffffffffffffffffffffffffffff168152509150509392505050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146121f4576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016121eb9061582f565b60405180910390fd5b80600260030160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507f26dc705bd82557c9b04b12ffc791436879cc8ea5bb10fb1fa1d1e6ff229377406002604051612268919061590a565b60405180910390a150565b600f6020528060005260406000206000915090508060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060000160149054906101000a900460ff16908060000160159054906101000a900460ff1690806001016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505090806002016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050905085565b600080600c60000160109054906101000a90046fffffffffffffffffffffffffffffffff16600c60000160009054906101000a90046fffffffffffffffffffffffffffffffff16816fffffffffffffffffffffffffffffffff169150806fffffffffffffffffffffffffffffffff169050915091509091565b61244261486e565b61244a6140ce565b63ffffffff16600d60000160189054906101000a900463ffffffff1663ffffffff16141561252857600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff16815250509050612763565b6125df600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff1681525050611f9b565b600d60008201518160000160006101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff160217905550602082015181600001600c6101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff16021790555060408201518160000160186101000a81548163ffffffff021916908363ffffffff1602179055509050507fb3ce7cef273a3bb22fa9889926a7512701b5f199b93128282495eceeedbdcd00600d6040516126a99190615941565b60405180910390a1600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff168152505090505b90565b600080600181111561277457fe5b82600181111561278057fe5b146127af576002800160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff166127d6565b600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff165b9050919050565b6127e5614797565b6127ed614797565b6127f5614797565b6127fd6147c5565b61280787876140de565b90506000600181111561281657fe5b89600181111561282257fe5b141561283e5761283789826020015187612083565b915061286f565b60018081111561284a57fe5b89600181111561285657fe5b141561286e5761286b89826020015187612083565b91505b5b612882828961411690919063ffffffff16565b925082935050505095945050505050565b60028060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060020160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060030160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690806004016040518060200160405290816000820154815250509080600501604051806020016040529081600082015481525050908060060160405180602001604052908160008201548152505090806007016040518060200160405290816000820154815250509080600801604051806020016040529081600082015481525050908060090160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690508a565b600d8060000160009054906101000a90046bffffffffffffffffffffffff169080600001600c9054906101000a90046bffffffffffffffffffffffff16908060000160189054906101000a900463ffffffff16905083565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614612ac1576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401612ab89061582f565b60405180910390fd5b612ac96147c5565b612ad1614138565b9050600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663a9059cbb8383602001516040518363ffffffff1660e01b8152600401612b379291906156db565b602060405180830381600087803b158015612b5157600080fd5b505af1158015612b65573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250612b899190810190614cda565b505050565b612b966147f4565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614612c25576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401612c1c9061582f565b60405180910390fd5b6000600f60008681526020019081526020016000209050836001811115612c4857fe5b8160000160149054906101000a900460ff166001811115612c6557fe5b1415612d5c57612cf183826001016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050613a3990919063ffffffff16565b8160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550905050612e49565b612de283826002016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050613a3990919063ffffffff16565b8160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055509050505b806040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff166001811115612ec957fe5b6001811115612ed457fe5b81526020016000820160159054906101000a900460ff166001811115612ef657fe5b6001811115612f0157fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509150509392505050565b600061300b6147f4565b600f60008481526020019081526020016000206040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff16600181111561309d57fe5b60018111156130a857fe5b81526020016000820160159054906101000a900460ff1660018111156130ca57fe5b60018111156130d557fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152505090506131d56147c5565b6131f86131e583604001516134b9565b83608001516140de90919063ffffffff16565b9050806020015192505050919050565b600e5481565b60006002800160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b6132426147f4565b600f60008381526020019081526020016000206040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff1660018111156132d457fe5b60018111156132df57fe5b81526020016000820160159054906101000a900460ff16600181111561330157fe5b600181111561330c57fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509050919050565b6134116147e1565b600260090160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b15801561347c57600080fd5b505afa158015613490573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506134b49190810190614e1d565b905090565b6134c161486e565b600060018111156134ce57fe5b8260018111156134da57fe5b141561359657600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff168152505090506135a1565b61359e6143a8565b90505b919050565b6135ae614797565b6040518060400160405280600115158152602001613678600260010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166370a08231866040518263ffffffff1660e01b8152600401613623919061566d565b60206040518083038186803b15801561363b57600080fd5b505afa15801561364f573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506136739190810190614f76565b6139d6565b6fffffffffffffffffffffffffffffffff168152509050919050565b600061369e614797565b6136a7836135a6565b90506136b16147c5565b6136cb6136bc611edf565b836140de90919063ffffffff16565b9050806020015192505050919050565b6136e36147c5565b60405180604001604052806000151581526020016000815250905090565b6137096147c5565b600083602001516fffffffffffffffffffffffffffffffff16905083600001511561378657604051806040016040528060011515815260200161377b85602001516bffffffffffffffffffffffff16670de0b6b3a764000067ffffffffffffffff168561441d9092919063ffffffff16565b8152509150506137da565b60405180604001604052806000151581526020016137d385600001516bffffffffffffffffffffffff16670de0b6b3a764000067ffffffffffffffff168561444d9092919063ffffffff16565b8152509150505b92915050565b6137e86147c5565b6137fa836137f5846144c9565b613802565b905092915050565b61380a6147c5565b6138126147c5565b8260000151151584600001511515141561385a57836000015181600001901515908115158152505061384c84602001518460200151613db9565b8160200181815250506138ce565b826020015184602001511061389d57836000015181600001901515908115158152505061388f84602001518460200151613d6f565b8160200181815250506138cd565b82600001518160000190151590811515815250506138c383602001518560200151613d6f565b8160200181815250505b5b8091505092915050565b6138e0614797565b82600001511561395f57604051806040016040528060011515815260200161394361393e670de0b6b3a764000067ffffffffffffffff1686602001516bffffffffffffffffffffffff16886020015161441d9092919063ffffffff16565b6139d6565b6fffffffffffffffffffffffffffffffff1681525090506139d0565b60405180604001604052806000151581526020016139b86139b3670de0b6b3a764000067ffffffffffffffff1686600001516bffffffffffffffffffffffff16886020015161444d9092919063ffffffff16565b6139d6565b6fffffffffffffffffffffffffffffffff1681525090505b92915050565b60008082905082816fffffffffffffffffffffffffffffffff1614613a30576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401613a279061586f565b60405180910390fd5b80915050919050565b613a41614797565b613a49614797565b82600001511515846000015115151415613ae3578360000151816000019015159081151581525050613aaf613aaa85602001516fffffffffffffffffffffffffffffffff1685602001516fffffffffffffffffffffffffffffffff16613db9565b6139d6565b81602001906fffffffffffffffffffffffffffffffff1690816fffffffffffffffffffffffffffffffff1681525050613c1f565b82602001516fffffffffffffffffffffffffffffffff1684602001516fffffffffffffffffffffffffffffffff1610613b9c578360000151816000019015159081151581525050613b68613b6385602001516fffffffffffffffffffffffffffffffff1685602001516fffffffffffffffffffffffffffffffff16613d6f565b6139d6565b81602001906fffffffffffffffffffffffffffffffff1690816fffffffffffffffffffffffffffffffff1681525050613c1e565b8260000151816000019015159081151581525050613bee613be984602001516fffffffffffffffffffffffffffffffff1686602001516fffffffffffffffffffffffffffffffff16613d6f565b6139d6565b81602001906fffffffffffffffffffffffffffffffff1690816fffffffffffffffffffffffffffffffff16815250505b5b8091505092915050565b613c316147e1565b6040518060200160405280670de0b6b3a7640000815250905090565b613c556147e1565b6040518060200160405280613c77848660000151613db990919063ffffffff16565b815250905092915050565b613c8a6147e1565b6040518060200160405280613cac848660000151613d6f90919063ffffffff16565b815250905092915050565b613cbf6147e1565b6040518060200160405280613ce585600001518560000151670de0b6b3a764000061441d565b815250905092915050565b600081602001516fffffffffffffffffffffffffffffffff1683602001516fffffffffffffffffffffffffffffffff161415613d6457600083602001516fffffffffffffffffffffffffffffffff161415613d4e5760019050613d69565b8160000151151583600001511515149050613d69565b600090505b92915050565b6000613db183836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f7700008152506144f8565b905092915050565b600080828401905083811015613e04576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401613dfb9061584f565b60405180910390fd5b8091505092915050565b613e166147c5565b613e1e6147c5565b613e26614797565b604051806040016040528060011515815260200186602001516fffffffffffffffffffffffffffffffff168152509050613e5e614797565b604051806040016040528060001515815260200187600001516fffffffffffffffffffffffffffffffff168152509050613e966147c5565b613ea08387613701565b9050613eaa6147c5565b613eb48388613701565b9050818195509550505050509250929050565b6000613ee083670de0b6b3a7640000846000015161441d565b905092915050565b6000613f01838360000151670de0b6b3a764000061441d565b905092915050565b613f1161486e565b613f196147c5565b613f216147c5565b613f2b8588613e0e565b915091506000613f396140ce565b90506000613f76613f638a6040015163ffffffff168463ffffffff16613d6f90919063ffffffff16565b896000015161455390919063ffffffff16565b90506000613f83856145c3565b15613f915760009050613fc4565b613f9b8288613ee8565b9050846020015184602001511015613fc357613fc0818560200151876020015161441d565b90505b5b81811115613fce57fe5b604051806060016040528061403461402f8d600001516bffffffffffffffffffffffff166140218f600001516bffffffffffffffffffffffff1688670de0b6b3a764000067ffffffffffffffff1661441d565b613db990919063ffffffff16565b6145d3565b6bffffffffffffffffffffffff1681526020016140a261409d8d602001516bffffffffffffffffffffffff1661408f8f602001516bffffffffffffffffffffffff1687670de0b6b3a764000067ffffffffffffffff1661441d565b613db990919063ffffffff16565b6145d3565b6bffffffffffffffffffffffff1681526020018463ffffffff1681525095505050505050949350505050565b60006140d942614632565b905090565b6140e66147c5565b6140ef83614689565b15614103576140fc6136db565b9050614110565b61410d8383613701565b90505b92915050565b61411e614797565b6141308361412b846146ab565b613a39565b905092915050565b6141406147c5565b6141486147c5565b6040518060400160405280600115158152602001600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b81526004016141ba919061566d565b60206040518083038186803b1580156141d257600080fd5b505afa1580156141e6573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525061420a9190810190614f76565b81525090506142176147c5565b61421f6147c5565b614377600c6040518060400160405290816000820160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681526020016000820160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050600d6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff1681525050613e0e565b915091506143a08261439283866137e090919063ffffffff16565b6137e090919063ffffffff16565b935050505090565b6143b061486e565b6040518060600160405280670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff16815260200161440f6140ce565b63ffffffff16815250905090565b600061444482614436858761455390919063ffffffff16565b6146ec90919063ffffffff16565b90509392505050565b60008084148061445d5750600083145b156144745761446d6000836146ec565b90506144c2565b6144bf60016144b1846144a36001614495898b61455390919063ffffffff16565b613d6f90919063ffffffff16565b6146ec90919063ffffffff16565b613db990919063ffffffff16565b90505b9392505050565b6144d16147c5565b60405180604001604052808360000151151515815260200183602001518152509050919050565b6000838311158290614540576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401614537919061580d565b60405180910390fd5b5060008385039050809150509392505050565b60008083141561456657600090506145bd565b600082840290508284828161457757fe5b04146145b8576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016145af906158cf565b60405180910390fd5b809150505b92915050565b6000808260200151149050919050565b60008082905082816bffffffffffffffffffffffff1614614629576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016146209061588f565b60405180910390fd5b80915050919050565b600080829050828163ffffffff1614614680576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401614677906158af565b60405180910390fd5b80915050919050565b60008082602001516fffffffffffffffffffffffffffffffff16149050919050565b6146b3614797565b60405180604001604052808360000151151515815260200183602001516fffffffffffffffffffffffffffffffff168152509050919050565b600061472e83836040518060400160405280601a81526020017f536166654d6174683a206469766973696f6e206279207a65726f000000000000815250614736565b905092915050565b6000808311829061477d576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401614774919061580d565b60405180910390fd5b50600083858161478957fe5b049050809150509392505050565b604051806040016040528060001515815260200160006fffffffffffffffffffffffffffffffff1681525090565b6040518060400160405280600015158152602001600081525090565b6040518060200160405280600081525090565b6040518060a00160405280600073ffffffffffffffffffffffffffffffffffffffff1681526020016000600181111561482957fe5b81526020016000600181111561483b57fe5b81526020016148486148b1565b81526020016148556148b1565b81525090565b6040518060200160405280600081525090565b604051806060016040528060006bffffffffffffffffffffffff16815260200160006bffffffffffffffffffffffff168152602001600063ffffffff1681525090565b604051806040016040528060001515815260200160006fffffffffffffffffffffffffffffffff1681525090565b6000813590506148ee81615e5c565b92915050565b60008135905061490381615e73565b92915050565b60008151905061491881615e73565b92915050565b60008135905061492d81615e8a565b92915050565b60008135905061494281615e9a565b92915050565b60008135905061495781615eaa565b92915050565b60006080828403121561496f57600080fd5b6149796080615a7a565b90506000614989848285016148f4565b600083015250602061499d8482850161491e565b60208301525060406149b184828501614933565b60408301525060606149c584828501614c0e565b60608301525092915050565b6000602082840312156149e357600080fd5b6149ed6020615a7a565b905060006149fd84828501614c0e565b60008301525092915050565b600060208284031215614a1b57600080fd5b614a256020615a7a565b90506000614a3584828501614c23565b60008301525092915050565b600060608284031215614a5357600080fd5b614a5d6060615a7a565b90506000614a6d84828501614c4d565b6000830152506020614a8184828501614c4d565b6020830152506040614a9584828501614c38565b60408301525092915050565b600060408284031215614ab357600080fd5b614abd6040615a7a565b90506000614acd848285016148f4565b6000830152506020614ae184828501614bf9565b60208301525092915050565b600060408284031215614aff57600080fd5b614b096040615a7a565b90506000614b19848285016148f4565b6000830152506020614b2d84828501614bf9565b60208301525092915050565b600060e08284031215614b4b57600080fd5b614b5560a0615a7a565b90506000614b65848285016148df565b6000830152506020614b7984828501614948565b6020830152506040614b8d84828501614948565b6040830152506060614ba184828501614aa1565b60608301525060a0614bb584828501614aa1565b60808301525092915050565b600060208284031215614bd357600080fd5b614bdd6020615a7a565b90506000614bed84828501614c23565b60008301525092915050565b600081359050614c0881615eba565b92915050565b600081359050614c1d81615ed1565b92915050565b600081519050614c3281615ed1565b92915050565b600081359050614c4781615ee8565b92915050565b600081359050614c5c81615eff565b92915050565b600060208284031215614c7457600080fd5b6000614c82848285016148df565b91505092915050565b600080600060808486031215614ca057600080fd5b6000614cae868287016148df565b9350506020614cbf868287016148f4565b9250506040614cd086828701614aed565b9150509250925092565b600060208284031215614cec57600080fd5b6000614cfa84828501614909565b91505092915050565b600060208284031215614d1557600080fd5b6000614d2384828501614948565b91505092915050565b60008060008060006101208688031215614d4557600080fd5b6000614d5388828901614948565b9550506020614d6488828901614aed565b9450506060614d7588828901614aed565b93505060a0614d8688828901614a41565b925050610100614d98888289016149d1565b9150509295509295909350565b600080600060608486031215614dba57600080fd5b6000614dc886828701614948565b9350506020614dd986828701614c0e565b9250506040614dea868287016149d1565b9150509250925092565b600060208284031215614e0657600080fd5b6000614e14848285016149d1565b91505092915050565b600060208284031215614e2f57600080fd5b6000614e3d84828501614a09565b91505092915050565b600060608284031215614e5857600080fd5b6000614e6684828501614a41565b91505092915050565b60008060006101208486031215614e8557600080fd5b6000614e9386828701614aed565b9350506040614ea486828701614a41565b92505060a0614eb58682870161495d565b9150509250925092565b60008060808385031215614ed257600080fd5b6000614ee085828601614aed565b9250506040614ef185828601614aed565b9150509250929050565b600060e08284031215614f0d57600080fd5b6000614f1b84828501614b39565b91505092915050565b600060208284031215614f3657600080fd5b6000614f4484828501614bc1565b91505092915050565b600060208284031215614f5f57600080fd5b6000614f6d84828501614c0e565b91505092915050565b600060208284031215614f8857600080fd5b6000614f9684828501614c23565b91505092915050565b600080600060808486031215614fb457600080fd5b6000614fc286828701614c0e565b9350506020614fd386828701614948565b9250506040614fe486828701614aed565b9150509250925092565b614ff781615b95565b82525050565b61500681615b95565b82525050565b61501581615ba7565b82525050565b61502481615ba7565b82525050565b61503381615c34565b82525050565b61504281615c34565b82525050565b61505181615c58565b82525050565b61506081615c58565b82525050565b61506f81615c7c565b82525050565b61507e81615c7c565b82525050565b61508d81615ca0565b82525050565b61509c81615ca0565b82525050565b6150ab81615cc4565b82525050565b6150ba81615cc4565b82525050565b6150c981615ce8565b82525050565b6150d881615ce8565b82525050565b60006150e982615aa7565b6150f38185615ab2565b9350615103818560208601615cfa565b61510c81615e17565b840191505092915050565b6000615124601983615ab2565b91507f53746174653a206f6e6c7920636f72652063616e2063616c6c000000000000006000830152602082019050919050565b6000615164601b83615ab2565b91507f536166654d6174683a206164646974696f6e206f766572666c6f7700000000006000830152602082019050919050565b60006151a4601c83615ab2565b91507f4d6174683a20556e73616665206361737420746f2075696e74313238000000006000830152602082019050919050565b60006151e4601b83615ab2565b91507f4d6174683a20556e73616665206361737420746f2075696e74393600000000006000830152602082019050919050565b6000615224601b83615ab2565b91507f4d6174683a20556e73616665206361737420746f2075696e74333200000000006000830152602082019050919050565b6000615264602183615ab2565b91507f536166654d6174683a206d756c7469706c69636174696f6e206f766572666c6f60008301527f77000000000000000000000000000000000000000000000000000000000000006020830152604082019050919050565b6020820160008201516152d36000850182615613565b50505050565b6020820160008201516152ef6000850182615613565b50505050565b60208201600080830154905061530a81615daf565b6153176000860182615613565b5050505050565b6101408201600080830154905061533481615d2d565b615341600086018261502a565b506001830154905061535281615d61565b61535f6020860182615066565b506002830154905061537081615d95565b61537d60408601826150a2565b506003830154905061538e81615d47565b61539b6060860182615048565b50600483016153ad60808601826152f5565b50600583016153bf60a08601826152f5565b50600683016153d160c08601826152f5565b50600783016153e360e08601826152f5565b50600883016153f66101008601826152f5565b506009830154905061540781615d7b565b615415610120860182615084565b5050505050565b606082016000820151615432600085018261564f565b506020820151615445602085018261564f565b5060408201516154586040850182615631565b50505050565b60608201600080830154905061547381615dc9565b615480600086018261564f565b5061548a81615de3565b615497602086018261564f565b506154a181615dfd565b6154ae6040860182615631565b5050505050565b6040820160008201516154cb600085018261500c565b5060208201516154de60208501826155f5565b50505050565b6040820160008201516154fa600085018261500c565b50602082015161550d60208501826155f5565b50505050565b604082016000820151615529600085018261500c565b50602082015161553c60208501826155f5565b50505050565b60e0820160008201516155586000850182614fee565b50602082015161556b60208501826150c0565b50604082015161557e60408501826150c0565b50606082015161559160608501826154e4565b5060808201516155a460a08501826154e4565b50505050565b6020820160008201516155c06000850182615613565b50505050565b6040820160008201516155dc600085018261500c565b5060208201516155ef6020850182615613565b50505050565b6155fe81615bc6565b82525050565b61560d81615bc6565b82525050565b61561c81615c02565b82525050565b61562b81615c02565b82525050565b61563a81615c0c565b82525050565b61564981615c0c565b82525050565b61565881615c1c565b82525050565b61566781615c1c565b82525050565b60006020820190506156826000830184614ffd565b92915050565b600060e08201905061569d6000830188614ffd565b6156aa60208301876150cf565b6156b760408301866150cf565b6156c46060830185615513565b6156d160a0830184615513565b9695505050505050565b60006040820190506156f06000830185614ffd565b6156fd6020830184615622565b9392505050565b60006060820190506157196000830186614ffd565b6157266020830185615622565b6157336040830184615622565b949350505050565b6000602082019050615750600083018461501b565b92915050565b600060208201905061576b6000830184615039565b92915050565b600061014082019050615787600083018d615039565b615794602083018c615075565b6157a1604083018b6150b1565b6157ae606083018a615057565b6157bb60808301896152d9565b6157c860a08301886152d9565b6157d560c08301876152d9565b6157e260e08301866152d9565b6157f06101008301856152d9565b6157fe610120830184615093565b9b9a5050505050505050505050565b6000602082019050818103600083015261582781846150de565b905092915050565b6000602082019050818103600083015261584881615117565b9050919050565b6000602082019050818103600083015261586881615157565b9050919050565b6000602082019050818103600083015261588881615197565b9050919050565b600060208201905081810360008301526158a8816151d7565b9050919050565b600060208201905081810360008301526158c881615217565b9050919050565b600060208201905081810360008301526158e881615257565b9050919050565b600060208201905061590460008301846152bd565b92915050565b600061014082019050615920600083018461531e565b92915050565b600060608201905061593b600083018461541c565b92915050565b6000606082019050615956600083018461545e565b92915050565b600060408201905061597160008301846154b5565b92915050565b600060808201905061598c60008301856154b5565b61599960408301846155c6565b9392505050565b600060e0820190506159b56000830184615542565b92915050565b60006020820190506159d060008301846155aa565b92915050565b60006040820190506159eb6000830185615604565b6159f86020830184615604565b9392505050565b6000602082019050615a146000830184615622565b92915050565b6000604082019050615a2f6000830185615622565b615a3c6020830184615622565b9392505050565b6000606082019050615a58600083018661565e565b615a65602083018561565e565b615a726040830184615640565b949350505050565b6000604051905081810181811067ffffffffffffffff82111715615a9d57600080fd5b8060405250919050565b600081519050919050565b600082825260208201905092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b600063ffffffff82169050919050565b60006bffffffffffffffffffffffff82169050919050565b6000615ba082615be2565b9050919050565b60008115159050919050565b6000819050615bc182615e4f565b919050565b60006fffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b600063ffffffff82169050919050565b60006bffffffffffffffffffffffff82169050919050565b6000615c3f82615c46565b9050919050565b6000615c5182615be2565b9050919050565b6000615c6382615c6a565b9050919050565b6000615c7582615be2565b9050919050565b6000615c8782615c8e565b9050919050565b6000615c9982615be2565b9050919050565b6000615cab82615cb2565b9050919050565b6000615cbd82615be2565b9050919050565b6000615ccf82615cd6565b9050919050565b6000615ce182615be2565b9050919050565b6000615cf382615bb3565b9050919050565b60005b83811015615d18578082015181840152602081019050615cfd565b83811115615d27576000848401525b50505050565b6000615d40615d3b83615e28565b615ac3565b9050919050565b6000615d5a615d5583615e28565b615ae3565b9050919050565b6000615d74615d6f83615e28565b615b03565b9050919050565b6000615d8e615d8983615e28565b615b23565b9050919050565b6000615da8615da383615e28565b615b43565b9050919050565b6000615dc2615dbd83615e28565b615b63565b9050919050565b6000615ddc615dd783615e28565b615b7d565b9050919050565b6000615df6615df183615e42565b615b7d565b9050919050565b6000615e10615e0b83615e35565b615b6d565b9050919050565b6000601f19601f8301169050919050565b60008160001c9050919050565b60008160c01c9050919050565b60008160601c9050919050565b60028110615e5957fe5b50565b615e6581615b95565b8114615e7057600080fd5b50565b615e7c81615ba7565b8114615e8757600080fd5b50565b60028110615e9757600080fd5b50565b60028110615ea757600080fd5b50565b60028110615eb757600080fd5b50565b615ec381615bc6565b8114615ece57600080fd5b50565b615eda81615c02565b8114615ee557600080fd5b50565b615ef181615c0c565b8114615efc57600080fd5b50565b615f0881615c1c565b8114615f1357600080fd5b5056fea365627a7a72315820696c7604f1971991e687478220b21ab2551b9a8b52f5b16af4c577e9c1cb4f196c6578706572696d656e74616cf564736f6c63430005100040";
}
