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
      encode([borrowedAsset, supply, borrow, price]: [
        BigNumberish,
        { value: BigNumberish; isPositive: boolean },
        { value: BigNumberish; isPositive: boolean },
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

    getAddress: TypedFunctionDescription<{
      encode([asset]: [BigNumberish]): string;
    }>;

    getCurrentPrice: TypedFunctionDescription<{ encode([]: []): string }>;

    getPosition: TypedFunctionDescription<{
      encode([id]: [BigNumberish]): string;
    }>;

    getSupplyBalance: TypedFunctionDescription<{
      encode([owner]: [string]): string;
    }>;

    getSyntheticAsset: TypedFunctionDescription<{ encode([]: []): string }>;

    getcollateralAsset: TypedFunctionDescription<{ encode([]: []): string }>;

    isCollateralized: TypedFunctionDescription<{
      encode([position]: [
        {
          owner: string;
          collateralAsset: BigNumberish;
          borrowedAsset: BigNumberish;
          collateralAmount: { value: BigNumberish; isPositive: boolean };
          borrowedAmount: { value: BigNumberish; isPositive: boolean };
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
          collateralAmount: { value: BigNumberish; isPositive: boolean };
          borrowedAmount: { value: BigNumberish; isPositive: boolean };
        }
      ]): string;
    }>;

    setAmount: TypedFunctionDescription<{
      encode([id, asset, amount]: [
        BigNumberish,
        BigNumberish,
        { value: BigNumberish; isPositive: boolean }
      ]): string;
    }>;

    setCollateralRatio: TypedFunctionDescription<{
      encode([ratio]: [{ value: BigNumberish }]): string;
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

    totalSupplied: TypedFunctionDescription<{ encode([]: []): string }>;

    updatePositionAmount: TypedFunctionDescription<{
      encode([id, asset, amount]: [
        BigNumberish,
        BigNumberish,
        { value: BigNumberish; isPositive: boolean }
      ]): string;
    }>;

    updateTotalSupplied: TypedFunctionDescription<{
      encode([amount]: [BigNumberish]): string;
    }>;
  };
  events: {
    GlobalParamsUpdated: TypedEventDescription<{
      encodeTopics([updatedParams]: [null]): string[];
    }>;

    TotalSuppliedUpdated: TypedEventDescription<{
      encodeTopics([updatedSupply]: [null]): string[];
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
    supply: { value: BigNumberish; isPositive: boolean },
    borrow: { value: BigNumberish; isPositive: boolean },
    price: { value: BigNumberish }
  ): Promise<{ value: BigNumber; isPositive: boolean }>;
  calculateInverseAmount(
    asset: BigNumberish,
    amount: BigNumberish,
    price: { value: BigNumberish }
  ): Promise<BigNumber>;
  calculateInverseRequired(
    asset: BigNumberish,
    amount: BigNumberish,
    price: { value: BigNumberish }
  ): Promise<{ value: BigNumber; isPositive: boolean }>;
  calculateLiquidationPrice(asset: BigNumberish): Promise<{ value: BigNumber }>;
  getAddress(asset: BigNumberish): Promise<string>;
  getCurrentPrice(): Promise<{ value: BigNumber }>;
  getPosition(
    id: BigNumberish
  ): Promise<{
    owner: string;
    collateralAsset: number;
    borrowedAsset: number;
    collateralAmount: { value: BigNumber; isPositive: boolean };
    borrowedAmount: { value: BigNumber; isPositive: boolean };
  }>;
  getSupplyBalance(
    owner: string
  ): Promise<{ value: BigNumber; isPositive: boolean }>;
  getSyntheticAsset(): Promise<string>;
  getcollateralAsset(): Promise<string>;
  isCollateralized(position: {
    owner: string;
    collateralAsset: BigNumberish;
    borrowedAsset: BigNumberish;
    collateralAmount: { value: BigNumberish; isPositive: boolean };
    borrowedAmount: { value: BigNumberish; isPositive: boolean };
  }): Promise<boolean>;
  params(): Promise<{
    collateralAsset: string;
    syntheticAsset: string;
    collateralRatio: { value: BigNumber };
    syntheticRatio: { value: BigNumber };
    liquidationSpread: { value: BigNumber };
    originationFee: { value: BigNumber };
    oracle: string;
    0: string;
    1: string;
    2: { value: BigNumber };
    3: { value: BigNumber };
    4: { value: BigNumber };
    5: { value: BigNumber };
    6: string;
  }>;
  positionCount(): Promise<BigNumber>;
  positions(
    arg0: BigNumberish
  ): Promise<{
    owner: string;
    collateralAsset: number;
    borrowedAsset: number;
    collateralAmount: { value: BigNumber; isPositive: boolean };
    borrowedAmount: { value: BigNumber; isPositive: boolean };
    0: string;
    1: number;
    2: number;
    3: { value: BigNumber; isPositive: boolean };
    4: { value: BigNumber; isPositive: boolean };
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
      collateralAmount: { value: BigNumberish; isPositive: boolean };
      borrowedAmount: { value: BigNumberish; isPositive: boolean };
    },
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  setAmount(
    id: BigNumberish,
    asset: BigNumberish,
    amount: { value: BigNumberish; isPositive: boolean },
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  setCollateralRatio(
    ratio: { value: BigNumberish },
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
  totalSupplied(): Promise<BigNumber>;
  updatePositionAmount(
    id: BigNumberish,
    asset: BigNumberish,
    amount: { value: BigNumberish; isPositive: boolean },
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;
  updateTotalSupplied(
    amount: BigNumberish,
    overrides?: TransactionOverrides
  ): Promise<ContractTransaction>;

  GlobalParamsUpdated(updatedParams: null): EventFilter;
  TotalSuppliedUpdated(updatedSupply: null): EventFilter;

  estimate: {
    calculateCollateralDelta(
      borrowedAsset: BigNumberish,
      supply: { value: BigNumberish; isPositive: boolean },
      borrow: { value: BigNumberish; isPositive: boolean },
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
    getAddress(asset: BigNumberish): Promise<BigNumber>;
    getCurrentPrice(): Promise<BigNumber>;
    getPosition(id: BigNumberish): Promise<BigNumber>;
    getSupplyBalance(owner: string): Promise<BigNumber>;
    getSyntheticAsset(): Promise<BigNumber>;
    getcollateralAsset(): Promise<BigNumber>;
    isCollateralized(position: {
      owner: string;
      collateralAsset: BigNumberish;
      borrowedAsset: BigNumberish;
      collateralAmount: { value: BigNumberish; isPositive: boolean };
      borrowedAmount: { value: BigNumberish; isPositive: boolean };
    }): Promise<BigNumber>;
    params(): Promise<BigNumber>;
    positionCount(): Promise<BigNumber>;
    positions(arg0: BigNumberish): Promise<BigNumber>;
    removeExcessTokens(to: string): Promise<BigNumber>;
    savePosition(position: {
      owner: string;
      collateralAsset: BigNumberish;
      borrowedAsset: BigNumberish;
      collateralAmount: { value: BigNumberish; isPositive: boolean };
      borrowedAmount: { value: BigNumberish; isPositive: boolean };
    }): Promise<BigNumber>;
    setAmount(
      id: BigNumberish,
      asset: BigNumberish,
      amount: { value: BigNumberish; isPositive: boolean }
    ): Promise<BigNumber>;
    setCollateralRatio(ratio: { value: BigNumberish }): Promise<BigNumber>;
    setLiquidationSpread(spread: { value: BigNumberish }): Promise<BigNumber>;
    setOracle(_oracle: string): Promise<BigNumber>;
    setOriginationFee(fee: { value: BigNumberish }): Promise<BigNumber>;
    setSyntheticRatio(ratio: { value: BigNumberish }): Promise<BigNumber>;
    totalSupplied(): Promise<BigNumber>;
    updatePositionAmount(
      id: BigNumberish,
      asset: BigNumberish,
      amount: { value: BigNumberish; isPositive: boolean }
    ): Promise<BigNumber>;
    updateTotalSupplied(amount: BigNumberish): Promise<BigNumber>;
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
      collateralAsset: string;
      syntheticAsset: string;
      collateralRatio: { value: BigNumberish };
      syntheticRatio: { value: BigNumberish };
      liquidationSpread: { value: BigNumberish };
      originationFee: { value: BigNumberish };
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
      collateralAsset: string;
      syntheticAsset: string;
      collateralRatio: { value: BigNumberish };
      syntheticRatio: { value: BigNumberish };
      liquidationSpread: { value: BigNumberish };
      originationFee: { value: BigNumberish };
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
      collateralAsset: string;
      syntheticAsset: string;
      collateralRatio: { value: BigNumberish };
      syntheticRatio: { value: BigNumberish };
      liquidationSpread: { value: BigNumberish };
      originationFee: { value: BigNumberish };
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
    '[{"inputs":[{"internalType":"address","name":"_core","type":"address"},{"internalType":"address","name":"_admin","type":"address"},{"components":[{"internalType":"contract IERC20","name":"collateralAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"internalType":"struct Types.GlobalParams","name":"_globalParams","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"components":[{"internalType":"contract IERC20","name":"collateralAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"indexed":false,"internalType":"struct Types.GlobalParams","name":"updatedParams","type":"tuple"}],"name":"GlobalParamsUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"updatedSupply","type":"uint256"}],"name":"TotalSuppliedUpdated","type":"event"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"supply","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"borrow","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateCollateralDelta","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateInverseAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateInverseRequired","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"calculateLiquidationPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"getAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getCurrentPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getPosition","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"getSupplyBalance","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getSyntheticAsset","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getcollateralAsset","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"position","type":"tuple"}],"name":"isCollateralized","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"params","outputs":[{"internalType":"contract IERC20","name":"collateralAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"positionCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"positions","outputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"borrowedAmount","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"removeExcessTokens","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"position","type":"tuple"}],"name":"savePosition","outputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"amount","type":"tuple"}],"name":"setAmount","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"ratio","type":"tuple"}],"name":"setCollateralRatio","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"spread","type":"tuple"}],"name":"setLiquidationSpread","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_oracle","type":"address"}],"name":"setOracle","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"fee","type":"tuple"}],"name":"setOriginationFee","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"ratio","type":"tuple"}],"name":"setSyntheticRatio","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupplied","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"amount","type":"tuple"}],"name":"updatePositionAmount","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"updateTotalSupplied","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
  public static Bytecode =
    "0x60806040523480156200001157600080fd5b5060405162003cd538038062003cd58339818101604052620000379190810190620003d5565b826000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555081600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555080600260008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160010160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060408201518160020160008201518160000155505060608201518160030160008201518160000155505060808201518160040160008201518160000155505060a08201518160050160008201518160000155505060c08201518160060160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055509050507f8c76ed4b51f8936a2cc3d76c5ca210ff17bd985fa4e446e121f71cca71407e0960026040516200021991906200058c565b60405180910390a17f86804d570f055c94f2a959491e1dae98838d99bd1dba80aec8a82b8408fa5b3c60006040516200025391906200056f565b60405180910390a15050506200084e565b6000815190506200027581620007cc565b92915050565b6000815190506200028c81620007e6565b92915050565b600081519050620002a38162000800565b92915050565b600081519050620002ba816200081a565b92915050565b600060208284031215620002d357600080fd5b620002df6020620005a9565b90506000620002f184828501620003be565b60008301525092915050565b600060e082840312156200031057600080fd5b6200031c60e0620005a9565b905060006200032e848285016200027b565b60008301525060206200034484828501620002a9565b60208301525060406200035a84828501620002c0565b60408301525060606200037084828501620002c0565b60608301525060806200038684828501620002c0565b60808301525060a06200039c84828501620002c0565b60a08301525060c0620003b28482850162000292565b60c08301525092915050565b600081519050620003cf8162000834565b92915050565b60008060006101208486031215620003ec57600080fd5b6000620003fc8682870162000264565b93505060206200040f8682870162000264565b92505060406200042286828701620002fd565b9150509250925092565b6200043781620006bb565b82525050565b6200044881620006e3565b82525050565b62000459816200070b565b82525050565b6200046a8162000733565b82525050565b6020820160008083015490506200048781620007a1565b6200049660008601826200055e565b5050505050565b60e082016000808301549050620004b48162000747565b620004c360008601826200042c565b5060018301549050620004d68162000783565b620004e560208601826200044e565b5060028301620004f9604086018262000470565b50600383016200050d606086018262000470565b506004830162000521608086018262000470565b50600583016200053560a086018262000470565b5060068301549050620005488162000765565b6200055760c08601826200043d565b5050505050565b6200056981620006b1565b82525050565b60006020820190506200058660008301846200045f565b92915050565b600060e082019050620005a360008301846200049d565b92915050565b6000604051905081810181811067ffffffffffffffff82111715620005cd57600080fd5b8060405250919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b60006200064e8262000691565b9050919050565b6000620006628262000641565b9050919050565b6000620006768262000641565b9050919050565b60006200068a8262000641565b9050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b6000620006c882620006cf565b9050919050565b6000620006dc8262000691565b9050919050565b6000620006f082620006f7565b9050919050565b6000620007048262000691565b9050919050565b600062000718826200071f565b9050919050565b60006200072c8262000691565b9050919050565b60006200074082620006b1565b9050919050565b60006200075e6200075883620007bf565b620005d7565b9050919050565b60006200077c6200077683620007bf565b620005f7565b9050919050565b60006200079a6200079483620007bf565b62000617565b9050919050565b6000620007b8620007b283620007bf565b62000637565b9050919050565b60008160001c9050919050565b620007d78162000641565b8114620007e357600080fd5b50565b620007f18162000655565b8114620007fd57600080fd5b50565b6200080b8162000669565b81146200081757600080fd5b50565b62000825816200067d565b81146200083157600080fd5b50565b6200083f81620006b1565b81146200084b57600080fd5b50565b613477806200085e6000396000f3fe608060405234801561001057600080fd5b50600436106101735760003560e01c80639f24d8ed116100de578063e043095a11610097578063e7a45f2e11610071578063e7a45f2e1461049e578063eb02c301146104bc578063eb91d37e146104ec578063f38e266a1461050a57610173565b8063e043095a14610434578063e2158c3914610450578063e7702d051461048057610173565b80639f24d8ed14610346578063b1d0b9f914610376578063b5fffc8f14610392578063bcaa0c55146103c2578063c742bd41146103f2578063cff0ab961461041057610173565b8063651fafe111610130578063651fafe11461025e5780636e830f4a1461027a5780637adbf973146102965780637c7c200a146102b257806396d7d7e1146102e257806399fbab881461031257610173565b80632626ab0814610178578063270f2588146101945780632863612b146101c45780634c2fbfc6146101f457806361718a7d14610210578063630fd0ac14610240575b600080fd5b610192600480360361018d9190810190612974565b61053a565b005b6101ae60048036036101a991908101906129c6565b610617565b6040516101bb919061314c565b60405180910390f35b6101de60048036036101d99190810190612899565b6107e0565b6040516101eb91906130e0565b60405180910390f35b61020e60048036036102099190810190612974565b61092d565b005b61022a600480360361022591908101906128c2565b610a0b565b6040516102379190613116565b60405180910390f35b610248610ba8565b604051610255919061314c565b60405180910390f35b61027860048036036102739190810190612974565b610bae565b005b610294600480360361028f9190810190612974565b610c8c565b005b6102b060048036036102ab9190810190612847565b610d6a565b005b6102cc60048036036102c79190810190612925565b610e79565b6040516102d9919061314c565b60405180910390f35b6102fc60048036036102f79190810190612925565b610ee3565b6040516103099190613116565b60405180910390f35b61032c600480360361032791908101906129ef565b610fa9565b60405161033d959493929190612edf565b60405180910390f35b610360600480360361035b9190810190612a41565b611077565b60405161036d9190613131565b60405180910390f35b610390600480360361038b91908101906129ef565b611380565b005b6103ac60048036036103a79190810190612a41565b611466565b6040516103b99190613131565b60405180910390f35b6103dc60048036036103d79190810190612899565b6116e5565b6040516103e99190612ec4565b60405180910390f35b6103fa61175d565b6040516104079190612f76565b60405180910390f35b61041861178a565b60405161042b9796959493929190612f91565b60405180910390f35b61044e60048036036104499190810190612847565b61186a565b005b61046a600480360361046591908101906129c6565b6119b7565b6040516104779190612f5b565b60405180910390f35b610488611abf565b604051610495919061314c565b60405180910390f35b6104a6611ac5565b6040516104b39190612f76565b60405180910390f35b6104d660048036036104d191908101906129ef565b611af2565b6040516104e39190613131565b60405180910390f35b6104f4611c41565b60405161050191906130e0565b60405180910390f35b610524600480360361051f9190810190612847565b611cf1565b6040516105319190613116565b60405180910390f35b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146105ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016105c190613060565b60405180910390fd5b8060028001600082015181600001559050507f8c76ed4b51f8936a2cc3d76c5ca210ff17bd985fa4e446e121f71cca71407e09600260405161060c91906130fb565b60405180910390a150565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146106a8576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161069f90613060565b60405180910390fd5b600954905081600b6000600954815260200190815260200160002060008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160000160146101000a81548160ff0219169083600181111561072e57fe5b021790555060408201518160000160156101000a81548160ff0219169083600181111561075757fe5b02179055506060820151816001016000820151816000015560208201518160010160006101000a81548160ff02191690831515021790555050506080820151816003016000820151816000015560208201518160010160006101000a81548160ff0219169083151502179055505050905050600960008154809291906001019190505550919050565b6107e8612587565b6107f0612587565b6107f8612587565b600260060160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b15801561086357600080fd5b505afa158015610877573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525061089b919081019061299d565b9050600060018111156108aa57fe5b8460018111156108b657fe5b14156108dc576108d56108c7611ddf565b600260040160000154611e03565b9150610917565b6001808111156108e857fe5b8460018111156108f457fe5b141561091657610913610905611ddf565b600260040160000154611e38565b91505b5b6109218183611e6d565b91508192505050919050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146109bd576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016109b490613060565b60405180910390fd5b806002600501600082015181600001559050507f8c76ed4b51f8936a2cc3d76c5ca210ff17bd985fa4e446e121f71cca71407e096002604051610a0091906130fb565b60405180910390a150565b610a1361259a565b610a1b61259a565b610a2361259a565b60006001811115610a3057fe5b876001811115610a3c57fe5b1415610a5857610a5187866000015186610ee3565b9050610a89565b600180811115610a6457fe5b876001811115610a7057fe5b1415610a8857610a8587866000015186610ee3565b90505b5b610aaa60405180606001604052806026815260200161340f60269139611ea6565b610af26040518060400160405280600d81526020017f737570706c793a2025732025730000000000000000000000000000000000000081525087602001518860000151611f3f565b610b3a6040518060400160405280600d81526020017f626f72726f773a2025732025730000000000000000000000000000000000000081525086602001518760000151611f3f565b610b51816000015187611fde90919063ffffffff16565b9150610b9b6040518060400160405280600c81526020017f64656c74613a202573202573000000000000000000000000000000000000000081525083602001518460000151611f3f565b8192505050949350505050565b600a5481565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610c3e576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610c3590613060565b60405180910390fd5b806002600401600082015181600001559050507f8c76ed4b51f8936a2cc3d76c5ca210ff17bd985fa4e446e121f71cca71407e096002604051610c8191906130fb565b60405180910390a150565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610d1c576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610d1390613060565b60405180910390fd5b806002600301600082015181600001559050507f8c76ed4b51f8936a2cc3d76c5ca210ff17bd985fa4e446e121f71cca71407e096002604051610d5f91906130fb565b60405180910390a150565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610dfa576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610df190613060565b60405180910390fd5b80600260060160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507f8c76ed4b51f8936a2cc3d76c5ca210ff17bd985fa4e446e121f71cca71407e096002604051610e6e91906130fb565b60405180910390a150565b60008060006001811115610e8957fe5b856001811115610e9557fe5b1415610eac57610ea5848461209c565b9050610ed8565b600180811115610eb857fe5b856001811115610ec457fe5b1415610ed757610ed484846120bd565b90505b5b809150509392505050565b610eeb61259a565b6000610ef8858585610e79565b905060006001811115610f0757fe5b856001811115610f1357fe5b1415610f4357610f3c81600260030160405180602001604052908160008201548152505061209c565b9050610f87565b600180811115610f4f57fe5b856001811115610f5b57fe5b1415610f8657610f83816002800160405180602001604052908160008201548152505061209c565b90505b5b6040518060400160405280828152602001600115158152509150509392505050565b600b6020528060005260406000206000915090508060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060000160149054906101000a900460ff16908060000160159054906101000a900460ff169080600101604051806040016040529081600082015481526020016001820160009054906101000a900460ff1615151515815250509080600301604051806040016040529081600082015481526020016001820160009054906101000a900460ff161515151581525050905085565b61107f6125b6565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461110e576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161110590613060565b60405180910390fd5b6000600b6000868152602001908152602001600020905083600181111561113157fe5b8160000160149054906101000a900460ff16600181111561114e57fe5b14156111d05761119a8382600101604051806040016040529081600082015481526020016001820160009054906101000a900460ff1615151515815250506120de90919063ffffffff16565b816001016000820151816000015560208201518160010160006101000a81548160ff021916908315150217905550905050611248565b6112168382600301604051806040016040529081600082015481526020016001820160009054906101000a900460ff1615151515815250506120de90919063ffffffff16565b816003016000820151816000015560208201518160010160006101000a81548160ff0219169083151502179055509050505b806040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff1660018111156112c857fe5b60018111156112d357fe5b81526020016000820160159054906101000a900460ff1660018111156112f557fe5b600181111561130057fe5b815260200160018201604051806040016040529081600082015481526020016001820160009054906101000a900460ff161515151581525050815260200160038201604051806040016040529081600082015481526020016001820160009054906101000a900460ff161515151581525050815250509150509392505050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161461140f576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161140690613060565b60405180910390fd5b61142481600a5461212e90919063ffffffff16565b600a819055507f86804d570f055c94f2a959491e1dae98838d99bd1dba80aec8a82b8408fa5b3c600a5460405161145b919061314c565b60405180910390a150565b61146e6125b6565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146114fd576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016114f490613060565b60405180910390fd5b6000600b6000868152602001908152602001600020905083600181111561152057fe5b8160000160149054906101000a900460ff16600181111561153d57fe5b141561157a5782816001016000820151816000015560208201518160010160006101000a81548160ff0219169083151502179055509050506115ad565b82816003016000820151816000015560208201518160010160006101000a81548160ff0219169083151502179055509050505b806040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff16600181111561162d57fe5b600181111561163857fe5b81526020016000820160159054906101000a900460ff16600181111561165a57fe5b600181111561166557fe5b815260200160018201604051806040016040529081600082015481526020016001820160009054906101000a900460ff161515151581525050815260200160038201604051806040016040529081600082015481526020016001820160009054906101000a900460ff161515151581525050815250509150509392505050565b60008060018111156116f357fe5b8260018111156116ff57fe5b1461172f57600260010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16611756565b600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff165b9050919050565b6000600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b60028060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169080600201604051806020016040529081600082015481525050908060030160405180602001604052908160008201548152505090806004016040518060200160405290816000820154815250509080600501604051806020016040529081600082015481525050908060060160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905087565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146118fa576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016118f190613060565b60405180910390fd5b600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663a9059cbb82611944612183565b6040518363ffffffff1660e01b8152600401611961929190612f32565b602060405180830381600087803b15801561197b57600080fd5b505af115801561198f573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506119b39190810190612870565b5050565b60008082608001516000015114156119d25760019050611aba565b6119da612587565b600260060160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b158015611a4557600080fd5b505afa158015611a59573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250611a7d919081019061299d565b9050611a8761259a565b611a9f84604001518560600151866080015185610a0b565b9050806020015180611ab5575060008160000151145b925050505b919050565b60095481565b6000600260010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b611afa6125b6565b600b60008381526020019081526020016000206040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff166001811115611b8c57fe5b6001811115611b9757fe5b81526020016000820160159054906101000a900460ff166001811115611bb957fe5b6001811115611bc457fe5b815260200160018201604051806040016040529081600082015481526020016001820160009054906101000a900460ff161515151581525050815260200160038201604051806040016040529081600082015481526020016001820160009054906101000a900460ff161515151581525050815250509050919050565b611c49612587565b600260060160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b158015611cb457600080fd5b505afa158015611cc8573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250611cec919081019061299d565b905090565b611cf961259a565b6040518060400160405280611dba600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166370a08231866040518263ffffffff1660e01b8152600401611d659190612ec4565b60206040518083038186803b158015611d7d57600080fd5b505afa158015611d91573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250611db59190810190612a18565b61224c565b6fffffffffffffffffffffffffffffffff168152602001600115158152509050919050565b611de7612587565b6040518060200160405280670de0b6b3a7640000815250905090565b611e0b612587565b6040518060200160405280611e2d84866000015161212e90919063ffffffff16565b815250905092915050565b611e40612587565b6040518060200160405280611e628486600001516122af90919063ffffffff16565b815250905092915050565b611e75612587565b6040518060200160405280611e9b85600001518560000151670de0b6b3a76400006122f9565b815250905092915050565b611f3c81604051602401611eba9190613000565b6040516020818303038152906040527f41304fac000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19166020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff8381831617835250505050612329565b50565b611fd9838383604051602401611f5793929190613022565b6040516020818303038152906040527f291bb9d0000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19166020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff8381831617835250505050612329565b505050565b611fe661259a565b826020015161202457604051806040016040528061201185600001518561212e90919063ffffffff16565b8152602001600015158152509050612096565b81836000015111156120655760405180604001604052806120528486600001516122af90919063ffffffff16565b8152602001600115158152509050612096565b60405180604001604052806120878560000151856122af90919063ffffffff16565b81526020016000151581525090505b92915050565b60006120b5838360000151670de0b6b3a76400006122f9565b905092915050565b60006120d683670de0b6b3a764000084600001516122f9565b905092915050565b6120e661259a565b81602001511561210e5761210782600001518461235290919063ffffffff16565b9050612128565b612125826000015184611fde90919063ffffffff16565b90505b92915050565b600080828401905083811015612179576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161217090613080565b60405180910390fd5b8091505092915050565b6000612247600a54600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b81526004016121e99190612ec4565b60206040518083038186803b15801561220157600080fd5b505afa158015612215573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506122399190810190612a18565b6122af90919063ffffffff16565b905090565b60008082905082816fffffffffffffffffffffffffffffffff16146122a6576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161229d906130a0565b60405180910390fd5b80915050919050565b60006122f183836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f770000815250612411565b905092915050565b600061232082612312858761246c90919063ffffffff16565b6124dc90919063ffffffff16565b90509392505050565b60008151905060006a636f6e736f6c652e6c6f679050602083016000808483855afa5050505050565b61235a61259a565b82602001511561239957604051806040016040528061238685600001518561212e90919063ffffffff16565b815260200160011515815250905061240b565b81836000015110156123da5760405180604001604052806123c78560000151856122af90919063ffffffff16565b815260200160011515815250905061240b565b60405180604001604052806123fc8486600001516122af90919063ffffffff16565b81526020016000151581525090505b92915050565b6000838311158290612459576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016124509190613000565b60405180910390fd5b5060008385039050809150509392505050565b60008083141561247f57600090506124d6565b600082840290508284828161249057fe5b04146124d1576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016124c8906130c0565b60405180910390fd5b809150505b92915050565b600061251e83836040518060400160405280601a81526020017f536166654d6174683a206469766973696f6e206279207a65726f000000000000815250612526565b905092915050565b6000808311829061256d576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016125649190613000565b60405180910390fd5b50600083858161257957fe5b049050809150509392505050565b6040518060200160405280600081525090565b6040518060400160405280600081526020016000151581525090565b6040518060a00160405280600073ffffffffffffffffffffffffffffffffffffffff168152602001600060018111156125eb57fe5b8152602001600060018111156125fd57fe5b815260200161260a61261d565b815260200161261761261d565b81525090565b6040518060400160405280600081526020016000151581525090565b600081359050612648816133b9565b92915050565b60008135905061265d816133d0565b92915050565b600081519050612672816133d0565b92915050565b600081359050612687816133e7565b92915050565b60006020828403121561269f57600080fd5b6126a96020613167565b905060006126b98482850161281d565b60008301525092915050565b6000602082840312156126d757600080fd5b6126e16020613167565b905060006126f184828501612832565b60008301525092915050565b60006040828403121561270f57600080fd5b6127196040613167565b905060006127298482850161281d565b600083015250602061273d8482850161264e565b60208301525092915050565b60006040828403121561275b57600080fd5b6127656040613167565b905060006127758482850161281d565b60008301525060206127898482850161264e565b60208301525092915050565b600060e082840312156127a757600080fd5b6127b160a0613167565b905060006127c184828501612639565b60008301525060206127d584828501612678565b60208301525060406127e984828501612678565b60408301525060606127fd848285016126fd565b60608301525060a0612811848285016126fd565b60808301525092915050565b60008135905061282c816133f7565b92915050565b600081519050612841816133f7565b92915050565b60006020828403121561285957600080fd5b600061286784828501612639565b91505092915050565b60006020828403121561288257600080fd5b600061289084828501612663565b91505092915050565b6000602082840312156128ab57600080fd5b60006128b984828501612678565b91505092915050565b60008060008060c085870312156128d857600080fd5b60006128e687828801612678565b94505060206128f787828801612749565b935050606061290887828801612749565b92505060a06129198782880161268d565b91505092959194509250565b60008060006060848603121561293a57600080fd5b600061294886828701612678565b93505060206129598682870161281d565b925050604061296a8682870161268d565b9150509250925092565b60006020828403121561298657600080fd5b60006129948482850161268d565b91505092915050565b6000602082840312156129af57600080fd5b60006129bd848285016126c5565b91505092915050565b600060e082840312156129d857600080fd5b60006129e684828501612795565b91505092915050565b600060208284031215612a0157600080fd5b6000612a0f8482850161281d565b91505092915050565b600060208284031215612a2a57600080fd5b6000612a3884828501612832565b91505092915050565b600080600060808486031215612a5657600080fd5b6000612a648682870161281d565b9350506020612a7586828701612678565b9250506040612a8686828701612749565b9150509250925092565b612a998161321a565b82525050565b612aa88161321a565b82525050565b612ab78161322c565b82525050565b612ac68161322c565b82525050565b612ad581613275565b82525050565b612ae481613275565b82525050565b612af381613299565b82525050565b612b0281613299565b82525050565b612b11816132bd565b82525050565b612b20816132bd565b82525050565b612b2f816132e1565b82525050565b612b3e816132e1565b82525050565b6000612b4f82613194565b612b59818561319f565b9350612b698185602086016132f3565b612b728161338e565b840191505092915050565b6000612b8a60198361319f565b91507f53746174653a206f6e6c7920636f72652063616e2063616c6c000000000000006000830152602082019050919050565b6000612bca601b8361319f565b91507f536166654d6174683a206164646974696f6e206f766572666c6f7700000000006000830152602082019050919050565b6000612c0a601c8361319f565b91507f4d6174683a20556e73616665206361737420746f2075696e74313238000000006000830152602082019050919050565b6000612c4a60218361319f565b91507f536166654d6174683a206d756c7469706c69636174696f6e206f766572666c6f60008301527f77000000000000000000000000000000000000000000000000000000000000006020830152604082019050919050565b602082016000820151612cb96000850182612ea6565b50505050565b602082016000820151612cd56000850182612ea6565b50505050565b602082016000808301549050612cf081613374565b612cfd6000860182612ea6565b5050505050565b60e082016000808301549050612d1981613326565b612d266000860182612acc565b5060018301549050612d378161335a565b612d446020860182612b08565b5060028301612d566040860182612cdb565b5060038301612d686060860182612cdb565b5060048301612d7a6080860182612cdb565b5060058301612d8c60a0860182612cdb565b5060068301549050612d9d81613340565b612daa60c0860182612aea565b5050505050565b604082016000820151612dc76000850182612ea6565b506020820151612dda6020850182612aae565b50505050565b604082016000820151612df66000850182612ea6565b506020820151612e096020850182612aae565b50505050565b604082016000820151612e256000850182612ea6565b506020820151612e386020850182612aae565b50505050565b60e082016000820151612e546000850182612a90565b506020820151612e676020850182612b26565b506040820151612e7a6040850182612b26565b506060820151612e8d6060850182612de0565b506080820151612ea060a0850182612de0565b50505050565b612eaf8161326b565b82525050565b612ebe8161326b565b82525050565b6000602082019050612ed96000830184612a9f565b92915050565b600060e082019050612ef46000830188612a9f565b612f016020830187612b35565b612f0e6040830186612b35565b612f1b6060830185612e0f565b612f2860a0830184612e0f565b9695505050505050565b6000604082019050612f476000830185612a9f565b612f546020830184612eb5565b9392505050565b6000602082019050612f706000830184612abd565b92915050565b6000602082019050612f8b6000830184612adb565b92915050565b600060e082019050612fa6600083018a612adb565b612fb36020830189612b17565b612fc06040830188612cbf565b612fcd6060830187612cbf565b612fda6080830186612cbf565b612fe760a0830185612cbf565b612ff460c0830184612af9565b98975050505050505050565b6000602082019050818103600083015261301a8184612b44565b905092915050565b6000606082019050818103600083015261303c8186612b44565b905061304b6020830185612abd565b6130586040830184612eb5565b949350505050565b6000602082019050818103600083015261307981612b7d565b9050919050565b6000602082019050818103600083015261309981612bbd565b9050919050565b600060208201905081810360008301526130b981612bfd565b9050919050565b600060208201905081810360008301526130d981612c3d565b9050919050565b60006020820190506130f56000830184612ca3565b92915050565b600060e0820190506131106000830184612d04565b92915050565b600060408201905061312b6000830184612db1565b92915050565b600060e0820190506131466000830184612e3e565b92915050565b60006020820190506131616000830184612eb5565b92915050565b6000604051905081810181811067ffffffffffffffff8211171561318a57600080fd5b8060405250919050565b600081519050919050565b600082825260208201905092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b60006132258261324b565b9050919050565b60008115159050919050565b6000819050613246826133ac565b919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b600061328082613287565b9050919050565b60006132928261324b565b9050919050565b60006132a4826132ab565b9050919050565b60006132b68261324b565b9050919050565b60006132c8826132cf565b9050919050565b60006132da8261324b565b9050919050565b60006132ec82613238565b9050919050565b60005b838110156133115780820151818401526020810190506132f6565b83811115613320576000848401525b50505050565b60006133396133348361339f565b6131b0565b9050919050565b600061335361334e8361339f565b6131d0565b9050919050565b600061336d6133688361339f565b6131f0565b9050919050565b60006133876133828361339f565b613210565b9050919050565b6000601f19601f8301169050919050565b60008160001c9050919050565b600281106133b657fe5b50565b6133c28161321a565b81146133cd57600080fd5b50565b6133d98161322c565b81146133e457600080fd5b50565b600281106133f457600080fd5b50565b6134008161326b565b811461340b57600080fd5b5056fe2a2a20537461746556312e63616c63756c617465436f6c6c61746572616c44656c7461202a2aa365627a7a72315820caa105d9497f3c9edc0573ee3fffd9033c57b6c8719a27082b6e8665e5887b9e6c6578706572696d656e74616cf564736f6c63430005100040";
}
