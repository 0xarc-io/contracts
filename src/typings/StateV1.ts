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

    setSupplyBalance: TypedFunctionDescription<{
      encode([owner, newPar]: [
        string,
        { sign: boolean; value: BigNumberish }
      ]): string;
    }>;

    setSyntheticRatio: TypedFunctionDescription<{
      encode([ratio]: [{ value: BigNumberish }]): string;
    }>;

    supplyBalances: TypedFunctionDescription<{ encode([]: [string]): string }>;

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
  events: {};
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
    3: { value: BigNumber };
    4: { value: BigNumber };
    5: { value: BigNumber };
    6: { value: BigNumber };
    7: { value: BigNumber };
    8: string;
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
  setSupplyBalance(
    owner: string,
    newPar: { sign: boolean; value: BigNumberish },
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  setSyntheticRatio(
    ratio: { value: BigNumberish },
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  supplyBalances(
    arg0: string
  ): Promise<{
    sign: boolean;
    value: BigNumber;
    0: boolean;
    1: BigNumber;
  }>;
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
    setSupplyBalance(
      owner: string,
      newPar: { sign: boolean; value: BigNumberish }
    ): Promise<BigNumber>;
    setSyntheticRatio(ratio: { value: BigNumberish }): Promise<BigNumber>;
    supplyBalances(arg0: string): Promise<BigNumber>;
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
    '[{"inputs":[{"internalType":"address","name":"_core","type":"address"},{"internalType":"address","name":"_admin","type":"address"},{"components":[{"internalType":"contract IERC20","name":"stableAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"internalType":"contract IInterestSetter","name":"interestSetter","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"earningsRate","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"internalType":"struct Types.GlobalParams","name":"_globalParams","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"parSupply","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"parBorrow","type":"tuple"},{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"borrowIndex","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateCollateralDelta","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateInverseAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateInverseRequired","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"calculateLiquidationPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"index","type":"tuple"}],"name":"fetchInterestRate","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Interest.Rate","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"index","type":"tuple"}],"name":"fetchNewIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"getAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"getBorrowIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getCurrentPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"currentPar","type":"tuple"},{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"index","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"enum Types.AssetDenomination","name":"denomination","type":"uint8"},{"internalType":"enum Types.AssetReference","name":"ref","type":"uint8"},{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Types.AssetAmount","name":"amount","type":"tuple"}],"name":"getNewParAndDeltaWei","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Types.Wei","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getPosition","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getStableAsset","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"getSupplyBalance","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getSyntheticAsset","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getTotalPar","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"globalIndex","outputs":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"position","type":"tuple"}],"name":"isCollateralized","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"params","outputs":[{"internalType":"contract IERC20","name":"stableAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"internalType":"contract IInterestSetter","name":"interestSetter","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"earningsRate","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"positionCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"positions","outputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"removeExcessTokens","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"position","type":"tuple"}],"name":"savePosition","outputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"amount","type":"tuple"}],"name":"setAmount","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"ratio","type":"tuple"}],"name":"setCollateralRatio","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"rate","type":"tuple"}],"name":"setEarningsRate","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_setter","type":"address"}],"name":"setInterestSetter","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"spread","type":"tuple"}],"name":"setLiquidationSpread","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_oracle","type":"address"}],"name":"setOracle","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"fee","type":"tuple"}],"name":"setOriginationFee","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"newPar","type":"tuple"}],"name":"setSupplyBalance","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"ratio","type":"tuple"}],"name":"setSyntheticRatio","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"supplyBalances","outputs":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalPar","outputs":[{"internalType":"uint128","name":"borrow","type":"uint128"},{"internalType":"uint128","name":"supply","type":"uint128"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"updateIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"amount","type":"tuple"}],"name":"updatePositionAmount","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"existingPar","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"newPar","type":"tuple"}],"name":"updateTotalPar","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
  public static Bytecode =
    "0x60806040523480156200001157600080fd5b5060405162005e6038038062005e608339818101604052620000379190810190620005f2565b826000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555081600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555080600260008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160010160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060408201518160020160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060608201518160030160008201518160000155505060808201518160040160008201518160000155505060a08201518160050160008201518160000155505060c08201518160060160008201518160000155505060e0820151816007016000820151816000015550506101008201518160080160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555090505062000259620002fc60201b62003e981760201c565b600c60008201518160000160006101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff160217905550602082015181600001600c6101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff16021790555060408201518160000160186101000a81548163ffffffff021916908363ffffffff16021790555090505050505062000816565b62000306620003f7565b6040518060600160405280670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001620003726200038060201b62003bbe1760201c565b63ffffffff16815250905090565b600062000398426200039d60201b620041221760201c565b905090565b600080829050828163ffffffff1614620003ee576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401620003e5906200068b565b60405180910390fd5b80915050919050565b604051806060016040528060006bffffffffffffffffffffffff16815260200160006bffffffffffffffffffffffff168152602001600063ffffffff1681525090565b6000815190506200044b816200077a565b92915050565b600081519050620004628162000794565b92915050565b6000815190506200047981620007ae565b92915050565b6000815190506200049081620007c8565b92915050565b600081519050620004a781620007e2565b92915050565b600060208284031215620004c057600080fd5b620004cc6020620006ad565b90506000620004de84828501620005db565b60008301525092915050565b60006101208284031215620004fe57600080fd5b6200050b610120620006ad565b905060006200051d8482850162000451565b6000830152506020620005338482850162000496565b6020830152506040620005498482850162000468565b60408301525060606200055f84828501620004ad565b60608301525060806200057584828501620004ad565b60808301525060a06200058b84828501620004ad565b60a08301525060c0620005a184828501620004ad565b60c08301525060e0620005b784828501620004ad565b60e083015250610100620005ce848285016200047f565b6101008301525092915050565b600081519050620005ec81620007fc565b92915050565b600080600061016084860312156200060957600080fd5b600062000619868287016200043a565b93505060206200062c868287016200043a565b92505060406200063f86828701620004ea565b9150509250925092565b600062000658601b83620006db565b91507f4d6174683a20556e73616665206361737420746f2075696e74333200000000006000830152602082019050919050565b60006020820190508181036000830152620006a68162000649565b9050919050565b6000604051905081810181811067ffffffffffffffff82111715620006d157600080fd5b8060405250919050565b600082825260208201905092915050565b6000620006f98262000750565b9050919050565b60006200070d82620006ec565b9050919050565b60006200072182620006ec565b9050919050565b60006200073582620006ec565b9050919050565b60006200074982620006ec565b9050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b6200078581620006ec565b81146200079157600080fd5b50565b6200079f8162000700565b8114620007ab57600080fd5b50565b620007b98162000714565b8114620007c557600080fd5b50565b620007d38162000728565b8114620007df57600080fd5b50565b620007ed816200073c565b8114620007f957600080fd5b50565b620008078162000770565b81146200081357600080fd5b50565b61563a80620008266000396000f3fe608060405234801561001057600080fd5b50600436106102275760003560e01c80638a627d0d11610130578063d890a870116100b8578063e7a45f2e1161007c578063e7a45f2e146106e6578063eb02c30114610704578063eb91d37e14610734578063ef9d392614610752578063f38e266a1461078257610227565b8063d890a87014610640578063e043095a14610660578063e2e02e0c1461067c578063e63f2d9d146106ac578063e7702d05146106c857610227565b8063b44c061f116100ff578063b44c061f1461057d578063b9f412b01461059c578063bcaa0c55146105ba578063bf0b4927146105ea578063cff0ab961461061a57610227565b80638a627d0d146104cd57806396d7d7e1146104fd5780639997640d1461052d57806399fbab881461054957610227565b806356cffd13116101b3578063740e67ef11610182578063740e67ef14610426578063743bd7c9146104445780637adbf973146104635780637c7c200a1461047f57806381045ead146104af57610227565b806356cffd13146103a2578063599b81e7146103be578063651fafe1146103ee5780636e830f4a1461040a57610227565b806320d6b011116101fa57806320d6b011146102d95780632626ab081461030a5780632863612b1461032657806340052049146103565780634c2fbfc61461038657610227565b80630625dce11461022c5780630e884c12146102485780631896174e146102795780631e31274a146102a9575b600080fd5b610246600480360361024191908101906148d1565b6107b2565b005b610262600480360361025d919081019061494c565b610858565b60405161027092919061525f565b60405180910390f35b610293600480360361028e91908101906149d8565b610a15565b6040516102a091906152e7565b60405180910390f35b6102c360048036036102be91908101906149d8565b610c48565b6040516102d09190615040565b60405180910390f35b6102f360048036036102ee9190810190614752565b610d60565b60405161030192919061505b565b60405180910390f35b610324600480360361031f91908101906148d1565b610dad565b005b610340600480360361033b91908101906147e0565b610e53565b60405161034d919061520e565b60405180910390f35b610370600480360361036b9190810190614a7c565b610fa0565b60405161037d9190615288565b60405180910390f35b6103a0600480360361039b91908101906148d1565b611309565b005b6103bc60048036036103b7919081019061499c565b6113af565b005b6103d860048036036103d39190810190614923565b6116f3565b6040516103e591906152a3565b60405180910390f35b610408600480360361040391908101906148d1565b6118ac565b005b610424600480360361041f91908101906148d1565b611952565b005b61042e6119f8565b60405161043b9190615084565b60405180910390f35b61044c611a25565b60405161045a9291906152be565b60405180910390f35b61047d60048036036104789190810190614752565b611a6f565b005b61049960048036036104949190810190614882565b611b46565b6040516104a691906152e7565b60405180910390f35b6104b7611bb0565b6040516104c49190615229565b60405180910390f35b6104e760048036036104e29190810190614923565b611c6c565b6040516104f49190615229565b60405180910390f35b61051760048036036105129190810190614882565b611d54565b6040516105249190615244565b60405180910390f35b61054760048036036105429190810190614752565b611e35565b005b610563600480360361055e9190810190614a2a565b611f0b565b604051610574959493929190614f8d565b60405180910390f35b610585612059565b604051610593929190615302565b60405180910390f35b6105a46120d2565b6040516105b19190615229565b60405180910390f35b6105d460048036036105cf91908101906147e0565b6123c3565b6040516105e19190614f72565b60405180910390f35b61060460048036036105ff9190810190614809565b61243b565b6040516106119190615244565b60405180910390f35b6106226124f1565b6040516106379998979695949392919061509f565b60405180910390f35b610648612611565b6040516106579392919061532b565b60405180910390f35b61067a60048036036106759190810190614752565b612669565b005b61069660048036036106919190810190614a7c565b6127c6565b6040516106a39190615288565b60405180910390f35b6106c660048036036106c1919081019061477b565b612c39565b005b6106d0612d6e565b6040516106dd91906152e7565b60405180910390f35b6106ee612d74565b6040516106fb9190615084565b60405180910390f35b61071e60048036036107199190810190614a2a565b612da1565b60405161072b9190615288565b60405180910390f35b61073c612f70565b604051610749919061520e565b60405180910390f35b61076c600480360361076791908101906147e0565b613020565b6040516107799190615229565b60405180910390f35b61079c60048036036107979190810190614752565b61310d565b6040516107a99190615244565b60405180910390f35b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610842576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016108399061514e565b60405180910390fd5b8060026007016000820151816000015590505050565b610860614287565b6108686142b5565b6000836060015114801561089657506000600181111561088457fe5b8360400151600181111561089457fe5b145b156108ad57846108a46131cb565b91509150610a0d565b6108b56142b5565b6108bf86866131f1565b90506108c9614287565b6108d16142b5565b600060018111156108de57fe5b866020015160018111156108ee57fe5b14156109705760405180604001604052808760000151151581526020018760600151815250905060018081111561092157fe5b8660400151600181111561093157fe5b141561094d5761094a83826132d090919063ffffffff16565b90505b61096961096382856132f290919063ffffffff16565b886133c8565b9150610a03565b604051806040016040528087600001511515815260200161099488606001516134c6565b6fffffffffffffffffffffffffffffffff168152509150600060018111156109b857fe5b866040015160018111156109c857fe5b14156109e4576109e1828961352990919063ffffffff16565b91505b610a00836109f2848a6131f1565b6132d090919063ffffffff16565b90505b8181945094505050505b935093915050565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610aa6576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610a9d9061514e565b60405180910390fd5b600d54905081600e6000600d54815260200190815260200160002060008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160000160146101000a81548160ff02191690836001811115610b2c57fe5b021790555060408201518160000160156101000a81548160ff02191690836001811115610b5557fe5b021790555060608201518160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550505060808201518160020160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055505050905050600d60008154809291906001019190505550919050565b6000808260800151602001516fffffffffffffffffffffffffffffffff161415610c755760019050610d5b565b610c7d6142d1565b600260080160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b158015610ce857600080fd5b505afa158015610cfc573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250610d2091908101906148fa565b9050610d2a614287565b610d4f846040015185606001518660800151610d498860400151613020565b8661243b565b90508060000151925050505b919050565b600f6020528060005260406000206000915090508060000160009054906101000a900460ff16908060000160019054906101000a90046fffffffffffffffffffffffffffffffff16905082565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610e3d576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610e349061514e565b60405180910390fd5b8060026003016000820151816000015590505050565b610e5b6142d1565b610e636142d1565b610e6b6142d1565b600260080160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b158015610ed657600080fd5b505afa158015610eea573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250610f0e91908101906148fa565b905060006001811115610f1d57fe5b846001811115610f2957fe5b1415610f4f57610f48610f3a613719565b60026005016000015461373d565b9150610f8a565b600180811115610f5b57fe5b846001811115610f6757fe5b1415610f8957610f86610f78613719565b600260050160000154613772565b91505b5b610f9481836137a7565b91508192505050919050565b610fa86142e4565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611037576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161102e9061514e565b60405180910390fd5b6000600e6000868152602001908152602001600020905083600181111561105a57fe5b8160000160149054906101000a900460ff16600181111561107757fe5b14156110e957828160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550905050611151565b828160020160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055509050505b806040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff1660018111156111d157fe5b60018111156111dc57fe5b81526020016000820160159054906101000a900460ff1660018111156111fe57fe5b600181111561120957fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509150509392505050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611399576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016113909061514e565b60405180910390fd5b8060026006016000820151816000015590505050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461143e576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016114359061514e565b60405180910390fd5b61144882826137e0565b15611452576116ef565b816000015115611500576114c06114bb83602001516fffffffffffffffffffffffffffffffff16600b60000160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1661385f90919063ffffffff16565b6134c6565b600b60000160106101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055506115a0565b61156461155f83602001516fffffffffffffffffffffffffffffffff16600b60000160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1661385f90919063ffffffff16565b6134c6565b600b60000160006101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055505b80600001511561164e5761160e61160982602001516fffffffffffffffffffffffffffffffff16600b60000160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166138a990919063ffffffff16565b6134c6565b600b60000160106101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055506116ee565b6116b26116ad82602001516fffffffffffffffffffffffffffffffff16600b60000160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166138a990919063ffffffff16565b6134c6565b600b60000160006101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055505b5b5050565b6116fb61434b565b6117036142b5565b61170b6142b5565b6117b5600b6040518060400160405290816000820160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681526020016000820160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050856138fe565b915091506117c161434b565b6002800160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663e8177dcf600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16846020015186602001516040518463ffffffff1660e01b815260040161184f93929190615009565b60206040518083038186803b15801561186757600080fd5b505afa15801561187b573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525061189f9190810190614a01565b9050809350505050919050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461193c576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016119339061514e565b60405180910390fd5b8060026005016000820151816000015590505050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146119e2576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016119d99061514e565b60405180910390fd5b8060026004016000820151816000015590505050565b6000600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b600b8060000160009054906101000a90046fffffffffffffffffffffffffffffffff16908060000160109054906101000a90046fffffffffffffffffffffffffffffffff16905082565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611aff576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611af69061514e565b60405180910390fd5b80600260080160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b60008060006001811115611b5657fe5b856001811115611b6257fe5b1415611b7957611b7284846139b7565b9050611ba5565b600180811115611b8557fe5b856001811115611b9157fe5b1415611ba457611ba184846139d8565b90505b5b809150509392505050565b611bb861435e565b600c6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff1681525050905090565b611c7461435e565b611c7c61434b565b611c85836116f3565b9050611d4c8382600b6040518060400160405290816000820160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681526020016000820160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505060026007016040518060200160405290816000820154815250506139f9565b915050919050565b611d5c614287565b6000611d69858585611b46565b905060006001811115611d7857fe5b856001811115611d8457fe5b1415611db457611dad8160026004016040518060200160405290816000820154815250506139d8565b9050611df9565b600180811115611dc057fe5b856001811115611dcc57fe5b1415611df857611df58160026003016040518060200160405290816000820154815250506139d8565b90505b5b6040518060400160405280600115158152602001611e16836134c6565b6fffffffffffffffffffffffffffffffff168152509150509392505050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611ec5576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611ebc9061514e565b60405180910390fd5b806002800160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b600e6020528060005260406000206000915090508060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060000160149054906101000a900460ff16908060000160159054906101000a900460ff1690806001016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505090806002016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050905085565b600080600b60000160109054906101000a90046fffffffffffffffffffffffffffffffff16600b60000160009054906101000a90046fffffffffffffffffffffffffffffffff16816fffffffffffffffffffffffffffffffff169150806fffffffffffffffffffffffffffffffff169050915091509091565b6120da61435e565b6120e2613bbe565b63ffffffff16600c60000160189054906101000a900463ffffffff1663ffffffff1614156121c057600c6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff168152505090506123c0565b612277600c6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff1681525050611c6c565b600c60008201518160000160006101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff160217905550602082015181600001600c6101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff16021790555060408201518160000160186101000a81548163ffffffff021916908363ffffffff16021790555090506040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff168152505090505b90565b60008060018111156123d157fe5b8260018111156123dd57fe5b1461240d57600260010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16612434565b600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff165b9050919050565b612443614287565b61244b614287565b612453614287565b61245b6142b5565b6124658787613bce565b90506000600181111561247457fe5b89600181111561248057fe5b141561249c5761249589826020015187611d54565b91506124cd565b6001808111156124a857fe5b8960018111156124b457fe5b14156124cc576124c989826020015187611d54565b91505b5b6124e08289613c0690919063ffffffff16565b925082935050505095945050505050565b60028060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060020160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690806003016040518060200160405290816000820154815250509080600401604051806020016040529081600082015481525050908060050160405180602001604052908160008201548152505090806006016040518060200160405290816000820154815250509080600701604051806020016040529081600082015481525050908060080160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905089565b600c8060000160009054906101000a90046bffffffffffffffffffffffff169080600001600c9054906101000a90046bffffffffffffffffffffffff16908060000160189054906101000a900463ffffffff16905083565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146126f9576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016126f09061514e565b60405180910390fd5b6127016142b5565b612709613c28565b9050600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663a9059cbb8383602001516040518363ffffffff1660e01b815260040161276f929190614fe0565b602060405180830381600087803b15801561278957600080fd5b505af115801561279d573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506127c191908101906147b7565b505050565b6127ce6142e4565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461285d576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016128549061514e565b60405180910390fd5b6000600e6000868152602001908152602001600020905083600181111561288057fe5b8160000160149054906101000a900460ff16600181111561289d57fe5b14156129945761292983826001016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505061352990919063ffffffff16565b8160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550905050612a81565b612a1a83826002016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505061352990919063ffffffff16565b8160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055509050505b806040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff166001811115612b0157fe5b6001811115612b0c57fe5b81526020016000820160159054906101000a900460ff166001811115612b2e57fe5b6001811115612b3957fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509150509392505050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614612cc8576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401612cbf9061514e565b60405180910390fd5b80600f60008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055509050505050565b600d5481565b6000600260010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b612da96142e4565b600e60008381526020019081526020016000206040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff166001811115612e3b57fe5b6001811115612e4657fe5b81526020016000820160159054906101000a900460ff166001811115612e6857fe5b6001811115612e7357fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509050919050565b612f786142d1565b600260080160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b158015612fe357600080fd5b505afa158015612ff7573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525061301b91908101906148fa565b905090565b61302861435e565b6000600181111561303557fe5b82600181111561304157fe5b14156130fd57600c6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff16815250509050613108565b613105613e98565b90505b919050565b613115614287565b600f60008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250509050919050565b6131d36142b5565b60405180604001604052806000151581526020016000815250905090565b6131f96142b5565b600083602001516fffffffffffffffffffffffffffffffff16905083600001511561327657604051806040016040528060011515815260200161326b85602001516bffffffffffffffffffffffff16670de0b6b3a764000067ffffffffffffffff1685613f0d9092919063ffffffff16565b8152509150506132ca565b60405180604001604052806000151581526020016132c385600001516bffffffffffffffffffffffff16670de0b6b3a764000067ffffffffffffffff1685613f3d9092919063ffffffff16565b8152509150505b92915050565b6132d86142b5565b6132ea836132e584613fb9565b6132f2565b905092915050565b6132fa6142b5565b6133026142b5565b8260000151151584600001511515141561334a57836000015181600001901515908115158152505061333c846020015184602001516138a9565b8160200181815250506133be565b826020015184602001511061338d57836000015181600001901515908115158152505061337f8460200151846020015161385f565b8160200181815250506133bd565b82600001518160000190151590811515815250506133b38360200151856020015161385f565b8160200181815250505b5b8091505092915050565b6133d0614287565b82600001511561344f57604051806040016040528060011515815260200161343361342e670de0b6b3a764000067ffffffffffffffff1686602001516bffffffffffffffffffffffff168860200151613f0d9092919063ffffffff16565b6134c6565b6fffffffffffffffffffffffffffffffff1681525090506134c0565b60405180604001604052806000151581526020016134a86134a3670de0b6b3a764000067ffffffffffffffff1686600001516bffffffffffffffffffffffff168860200151613f3d9092919063ffffffff16565b6134c6565b6fffffffffffffffffffffffffffffffff1681525090505b92915050565b60008082905082816fffffffffffffffffffffffffffffffff1614613520576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016135179061518e565b60405180910390fd5b80915050919050565b613531614287565b613539614287565b826000015115158460000151151514156135d357836000015181600001901515908115158152505061359f61359a85602001516fffffffffffffffffffffffffffffffff1685602001516fffffffffffffffffffffffffffffffff166138a9565b6134c6565b81602001906fffffffffffffffffffffffffffffffff1690816fffffffffffffffffffffffffffffffff168152505061370f565b82602001516fffffffffffffffffffffffffffffffff1684602001516fffffffffffffffffffffffffffffffff161061368c57836000015181600001901515908115158152505061365861365385602001516fffffffffffffffffffffffffffffffff1685602001516fffffffffffffffffffffffffffffffff1661385f565b6134c6565b81602001906fffffffffffffffffffffffffffffffff1690816fffffffffffffffffffffffffffffffff168152505061370e565b82600001518160000190151590811515815250506136de6136d984602001516fffffffffffffffffffffffffffffffff1686602001516fffffffffffffffffffffffffffffffff1661385f565b6134c6565b81602001906fffffffffffffffffffffffffffffffff1690816fffffffffffffffffffffffffffffffff16815250505b5b8091505092915050565b6137216142d1565b6040518060200160405280670de0b6b3a7640000815250905090565b6137456142d1565b60405180602001604052806137678486600001516138a990919063ffffffff16565b815250905092915050565b61377a6142d1565b604051806020016040528061379c84866000015161385f90919063ffffffff16565b815250905092915050565b6137af6142d1565b60405180602001604052806137d585600001518560000151670de0b6b3a7640000613f0d565b815250905092915050565b600081602001516fffffffffffffffffffffffffffffffff1683602001516fffffffffffffffffffffffffffffffff16141561385457600083602001516fffffffffffffffffffffffffffffffff16141561383e5760019050613859565b8160000151151583600001511515149050613859565b600090505b92915050565b60006138a183836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f770000815250613fe8565b905092915050565b6000808284019050838110156138f4576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016138eb9061516e565b60405180910390fd5b8091505092915050565b6139066142b5565b61390e6142b5565b613916614287565b604051806040016040528060011515815260200186602001516fffffffffffffffffffffffffffffffff16815250905061394e614287565b604051806040016040528060001515815260200187600001516fffffffffffffffffffffffffffffffff1681525090506139866142b5565b61399083876131f1565b905061399a6142b5565b6139a483886131f1565b9050818195509550505050509250929050565b60006139d083670de0b6b3a76400008460000151613f0d565b905092915050565b60006139f1838360000151670de0b6b3a7640000613f0d565b905092915050565b613a0161435e565b613a096142b5565b613a116142b5565b613a1b85886138fe565b915091506000613a29613bbe565b90506000613a66613a538a6040015163ffffffff168463ffffffff1661385f90919063ffffffff16565b896000015161404390919063ffffffff16565b90506000613a73856140b3565b15613a815760009050613ab4565b613a8b82886139d8565b9050846020015184602001511015613ab357613ab08185602001518760200151613f0d565b90505b5b81811115613abe57fe5b6040518060600160405280613b24613b1f8d600001516bffffffffffffffffffffffff16613b118f600001516bffffffffffffffffffffffff1688670de0b6b3a764000067ffffffffffffffff16613f0d565b6138a990919063ffffffff16565b6140c3565b6bffffffffffffffffffffffff168152602001613b92613b8d8d602001516bffffffffffffffffffffffff16613b7f8f602001516bffffffffffffffffffffffff1687670de0b6b3a764000067ffffffffffffffff16613f0d565b6138a990919063ffffffff16565b6140c3565b6bffffffffffffffffffffffff1681526020018463ffffffff1681525095505050505050949350505050565b6000613bc942614122565b905090565b613bd66142b5565b613bdf83614179565b15613bf357613bec6131cb565b9050613c00565b613bfd83836131f1565b90505b92915050565b613c0e614287565b613c2083613c1b8461419b565b613529565b905092915050565b613c306142b5565b613c386142b5565b6040518060400160405280600115158152602001600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401613caa9190614f72565b60206040518083038186803b158015613cc257600080fd5b505afa158015613cd6573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250613cfa9190810190614a53565b8152509050613d076142b5565b613d0f6142b5565b613e67600b6040518060400160405290816000820160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681526020016000820160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050600c6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff16815250506138fe565b91509150613e9082613e8283866132d090919063ffffffff16565b6132d090919063ffffffff16565b935050505090565b613ea061435e565b6040518060600160405280670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001613eff613bbe565b63ffffffff16815250905090565b6000613f3482613f26858761404390919063ffffffff16565b6141dc90919063ffffffff16565b90509392505050565b600080841480613f4d5750600083145b15613f6457613f5d6000836141dc565b9050613fb2565b613faf6001613fa184613f936001613f85898b61404390919063ffffffff16565b61385f90919063ffffffff16565b6141dc90919063ffffffff16565b6138a990919063ffffffff16565b90505b9392505050565b613fc16142b5565b60405180604001604052808360000151151515815260200183602001518152509050919050565b6000838311158290614030576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401614027919061512c565b60405180910390fd5b5060008385039050809150509392505050565b60008083141561405657600090506140ad565b600082840290508284828161406757fe5b04146140a8576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161409f906151ee565b60405180910390fd5b809150505b92915050565b6000808260200151149050919050565b60008082905082816bffffffffffffffffffffffff1614614119576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401614110906151ae565b60405180910390fd5b80915050919050565b600080829050828163ffffffff1614614170576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401614167906151ce565b60405180910390fd5b80915050919050565b60008082602001516fffffffffffffffffffffffffffffffff16149050919050565b6141a3614287565b60405180604001604052808360000151151515815260200183602001516fffffffffffffffffffffffffffffffff168152509050919050565b600061421e83836040518060400160405280601a81526020017f536166654d6174683a206469766973696f6e206279207a65726f000000000000815250614226565b905092915050565b6000808311829061426d576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401614264919061512c565b60405180910390fd5b50600083858161427957fe5b049050809150509392505050565b604051806040016040528060001515815260200160006fffffffffffffffffffffffffffffffff1681525090565b6040518060400160405280600015158152602001600081525090565b6040518060200160405280600081525090565b6040518060a00160405280600073ffffffffffffffffffffffffffffffffffffffff1681526020016000600181111561431957fe5b81526020016000600181111561432b57fe5b81526020016143386143a1565b81526020016143456143a1565b81525090565b6040518060200160405280600081525090565b604051806060016040528060006bffffffffffffffffffffffff16815260200160006bffffffffffffffffffffffff168152602001600063ffffffff1681525090565b604051806040016040528060001515815260200160006fffffffffffffffffffffffffffffffff1681525090565b6000813590506143de8161553d565b92915050565b6000813590506143f381615554565b92915050565b60008151905061440881615554565b92915050565b60008135905061441d8161556b565b92915050565b6000813590506144328161557b565b92915050565b6000813590506144478161558b565b92915050565b60006080828403121561445f57600080fd5b6144696080615362565b90506000614479848285016143e4565b600083015250602061448d8482850161440e565b60208301525060406144a184828501614423565b60408301525060606144b5848285016146fe565b60608301525092915050565b6000602082840312156144d357600080fd5b6144dd6020615362565b905060006144ed848285016146fe565b60008301525092915050565b60006020828403121561450b57600080fd5b6145156020615362565b9050600061452584828501614713565b60008301525092915050565b60006060828403121561454357600080fd5b61454d6060615362565b9050600061455d8482850161473d565b60008301525060206145718482850161473d565b602083015250604061458584828501614728565b60408301525092915050565b6000604082840312156145a357600080fd5b6145ad6040615362565b905060006145bd848285016143e4565b60008301525060206145d1848285016146e9565b60208301525092915050565b6000604082840312156145ef57600080fd5b6145f96040615362565b90506000614609848285016143e4565b600083015250602061461d848285016146e9565b60208301525092915050565b600060e0828403121561463b57600080fd5b61464560a0615362565b90506000614655848285016143cf565b600083015250602061466984828501614438565b602083015250604061467d84828501614438565b604083015250606061469184828501614591565b60608301525060a06146a584828501614591565b60808301525092915050565b6000602082840312156146c357600080fd5b6146cd6020615362565b905060006146dd84828501614713565b60008301525092915050565b6000813590506146f88161559b565b92915050565b60008135905061470d816155b2565b92915050565b600081519050614722816155b2565b92915050565b600081359050614737816155c9565b92915050565b60008135905061474c816155e0565b92915050565b60006020828403121561476457600080fd5b6000614772848285016143cf565b91505092915050565b6000806060838503121561478e57600080fd5b600061479c858286016143cf565b92505060206147ad858286016145dd565b9150509250929050565b6000602082840312156147c957600080fd5b60006147d7848285016143f9565b91505092915050565b6000602082840312156147f257600080fd5b600061480084828501614438565b91505092915050565b6000806000806000610120868803121561482257600080fd5b600061483088828901614438565b9550506020614841888289016145dd565b9450506060614852888289016145dd565b93505060a061486388828901614531565b925050610100614875888289016144c1565b9150509295509295909350565b60008060006060848603121561489757600080fd5b60006148a586828701614438565b93505060206148b6868287016146fe565b92505060406148c7868287016144c1565b9150509250925092565b6000602082840312156148e357600080fd5b60006148f1848285016144c1565b91505092915050565b60006020828403121561490c57600080fd5b600061491a848285016144f9565b91505092915050565b60006060828403121561493557600080fd5b600061494384828501614531565b91505092915050565b6000806000610120848603121561496257600080fd5b6000614970868287016145dd565b935050604061498186828701614531565b92505060a06149928682870161444d565b9150509250925092565b600080608083850312156149af57600080fd5b60006149bd858286016145dd565b92505060406149ce858286016145dd565b9150509250929050565b600060e082840312156149ea57600080fd5b60006149f884828501614629565b91505092915050565b600060208284031215614a1357600080fd5b6000614a21848285016146b1565b91505092915050565b600060208284031215614a3c57600080fd5b6000614a4a848285016146fe565b91505092915050565b600060208284031215614a6557600080fd5b6000614a7384828501614713565b91505092915050565b600080600060808486031215614a9157600080fd5b6000614a9f868287016146fe565b9350506020614ab086828701614438565b9250506040614ac1868287016145dd565b9150509250925092565b614ad4816153ab565b82525050565b614ae3816153ab565b82525050565b614af2816153bd565b82525050565b614b01816153bd565b82525050565b614b108161544a565b82525050565b614b1f8161546e565b82525050565b614b2e81615492565b82525050565b614b3d816154b6565b82525050565b614b4c816154da565b82525050565b614b5b816154da565b82525050565b6000614b6c8261538f565b614b76818561539a565b9350614b868185602086016154ec565b614b8f8161551f565b840191505092915050565b6000614ba760198361539a565b91507f53746174653a206f6e6c7920636f72652063616e2063616c6c000000000000006000830152602082019050919050565b6000614be7601b8361539a565b91507f536166654d6174683a206164646974696f6e206f766572666c6f7700000000006000830152602082019050919050565b6000614c27601c8361539a565b91507f4d6174683a20556e73616665206361737420746f2075696e74313238000000006000830152602082019050919050565b6000614c67601b8361539a565b91507f4d6174683a20556e73616665206361737420746f2075696e74393600000000006000830152602082019050919050565b6000614ca7601b8361539a565b91507f4d6174683a20556e73616665206361737420746f2075696e74333200000000006000830152602082019050919050565b6000614ce760218361539a565b91507f536166654d6174683a206d756c7469706c69636174696f6e206f766572666c6f60008301527f77000000000000000000000000000000000000000000000000000000000000006020830152604082019050919050565b602082016000820151614d566000850182614f18565b50505050565b602082016000820151614d726000850182614f18565b50505050565b606082016000820151614d8e6000850182614f54565b506020820151614da16020850182614f54565b506040820151614db46040850182614f36565b50505050565b604082016000820151614dd06000850182614ae9565b506020820151614de36020850182614efa565b50505050565b604082016000820151614dff6000850182614ae9565b506020820151614e126020850182614efa565b50505050565b604082016000820151614e2e6000850182614ae9565b506020820151614e416020850182614efa565b50505050565b60e082016000820151614e5d6000850182614acb565b506020820151614e706020850182614b43565b506040820151614e836040850182614b43565b506060820151614e966060850182614de9565b506080820151614ea960a0850182614de9565b50505050565b602082016000820151614ec56000850182614f18565b50505050565b604082016000820151614ee16000850182614ae9565b506020820151614ef46020850182614f18565b50505050565b614f03816153dc565b82525050565b614f12816153dc565b82525050565b614f2181615418565b82525050565b614f3081615418565b82525050565b614f3f81615422565b82525050565b614f4e81615422565b82525050565b614f5d81615432565b82525050565b614f6c81615432565b82525050565b6000602082019050614f876000830184614ada565b92915050565b600060e082019050614fa26000830188614ada565b614faf6020830187614b52565b614fbc6040830186614b52565b614fc96060830185614e18565b614fd660a0830184614e18565b9695505050505050565b6000604082019050614ff56000830185614ada565b6150026020830184614f27565b9392505050565b600060608201905061501e6000830186614ada565b61502b6020830185614f27565b6150386040830184614f27565b949350505050565b60006020820190506150556000830184614af8565b92915050565b60006040820190506150706000830185614af8565b61507d6020830184614f09565b9392505050565b60006020820190506150996000830184614b07565b92915050565b6000610120820190506150b5600083018c614b07565b6150c2602083018b614b34565b6150cf604083018a614b16565b6150dc6060830189614d5c565b6150e96080830188614d5c565b6150f660a0830187614d5c565b61510360c0830186614d5c565b61511060e0830185614d5c565b61511e610100830184614b25565b9a9950505050505050505050565b600060208201905081810360008301526151468184614b61565b905092915050565b6000602082019050818103600083015261516781614b9a565b9050919050565b6000602082019050818103600083015261518781614bda565b9050919050565b600060208201905081810360008301526151a781614c1a565b9050919050565b600060208201905081810360008301526151c781614c5a565b9050919050565b600060208201905081810360008301526151e781614c9a565b9050919050565b6000602082019050818103600083015261520781614cda565b9050919050565b60006020820190506152236000830184614d40565b92915050565b600060608201905061523e6000830184614d78565b92915050565b60006040820190506152596000830184614dba565b92915050565b60006080820190506152746000830185614dba565b6152816040830184614ecb565b9392505050565b600060e08201905061529d6000830184614e47565b92915050565b60006020820190506152b86000830184614eaf565b92915050565b60006040820190506152d36000830185614f09565b6152e06020830184614f09565b9392505050565b60006020820190506152fc6000830184614f27565b92915050565b60006040820190506153176000830185614f27565b6153246020830184614f27565b9392505050565b60006060820190506153406000830186614f63565b61534d6020830185614f63565b61535a6040830184614f45565b949350505050565b6000604051905081810181811067ffffffffffffffff8211171561538557600080fd5b8060405250919050565b600081519050919050565b600082825260208201905092915050565b60006153b6826153f8565b9050919050565b60008115159050919050565b60008190506153d782615530565b919050565b60006fffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b600063ffffffff82169050919050565b60006bffffffffffffffffffffffff82169050919050565b60006154558261545c565b9050919050565b6000615467826153f8565b9050919050565b600061547982615480565b9050919050565b600061548b826153f8565b9050919050565b600061549d826154a4565b9050919050565b60006154af826153f8565b9050919050565b60006154c1826154c8565b9050919050565b60006154d3826153f8565b9050919050565b60006154e5826153c9565b9050919050565b60005b8381101561550a5780820151818401526020810190506154ef565b83811115615519576000848401525b50505050565b6000601f19601f8301169050919050565b6002811061553a57fe5b50565b615546816153ab565b811461555157600080fd5b50565b61555d816153bd565b811461556857600080fd5b50565b6002811061557857600080fd5b50565b6002811061558857600080fd5b50565b6002811061559857600080fd5b50565b6155a4816153dc565b81146155af57600080fd5b50565b6155bb81615418565b81146155c657600080fd5b50565b6155d281615422565b81146155dd57600080fd5b50565b6155e981615432565b81146155f457600080fd5b5056fea365627a7a723158203ad47256e91dd0ab78c4ea4b58f203e6e2799249958972c1343816b542f297556c6578706572696d656e74616cf564736f6c63430005100040";
}
