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

    getCollateralizationRatio: TypedFunctionDescription<{
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
  getBorrowWei(positionId: BigNumberish): Promise<BigNumber>;
  getCollateralizationRatio(
    positionId: BigNumberish
  ): Promise<{ value: BigNumber }>;
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
    getBorrowWei(positionId: BigNumberish): Promise<BigNumber>;
    getCollateralizationRatio(positionId: BigNumberish): Promise<BigNumber>;
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
    '[{"inputs":[{"internalType":"address","name":"_core","type":"address"},{"internalType":"address","name":"_admin","type":"address"},{"components":[{"internalType":"contract IERC20","name":"stableAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"internalType":"contract IInterestSetter","name":"interestSetter","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"earningsRate","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"internalType":"struct Types.GlobalParams","name":"_globalParams","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"parSupply","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"parBorrow","type":"tuple"},{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"borrowIndex","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateCollateralDelta","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateInverseAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateInverseRequired","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"calculateLiquidationPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"index","type":"tuple"}],"name":"fetchInterestRate","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Interest.Rate","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"index","type":"tuple"}],"name":"fetchNewIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"getAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"getBorrowIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"positionId","type":"uint256"}],"name":"getBorrowWei","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"positionId","type":"uint256"}],"name":"getCollateralizationRatio","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getCurrentPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"currentPar","type":"tuple"},{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"index","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"enum Types.AssetDenomination","name":"denomination","type":"uint8"},{"internalType":"enum Types.AssetReference","name":"ref","type":"uint8"},{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Types.AssetAmount","name":"amount","type":"tuple"}],"name":"getNewParAndDeltaWei","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Types.Wei","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getPosition","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getStableAsset","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"getSupplyBalance","outputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"supplier","type":"address"}],"name":"getSupplyWei","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getSyntheticAsset","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getTotalPar","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"globalIndex","outputs":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"position","type":"tuple"}],"name":"isCollateralized","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"params","outputs":[{"internalType":"contract IERC20","name":"stableAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"internalType":"contract IInterestSetter","name":"interestSetter","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"earningsRate","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"positionCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"positions","outputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"removeExcessTokens","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"position","type":"tuple"}],"name":"savePosition","outputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"amount","type":"tuple"}],"name":"setAmount","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"ratio","type":"tuple"}],"name":"setCollateralRatio","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"rate","type":"tuple"}],"name":"setEarningsRate","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_setter","type":"address"}],"name":"setInterestSetter","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"spread","type":"tuple"}],"name":"setLiquidationSpread","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_oracle","type":"address"}],"name":"setOracle","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"fee","type":"tuple"}],"name":"setOriginationFee","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"owner","type":"address"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"newPar","type":"tuple"}],"name":"setSupplyBalance","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"ratio","type":"tuple"}],"name":"setSyntheticRatio","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"supplyBalances","outputs":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalPar","outputs":[{"internalType":"uint128","name":"borrow","type":"uint128"},{"internalType":"uint128","name":"supply","type":"uint128"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"updateIndex","outputs":[{"components":[{"internalType":"uint96","name":"borrow","type":"uint96"},{"internalType":"uint96","name":"supply","type":"uint96"},{"internalType":"uint32","name":"lastUpdate","type":"uint32"}],"internalType":"struct Interest.Index","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"amount","type":"tuple"}],"name":"updatePositionAmount","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"existingPar","type":"tuple"},{"components":[{"internalType":"bool","name":"sign","type":"bool"},{"internalType":"uint128","name":"value","type":"uint128"}],"internalType":"struct Types.Par","name":"newPar","type":"tuple"}],"name":"updateTotalPar","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
  public static Bytecode =
    "0x60806040523480156200001157600080fd5b506040516200616c3803806200616c8339818101604052620000379190810190620005f2565b826000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555081600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555080600260008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160010160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060408201518160020160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060608201518160030160008201518160000155505060808201518160040160008201518160000155505060a08201518160050160008201518160000155505060c08201518160060160008201518160000155505060e0820151816007016000820151816000015550506101008201518160080160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555090505062000259620002fc60201b620041a41760201c565b600c60008201518160000160006101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff160217905550602082015181600001600c6101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff16021790555060408201518160000160186101000a81548163ffffffff021916908363ffffffff16021790555090505050505062000816565b62000306620003f7565b6040518060600160405280670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001620003726200038060201b62003eca1760201c565b63ffffffff16815250905090565b600062000398426200039d60201b6200442e1760201c565b905090565b600080829050828163ffffffff1614620003ee576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401620003e5906200068b565b60405180910390fd5b80915050919050565b604051806060016040528060006bffffffffffffffffffffffff16815260200160006bffffffffffffffffffffffff168152602001600063ffffffff1681525090565b6000815190506200044b816200077a565b92915050565b600081519050620004628162000794565b92915050565b6000815190506200047981620007ae565b92915050565b6000815190506200049081620007c8565b92915050565b600081519050620004a781620007e2565b92915050565b600060208284031215620004c057600080fd5b620004cc6020620006ad565b90506000620004de84828501620005db565b60008301525092915050565b60006101208284031215620004fe57600080fd5b6200050b610120620006ad565b905060006200051d8482850162000451565b6000830152506020620005338482850162000496565b6020830152506040620005498482850162000468565b60408301525060606200055f84828501620004ad565b60608301525060806200057584828501620004ad565b60808301525060a06200058b84828501620004ad565b60a08301525060c0620005a184828501620004ad565b60c08301525060e0620005b784828501620004ad565b60e083015250610100620005ce848285016200047f565b6101008301525092915050565b600081519050620005ec81620007fc565b92915050565b600080600061016084860312156200060957600080fd5b600062000619868287016200043a565b93505060206200062c868287016200043a565b92505060406200063f86828701620004ea565b9150509250925092565b600062000658601b83620006db565b91507f4d6174683a20556e73616665206361737420746f2075696e74333200000000006000830152602082019050919050565b60006020820190508181036000830152620006a68162000649565b9050919050565b6000604051905081810181811067ffffffffffffffff82111715620006d157600080fd5b8060405250919050565b600082825260208201905092915050565b6000620006f98262000750565b9050919050565b60006200070d82620006ec565b9050919050565b60006200072182620006ec565b9050919050565b60006200073582620006ec565b9050919050565b60006200074982620006ec565b9050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b6200078581620006ec565b81146200079157600080fd5b50565b6200079f8162000700565b8114620007ab57600080fd5b50565b620007b98162000714565b8114620007c557600080fd5b50565b620007d38162000728565b8114620007df57600080fd5b50565b620007ed816200073c565b8114620007f957600080fd5b50565b620008078162000770565b81146200081357600080fd5b50565b61594680620008266000396000f3fe608060405234801561001057600080fd5b50600436106102485760003560e01c806396d7d7e11161013b578063e2e02e0c116100b8578063eb02c3011161007c578063eb02c30114610785578063eb91d37e146107b5578063ef9d3926146107d3578063f38e266a14610803578063f9bd32351461083357610248565b8063e2e02e0c146106cd578063e2f6720e146106fd578063e63f2d9d1461072d578063e7702d0514610749578063e7a45f2e1461076757610248565b8063bcaa0c55116100ff578063bcaa0c551461060b578063bf0b49271461063b578063cff0ab961461066b578063d890a87014610691578063e043095a146106b157610248565b806396d7d7e11461054e5780639997640d1461057e57806399fbab881461059a578063b44c061f146105ce578063b9f412b0146105ed57610248565b8063599b81e7116101c9578063743bd7c91161018d578063743bd7c9146104955780637adbf973146104b45780637c7c200a146104d057806381045ead146105005780638a627d0d1461051e57610248565b8063599b81e7146103df578063651fafe11461040f5780636e830f4a1461042b57806370eae60a14610447578063740e67ef1461047757610248565b80632626ab08116102105780632626ab081461032b5780632863612b1461034757806340052049146103775780634c2fbfc6146103a757806356cffd13146103c357610248565b80630625dce11461024d5780630e884c12146102695780631896174e1461029a5780631e31274a146102ca57806320d6b011146102fa575b600080fd5b61026760048036036102629190810190614bdd565b610863565b005b610283600480360361027e9190810190614c58565b610909565b60405161029192919061556b565b60405180910390f35b6102b460048036036102af9190810190614ce4565b610ac6565b6040516102c191906155f3565b60405180910390f35b6102e460048036036102df9190810190614ce4565b610cf9565b6040516102f1919061534c565b60405180910390f35b610314600480360361030f9190810190614a5e565b610e11565b604051610322929190615367565b60405180910390f35b61034560048036036103409190810190614bdd565b610e5e565b005b610361600480360361035c9190810190614aec565b610f04565b60405161036e919061551a565b60405180910390f35b610391600480360361038c9190810190614d88565b611051565b60405161039e9190615594565b60405180910390f35b6103c160048036036103bc9190810190614bdd565b6113ba565b005b6103dd60048036036103d89190810190614ca8565b611460565b005b6103f960048036036103f49190810190614c2f565b6117a4565b60405161040691906155af565b60405180910390f35b61042960048036036104249190810190614bdd565b61195d565b005b61044560048036036104409190810190614bdd565b611a03565b005b610461600480360361045c9190810190614d36565b611aa9565b60405161046e919061551a565b60405180910390f35b61047f611ab6565b60405161048c9190615390565b60405180910390f35b61049d611ae3565b6040516104ab9291906155ca565b60405180910390f35b6104ce60048036036104c99190810190614a5e565b611b2d565b005b6104ea60048036036104e59190810190614b8e565b611c04565b6040516104f791906155f3565b60405180910390f35b610508611c6e565b6040516105159190615535565b60405180910390f35b61053860048036036105339190810190614c2f565b611d2a565b6040516105459190615535565b60405180910390f35b61056860048036036105639190810190614b8e565b611e12565b6040516105759190615550565b60405180910390f35b61059860048036036105939190810190614a5e565b611ef3565b005b6105b460048036036105af9190810190614d36565b611fc9565b6040516105c5959493929190615299565b60405180910390f35b6105d6612117565b6040516105e492919061560e565b60405180910390f35b6105f5612190565b6040516106029190615535565b60405180910390f35b61062560048036036106209190810190614aec565b612481565b604051610632919061527e565b60405180910390f35b61065560048036036106509190810190614b15565b6124f9565b6040516106629190615550565b60405180910390f35b6106736125af565b604051610688999897969594939291906153ab565b60405180910390f35b6106996126cf565b6040516106a893929190615637565b60405180910390f35b6106cb60048036036106c69190810190614a5e565b612727565b005b6106e760048036036106e29190810190614d88565b612884565b6040516106f49190615594565b60405180910390f35b61071760048036036107129190810190614d36565b612cf7565b60405161072491906155f3565b60405180910390f35b61074760048036036107429190810190614a87565b612efe565b005b610751613033565b60405161075e91906155f3565b60405180910390f35b61076f613039565b60405161077c9190615390565b60405180910390f35b61079f600480360361079a9190810190614d36565b613066565b6040516107ac9190615594565b60405180910390f35b6107bd613235565b6040516107ca919061551a565b60405180910390f35b6107ed60048036036107e89190810190614aec565b6132e5565b6040516107fa9190615535565b60405180910390f35b61081d60048036036108189190810190614a5e565b6133d2565b60405161082a9190615550565b60405180910390f35b61084d60048036036108489190810190614a5e565b613490565b60405161085a91906155f3565b60405180910390f35b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146108f3576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016108ea9061545a565b60405180910390fd5b8060026007016000820151816000015590505050565b610911614593565b6109196145c1565b6000836060015114801561094757506000600181111561093557fe5b8360400151600181111561094557fe5b145b1561095e57846109556134d7565b91509150610abe565b6109666145c1565b61097086866134fd565b905061097a614593565b6109826145c1565b6000600181111561098f57fe5b8660200151600181111561099f57fe5b1415610a21576040518060400160405280876000015115158152602001876060015181525090506001808111156109d257fe5b866040015160018111156109e257fe5b14156109fe576109fb83826135dc90919063ffffffff16565b90505b610a1a610a1482856135fe90919063ffffffff16565b886136d4565b9150610ab4565b6040518060400160405280876000015115158152602001610a4588606001516137d2565b6fffffffffffffffffffffffffffffffff16815250915060006001811115610a6957fe5b86604001516001811115610a7957fe5b1415610a9557610a92828961383590919063ffffffff16565b91505b610ab183610aa3848a6134fd565b6135dc90919063ffffffff16565b90505b8181945094505050505b935093915050565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610b57576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610b4e9061545a565b60405180910390fd5b600d54905081600e6000600d54815260200190815260200160002060008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160000160146101000a81548160ff02191690836001811115610bdd57fe5b021790555060408201518160000160156101000a81548160ff02191690836001811115610c0657fe5b021790555060608201518160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550505060808201518160020160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055505050905050600d60008154809291906001019190505550919050565b6000808260800151602001516fffffffffffffffffffffffffffffffff161415610d265760019050610e0c565b610d2e6145dd565b600260080160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b158015610d9957600080fd5b505afa158015610dad573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250610dd19190810190614c06565b9050610ddb614593565b610e00846040015185606001518660800151610dfa88604001516132e5565b866124f9565b90508060000151925050505b919050565b600f6020528060005260406000206000915090508060000160009054906101000a900460ff16908060000160019054906101000a90046fffffffffffffffffffffffffffffffff16905082565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610eee576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610ee59061545a565b60405180910390fd5b8060026003016000820151816000015590505050565b610f0c6145dd565b610f146145dd565b610f1c6145dd565b600260080160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b158015610f8757600080fd5b505afa158015610f9b573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250610fbf9190810190614c06565b905060006001811115610fce57fe5b846001811115610fda57fe5b141561100057610ff9610feb613a25565b600260050160000154613a49565b915061103b565b60018081111561100c57fe5b84600181111561101857fe5b141561103a57611037611029613a25565b600260050160000154613a7e565b91505b5b6110458183613ab3565b91508192505050919050565b6110596145f0565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146110e8576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016110df9061545a565b60405180910390fd5b6000600e6000868152602001908152602001600020905083600181111561110b57fe5b8160000160149054906101000a900460ff16600181111561112857fe5b141561119a57828160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550905050611202565b828160020160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055509050505b806040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff16600181111561128257fe5b600181111561128d57fe5b81526020016000820160159054906101000a900460ff1660018111156112af57fe5b60018111156112ba57fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509150509392505050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461144a576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016114419061545a565b60405180910390fd5b8060026006016000820151816000015590505050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146114ef576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016114e69061545a565b60405180910390fd5b6114f98282613aec565b15611503576117a0565b8160000151156115b15761157161156c83602001516fffffffffffffffffffffffffffffffff16600b60000160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16613b6b90919063ffffffff16565b6137d2565b600b60000160106101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550611651565b61161561161083602001516fffffffffffffffffffffffffffffffff16600b60000160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16613b6b90919063ffffffff16565b6137d2565b600b60000160006101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055505b8060000151156116ff576116bf6116ba82602001516fffffffffffffffffffffffffffffffff16600b60000160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16613bb590919063ffffffff16565b6137d2565b600b60000160106101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff16021790555061179f565b61176361175e82602001516fffffffffffffffffffffffffffffffff16600b60000160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16613bb590919063ffffffff16565b6137d2565b600b60000160006101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055505b5b5050565b6117ac614657565b6117b46145c1565b6117bc6145c1565b611866600b6040518060400160405290816000820160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681526020016000820160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505085613c0a565b91509150611872614657565b6002800160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663e8177dcf600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16846020015186602001516040518463ffffffff1660e01b815260040161190093929190615315565b60206040518083038186803b15801561191857600080fd5b505afa15801561192c573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506119509190810190614d0d565b9050809350505050919050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146119ed576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016119e49061545a565b60405180910390fd5b8060026005016000820151816000015590505050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611a93576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611a8a9061545a565b60405180910390fd5b8060026004016000820151816000015590505050565b611ab16145dd565b919050565b6000600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b600b8060000160009054906101000a90046fffffffffffffffffffffffffffffffff16908060000160109054906101000a90046fffffffffffffffffffffffffffffffff16905082565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611bbd576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611bb49061545a565b60405180910390fd5b80600260080160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b60008060006001811115611c1457fe5b856001811115611c2057fe5b1415611c3757611c308484613cc3565b9050611c63565b600180811115611c4357fe5b856001811115611c4f57fe5b1415611c6257611c5f8484613ce4565b90505b5b809150509392505050565b611c7661466a565b600c6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff1681525050905090565b611d3261466a565b611d3a614657565b611d43836117a4565b9050611e0a8382600b6040518060400160405290816000820160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681526020016000820160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250506002600701604051806020016040529081600082015481525050613d05565b915050919050565b611e1a614593565b6000611e27858585611c04565b905060006001811115611e3657fe5b856001811115611e4257fe5b1415611e7257611e6b816002600401604051806020016040529081600082015481525050613ce4565b9050611eb7565b600180811115611e7e57fe5b856001811115611e8a57fe5b1415611eb657611eb3816002600301604051806020016040529081600082015481525050613ce4565b90505b5b6040518060400160405280600115158152602001611ed4836137d2565b6fffffffffffffffffffffffffffffffff168152509150509392505050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611f83576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611f7a9061545a565b60405180910390fd5b806002800160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b600e6020528060005260406000206000915090508060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060000160149054906101000a900460ff16908060000160159054906101000a900460ff1690806001016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505090806002016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050905085565b600080600b60000160109054906101000a90046fffffffffffffffffffffffffffffffff16600b60000160009054906101000a90046fffffffffffffffffffffffffffffffff16816fffffffffffffffffffffffffffffffff169150806fffffffffffffffffffffffffffffffff169050915091509091565b61219861466a565b6121a0613eca565b63ffffffff16600c60000160189054906101000a900463ffffffff1663ffffffff16141561227e57600c6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff1681525050905061247e565b612335600c6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff1681525050611d2a565b600c60008201518160000160006101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff160217905550602082015181600001600c6101000a8154816bffffffffffffffffffffffff02191690836bffffffffffffffffffffffff16021790555060408201518160000160186101000a81548163ffffffff021916908363ffffffff16021790555090506040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff168152505090505b90565b600080600181111561248f57fe5b82600181111561249b57fe5b146124cb57600260010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff166124f2565b600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff165b9050919050565b612501614593565b612509614593565b612511614593565b6125196145c1565b6125238787613eda565b90506000600181111561253257fe5b89600181111561253e57fe5b141561255a5761255389826020015187611e12565b915061258b565b60018081111561256657fe5b89600181111561257257fe5b141561258a5761258789826020015187611e12565b91505b5b61259e8289613f1290919063ffffffff16565b925082935050505095945050505050565b60028060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060020160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690806003016040518060200160405290816000820154815250509080600401604051806020016040529081600082015481525050908060050160405180602001604052908160008201548152505090806006016040518060200160405290816000820154815250509080600701604051806020016040529081600082015481525050908060080160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905089565b600c8060000160009054906101000a90046bffffffffffffffffffffffff169080600001600c9054906101000a90046bffffffffffffffffffffffff16908060000160189054906101000a900463ffffffff16905083565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146127b7576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016127ae9061545a565b60405180910390fd5b6127bf6145c1565b6127c7613f34565b9050600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663a9059cbb8383602001516040518363ffffffff1660e01b815260040161282d9291906152ec565b602060405180830381600087803b15801561284757600080fd5b505af115801561285b573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525061287f9190810190614ac3565b505050565b61288c6145f0565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461291b576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016129129061545a565b60405180910390fd5b6000600e6000868152602001908152602001600020905083600181111561293e57fe5b8160000160149054906101000a900460ff16600181111561295b57fe5b1415612a52576129e783826001016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505061383590919063ffffffff16565b8160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff160217905550905050612b3f565b612ad883826002016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff168152505061383590919063ffffffff16565b8160010160008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055509050505b806040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff166001811115612bbf57fe5b6001811115612bca57fe5b81526020016000820160159054906101000a900460ff166001811115612bec57fe5b6001811115612bf757fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509150509392505050565b6000612d016145f0565b600e60008481526020019081526020016000206040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff166001811115612d9357fe5b6001811115612d9e57fe5b81526020016000820160159054906101000a900460ff166001811115612dc057fe5b6001811115612dcb57fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509050612ecb6145c1565b612eee612edb83604001516132e5565b8360800151613eda90919063ffffffff16565b9050806020015192505050919050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614612f8d576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401612f849061545a565b60405180910390fd5b80600f60008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008201518160000160006101000a81548160ff02191690831515021790555060208201518160000160016101000a8154816fffffffffffffffffffffffffffffffff02191690836fffffffffffffffffffffffffffffffff1602179055509050505050565b600d5481565b6000600260010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b61306e6145f0565b600e60008381526020019081526020016000206040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff16600181111561310057fe5b600181111561310b57fe5b81526020016000820160159054906101000a900460ff16600181111561312d57fe5b600181111561313857fe5b8152602001600182016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250508152602001600282016040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050815250509050919050565b61323d6145dd565b600260080160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b1580156132a857600080fd5b505afa1580156132bc573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506132e09190810190614c06565b905090565b6132ed61466a565b600060018111156132fa57fe5b82600181111561330657fe5b14156133c257600c6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff168152505090506133cd565b6133ca6141a4565b90505b919050565b6133da614593565b600f60008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206040518060400160405290816000820160009054906101000a900460ff161515151581526020016000820160019054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff16815250509050919050565b600061349a614593565b6134a3836133d2565b90506134ad6145c1565b6134c76134b8611c6e565b83613eda90919063ffffffff16565b9050806020015192505050919050565b6134df6145c1565b60405180604001604052806000151581526020016000815250905090565b6135056145c1565b600083602001516fffffffffffffffffffffffffffffffff16905083600001511561358257604051806040016040528060011515815260200161357785602001516bffffffffffffffffffffffff16670de0b6b3a764000067ffffffffffffffff16856142199092919063ffffffff16565b8152509150506135d6565b60405180604001604052806000151581526020016135cf85600001516bffffffffffffffffffffffff16670de0b6b3a764000067ffffffffffffffff16856142499092919063ffffffff16565b8152509150505b92915050565b6135e46145c1565b6135f6836135f1846142c5565b6135fe565b905092915050565b6136066145c1565b61360e6145c1565b8260000151151584600001511515141561365657836000015181600001901515908115158152505061364884602001518460200151613bb5565b8160200181815250506136ca565b826020015184602001511061369957836000015181600001901515908115158152505061368b84602001518460200151613b6b565b8160200181815250506136c9565b82600001518160000190151590811515815250506136bf83602001518560200151613b6b565b8160200181815250505b5b8091505092915050565b6136dc614593565b82600001511561375b57604051806040016040528060011515815260200161373f61373a670de0b6b3a764000067ffffffffffffffff1686602001516bffffffffffffffffffffffff1688602001516142199092919063ffffffff16565b6137d2565b6fffffffffffffffffffffffffffffffff1681525090506137cc565b60405180604001604052806000151581526020016137b46137af670de0b6b3a764000067ffffffffffffffff1686600001516bffffffffffffffffffffffff1688602001516142499092919063ffffffff16565b6137d2565b6fffffffffffffffffffffffffffffffff1681525090505b92915050565b60008082905082816fffffffffffffffffffffffffffffffff161461382c576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016138239061549a565b60405180910390fd5b80915050919050565b61383d614593565b613845614593565b826000015115158460000151151514156138df5783600001518160000190151590811515815250506138ab6138a685602001516fffffffffffffffffffffffffffffffff1685602001516fffffffffffffffffffffffffffffffff16613bb5565b6137d2565b81602001906fffffffffffffffffffffffffffffffff1690816fffffffffffffffffffffffffffffffff1681525050613a1b565b82602001516fffffffffffffffffffffffffffffffff1684602001516fffffffffffffffffffffffffffffffff161061399857836000015181600001901515908115158152505061396461395f85602001516fffffffffffffffffffffffffffffffff1685602001516fffffffffffffffffffffffffffffffff16613b6b565b6137d2565b81602001906fffffffffffffffffffffffffffffffff1690816fffffffffffffffffffffffffffffffff1681525050613a1a565b82600001518160000190151590811515815250506139ea6139e584602001516fffffffffffffffffffffffffffffffff1686602001516fffffffffffffffffffffffffffffffff16613b6b565b6137d2565b81602001906fffffffffffffffffffffffffffffffff1690816fffffffffffffffffffffffffffffffff16815250505b5b8091505092915050565b613a2d6145dd565b6040518060200160405280670de0b6b3a7640000815250905090565b613a516145dd565b6040518060200160405280613a73848660000151613bb590919063ffffffff16565b815250905092915050565b613a866145dd565b6040518060200160405280613aa8848660000151613b6b90919063ffffffff16565b815250905092915050565b613abb6145dd565b6040518060200160405280613ae185600001518560000151670de0b6b3a7640000614219565b815250905092915050565b600081602001516fffffffffffffffffffffffffffffffff1683602001516fffffffffffffffffffffffffffffffff161415613b6057600083602001516fffffffffffffffffffffffffffffffff161415613b4a5760019050613b65565b8160000151151583600001511515149050613b65565b600090505b92915050565b6000613bad83836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f7700008152506142f4565b905092915050565b600080828401905083811015613c00576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401613bf79061547a565b60405180910390fd5b8091505092915050565b613c126145c1565b613c1a6145c1565b613c22614593565b604051806040016040528060011515815260200186602001516fffffffffffffffffffffffffffffffff168152509050613c5a614593565b604051806040016040528060001515815260200187600001516fffffffffffffffffffffffffffffffff168152509050613c926145c1565b613c9c83876134fd565b9050613ca66145c1565b613cb083886134fd565b9050818195509550505050509250929050565b6000613cdc83670de0b6b3a76400008460000151614219565b905092915050565b6000613cfd838360000151670de0b6b3a7640000614219565b905092915050565b613d0d61466a565b613d156145c1565b613d1d6145c1565b613d278588613c0a565b915091506000613d35613eca565b90506000613d72613d5f8a6040015163ffffffff168463ffffffff16613b6b90919063ffffffff16565b896000015161434f90919063ffffffff16565b90506000613d7f856143bf565b15613d8d5760009050613dc0565b613d978288613ce4565b9050846020015184602001511015613dbf57613dbc8185602001518760200151614219565b90505b5b81811115613dca57fe5b6040518060600160405280613e30613e2b8d600001516bffffffffffffffffffffffff16613e1d8f600001516bffffffffffffffffffffffff1688670de0b6b3a764000067ffffffffffffffff16614219565b613bb590919063ffffffff16565b6143cf565b6bffffffffffffffffffffffff168152602001613e9e613e998d602001516bffffffffffffffffffffffff16613e8b8f602001516bffffffffffffffffffffffff1687670de0b6b3a764000067ffffffffffffffff16614219565b613bb590919063ffffffff16565b6143cf565b6bffffffffffffffffffffffff1681526020018463ffffffff1681525095505050505050949350505050565b6000613ed54261442e565b905090565b613ee26145c1565b613eeb83614485565b15613eff57613ef86134d7565b9050613f0c565b613f0983836134fd565b90505b92915050565b613f1a614593565b613f2c83613f27846144a7565b613835565b905092915050565b613f3c6145c1565b613f446145c1565b6040518060400160405280600115158152602001600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401613fb6919061527e565b60206040518083038186803b158015613fce57600080fd5b505afa158015613fe2573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506140069190810190614d5f565b81525090506140136145c1565b61401b6145c1565b614173600b6040518060400160405290816000820160009054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681526020016000820160109054906101000a90046fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff166fffffffffffffffffffffffffffffffff1681525050600c6040518060600160405290816000820160009054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff16815260200160008201600c9054906101000a90046bffffffffffffffffffffffff166bffffffffffffffffffffffff166bffffffffffffffffffffffff1681526020016000820160189054906101000a900463ffffffff1663ffffffff1663ffffffff1681525050613c0a565b9150915061419c8261418e83866135dc90919063ffffffff16565b6135dc90919063ffffffff16565b935050505090565b6141ac61466a565b6040518060600160405280670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff168152602001670de0b6b3a764000067ffffffffffffffff166bffffffffffffffffffffffff16815260200161420b613eca565b63ffffffff16815250905090565b600061424082614232858761434f90919063ffffffff16565b6144e890919063ffffffff16565b90509392505050565b6000808414806142595750600083145b15614270576142696000836144e8565b90506142be565b6142bb60016142ad8461429f6001614291898b61434f90919063ffffffff16565b613b6b90919063ffffffff16565b6144e890919063ffffffff16565b613bb590919063ffffffff16565b90505b9392505050565b6142cd6145c1565b60405180604001604052808360000151151515815260200183602001518152509050919050565b600083831115829061433c576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016143339190615438565b60405180910390fd5b5060008385039050809150509392505050565b60008083141561436257600090506143b9565b600082840290508284828161437357fe5b04146143b4576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016143ab906154fa565b60405180910390fd5b809150505b92915050565b6000808260200151149050919050565b60008082905082816bffffffffffffffffffffffff1614614425576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161441c906154ba565b60405180910390fd5b80915050919050565b600080829050828163ffffffff161461447c576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401614473906154da565b60405180910390fd5b80915050919050565b60008082602001516fffffffffffffffffffffffffffffffff16149050919050565b6144af614593565b60405180604001604052808360000151151515815260200183602001516fffffffffffffffffffffffffffffffff168152509050919050565b600061452a83836040518060400160405280601a81526020017f536166654d6174683a206469766973696f6e206279207a65726f000000000000815250614532565b905092915050565b60008083118290614579576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016145709190615438565b60405180910390fd5b50600083858161458557fe5b049050809150509392505050565b604051806040016040528060001515815260200160006fffffffffffffffffffffffffffffffff1681525090565b6040518060400160405280600015158152602001600081525090565b6040518060200160405280600081525090565b6040518060a00160405280600073ffffffffffffffffffffffffffffffffffffffff1681526020016000600181111561462557fe5b81526020016000600181111561463757fe5b81526020016146446146ad565b81526020016146516146ad565b81525090565b6040518060200160405280600081525090565b604051806060016040528060006bffffffffffffffffffffffff16815260200160006bffffffffffffffffffffffff168152602001600063ffffffff1681525090565b604051806040016040528060001515815260200160006fffffffffffffffffffffffffffffffff1681525090565b6000813590506146ea81615849565b92915050565b6000813590506146ff81615860565b92915050565b60008151905061471481615860565b92915050565b60008135905061472981615877565b92915050565b60008135905061473e81615887565b92915050565b60008135905061475381615897565b92915050565b60006080828403121561476b57600080fd5b614775608061566e565b90506000614785848285016146f0565b60008301525060206147998482850161471a565b60208301525060406147ad8482850161472f565b60408301525060606147c184828501614a0a565b60608301525092915050565b6000602082840312156147df57600080fd5b6147e9602061566e565b905060006147f984828501614a0a565b60008301525092915050565b60006020828403121561481757600080fd5b614821602061566e565b9050600061483184828501614a1f565b60008301525092915050565b60006060828403121561484f57600080fd5b614859606061566e565b9050600061486984828501614a49565b600083015250602061487d84828501614a49565b602083015250604061489184828501614a34565b60408301525092915050565b6000604082840312156148af57600080fd5b6148b9604061566e565b905060006148c9848285016146f0565b60008301525060206148dd848285016149f5565b60208301525092915050565b6000604082840312156148fb57600080fd5b614905604061566e565b90506000614915848285016146f0565b6000830152506020614929848285016149f5565b60208301525092915050565b600060e0828403121561494757600080fd5b61495160a061566e565b90506000614961848285016146db565b600083015250602061497584828501614744565b602083015250604061498984828501614744565b604083015250606061499d8482850161489d565b60608301525060a06149b18482850161489d565b60808301525092915050565b6000602082840312156149cf57600080fd5b6149d9602061566e565b905060006149e984828501614a1f565b60008301525092915050565b600081359050614a04816158a7565b92915050565b600081359050614a19816158be565b92915050565b600081519050614a2e816158be565b92915050565b600081359050614a43816158d5565b92915050565b600081359050614a58816158ec565b92915050565b600060208284031215614a7057600080fd5b6000614a7e848285016146db565b91505092915050565b60008060608385031215614a9a57600080fd5b6000614aa8858286016146db565b9250506020614ab9858286016148e9565b9150509250929050565b600060208284031215614ad557600080fd5b6000614ae384828501614705565b91505092915050565b600060208284031215614afe57600080fd5b6000614b0c84828501614744565b91505092915050565b60008060008060006101208688031215614b2e57600080fd5b6000614b3c88828901614744565b9550506020614b4d888289016148e9565b9450506060614b5e888289016148e9565b93505060a0614b6f8882890161483d565b925050610100614b81888289016147cd565b9150509295509295909350565b600080600060608486031215614ba357600080fd5b6000614bb186828701614744565b9350506020614bc286828701614a0a565b9250506040614bd3868287016147cd565b9150509250925092565b600060208284031215614bef57600080fd5b6000614bfd848285016147cd565b91505092915050565b600060208284031215614c1857600080fd5b6000614c2684828501614805565b91505092915050565b600060608284031215614c4157600080fd5b6000614c4f8482850161483d565b91505092915050565b60008060006101208486031215614c6e57600080fd5b6000614c7c868287016148e9565b9350506040614c8d8682870161483d565b92505060a0614c9e86828701614759565b9150509250925092565b60008060808385031215614cbb57600080fd5b6000614cc9858286016148e9565b9250506040614cda858286016148e9565b9150509250929050565b600060e08284031215614cf657600080fd5b6000614d0484828501614935565b91505092915050565b600060208284031215614d1f57600080fd5b6000614d2d848285016149bd565b91505092915050565b600060208284031215614d4857600080fd5b6000614d5684828501614a0a565b91505092915050565b600060208284031215614d7157600080fd5b6000614d7f84828501614a1f565b91505092915050565b600080600060808486031215614d9d57600080fd5b6000614dab86828701614a0a565b9350506020614dbc86828701614744565b9250506040614dcd868287016148e9565b9150509250925092565b614de0816156b7565b82525050565b614def816156b7565b82525050565b614dfe816156c9565b82525050565b614e0d816156c9565b82525050565b614e1c81615756565b82525050565b614e2b8161577a565b82525050565b614e3a8161579e565b82525050565b614e49816157c2565b82525050565b614e58816157e6565b82525050565b614e67816157e6565b82525050565b6000614e788261569b565b614e8281856156a6565b9350614e928185602086016157f8565b614e9b8161582b565b840191505092915050565b6000614eb36019836156a6565b91507f53746174653a206f6e6c7920636f72652063616e2063616c6c000000000000006000830152602082019050919050565b6000614ef3601b836156a6565b91507f536166654d6174683a206164646974696f6e206f766572666c6f7700000000006000830152602082019050919050565b6000614f33601c836156a6565b91507f4d6174683a20556e73616665206361737420746f2075696e74313238000000006000830152602082019050919050565b6000614f73601b836156a6565b91507f4d6174683a20556e73616665206361737420746f2075696e74393600000000006000830152602082019050919050565b6000614fb3601b836156a6565b91507f4d6174683a20556e73616665206361737420746f2075696e74333200000000006000830152602082019050919050565b6000614ff36021836156a6565b91507f536166654d6174683a206d756c7469706c69636174696f6e206f766572666c6f60008301527f77000000000000000000000000000000000000000000000000000000000000006020830152604082019050919050565b6020820160008201516150626000850182615224565b50505050565b60208201600082015161507e6000850182615224565b50505050565b60608201600082015161509a6000850182615260565b5060208201516150ad6020850182615260565b5060408201516150c06040850182615242565b50505050565b6040820160008201516150dc6000850182614df5565b5060208201516150ef6020850182615206565b50505050565b60408201600082015161510b6000850182614df5565b50602082015161511e6020850182615206565b50505050565b60408201600082015161513a6000850182614df5565b50602082015161514d6020850182615206565b50505050565b60e0820160008201516151696000850182614dd7565b50602082015161517c6020850182614e4f565b50604082015161518f6040850182614e4f565b5060608201516151a260608501826150f5565b5060808201516151b560a08501826150f5565b50505050565b6020820160008201516151d16000850182615224565b50505050565b6040820160008201516151ed6000850182614df5565b5060208201516152006020850182615224565b50505050565b61520f816156e8565b82525050565b61521e816156e8565b82525050565b61522d81615724565b82525050565b61523c81615724565b82525050565b61524b8161572e565b82525050565b61525a8161572e565b82525050565b6152698161573e565b82525050565b6152788161573e565b82525050565b60006020820190506152936000830184614de6565b92915050565b600060e0820190506152ae6000830188614de6565b6152bb6020830187614e5e565b6152c86040830186614e5e565b6152d56060830185615124565b6152e260a0830184615124565b9695505050505050565b60006040820190506153016000830185614de6565b61530e6020830184615233565b9392505050565b600060608201905061532a6000830186614de6565b6153376020830185615233565b6153446040830184615233565b949350505050565b60006020820190506153616000830184614e04565b92915050565b600060408201905061537c6000830185614e04565b6153896020830184615215565b9392505050565b60006020820190506153a56000830184614e13565b92915050565b6000610120820190506153c1600083018c614e13565b6153ce602083018b614e40565b6153db604083018a614e22565b6153e86060830189615068565b6153f56080830188615068565b61540260a0830187615068565b61540f60c0830186615068565b61541c60e0830185615068565b61542a610100830184614e31565b9a9950505050505050505050565b600060208201905081810360008301526154528184614e6d565b905092915050565b6000602082019050818103600083015261547381614ea6565b9050919050565b6000602082019050818103600083015261549381614ee6565b9050919050565b600060208201905081810360008301526154b381614f26565b9050919050565b600060208201905081810360008301526154d381614f66565b9050919050565b600060208201905081810360008301526154f381614fa6565b9050919050565b6000602082019050818103600083015261551381614fe6565b9050919050565b600060208201905061552f600083018461504c565b92915050565b600060608201905061554a6000830184615084565b92915050565b600060408201905061556560008301846150c6565b92915050565b600060808201905061558060008301856150c6565b61558d60408301846151d7565b9392505050565b600060e0820190506155a96000830184615153565b92915050565b60006020820190506155c460008301846151bb565b92915050565b60006040820190506155df6000830185615215565b6155ec6020830184615215565b9392505050565b60006020820190506156086000830184615233565b92915050565b60006040820190506156236000830185615233565b6156306020830184615233565b9392505050565b600060608201905061564c600083018661526f565b615659602083018561526f565b6156666040830184615251565b949350505050565b6000604051905081810181811067ffffffffffffffff8211171561569157600080fd5b8060405250919050565b600081519050919050565b600082825260208201905092915050565b60006156c282615704565b9050919050565b60008115159050919050565b60008190506156e38261583c565b919050565b60006fffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b600063ffffffff82169050919050565b60006bffffffffffffffffffffffff82169050919050565b600061576182615768565b9050919050565b600061577382615704565b9050919050565b60006157858261578c565b9050919050565b600061579782615704565b9050919050565b60006157a9826157b0565b9050919050565b60006157bb82615704565b9050919050565b60006157cd826157d4565b9050919050565b60006157df82615704565b9050919050565b60006157f1826156d5565b9050919050565b60005b838110156158165780820151818401526020810190506157fb565b83811115615825576000848401525b50505050565b6000601f19601f8301169050919050565b6002811061584657fe5b50565b615852816156b7565b811461585d57600080fd5b50565b615869816156c9565b811461587457600080fd5b50565b6002811061588457600080fd5b50565b6002811061589457600080fd5b50565b600281106158a457600080fd5b50565b6158b0816156e8565b81146158bb57600080fd5b50565b6158c781615724565b81146158d257600080fd5b50565b6158de8161572e565b81146158e957600080fd5b50565b6158f58161573e565b811461590057600080fd5b5056fea365627a7a72315820e98b36d3a7807eca56fcb5aadae9c3a99ed77696768dfd02098b94aeeb0ff57f6c6578706572696d656e74616cf564736f6c63430005100040";
}
