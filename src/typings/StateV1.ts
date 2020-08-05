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
    '[{"inputs":[{"internalType":"address","name":"_core","type":"address"},{"internalType":"address","name":"_admin","type":"address"},{"components":[{"internalType":"contract IERC20","name":"collateralAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"internalType":"struct Types.GlobalParams","name":"_globalParams","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"components":[{"internalType":"contract IERC20","name":"collateralAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"indexed":false,"internalType":"struct Types.GlobalParams","name":"updatedParams","type":"tuple"}],"name":"GlobalParamsUpdated","type":"event"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"supply","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"borrow","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateCollateralDelta","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateInverseAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"name":"calculateInverseRequired","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"calculateLiquidationPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"price","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"}],"name":"getAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getCurrentPrice","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"getPosition","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"getSupplyBalance","outputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getSyntheticAsset","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getcollateralAsset","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"position","type":"tuple"}],"name":"isCollateralized","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"params","outputs":[{"internalType":"contract IERC20","name":"collateralAsset","type":"address"},{"internalType":"contract ISyntheticToken","name":"syntheticAsset","type":"address"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"collateralRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"syntheticRatio","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"liquidationSpread","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"originationFee","type":"tuple"},{"internalType":"contract IOracle","name":"oracle","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"positionCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"positions","outputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"borrowedAmount","type":"tuple"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"removeExcessTokens","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"position","type":"tuple"}],"name":"savePosition","outputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"amount","type":"tuple"}],"name":"setAmount","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"ratio","type":"tuple"}],"name":"setCollateralRatio","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"spread","type":"tuple"}],"name":"setLiquidationSpread","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"_oracle","type":"address"}],"name":"setOracle","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"fee","type":"tuple"}],"name":"setOriginationFee","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"components":[{"internalType":"uint256","name":"value","type":"uint256"}],"internalType":"struct Decimal.D256","name":"ratio","type":"tuple"}],"name":"setSyntheticRatio","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupplied","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum Types.AssetType","name":"asset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"amount","type":"tuple"}],"name":"updatePositionAmount","outputs":[{"components":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"enum Types.AssetType","name":"collateralAsset","type":"uint8"},{"internalType":"enum Types.AssetType","name":"borrowedAsset","type":"uint8"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"collateralAmount","type":"tuple"},{"components":[{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bool","name":"isPositive","type":"bool"}],"internalType":"struct SignedMath.Int","name":"borrowedAmount","type":"tuple"}],"internalType":"struct Types.Position","name":"","type":"tuple"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"updateTotalSupplied","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]';
  public static Bytecode =
    "0x60806040523480156200001157600080fd5b50604051620039623803806200396283398181016040526200003791908101906200039b565b826000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555081600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555080600260008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160010160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060408201518160020160008201518160000155505060608201518160030160008201518160000155505060808201518160040160008201518160000155505060a08201518160050160008201518160000155505060c08201518160060160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055509050507f8c76ed4b51f8936a2cc3d76c5ca210ff17bd985fa4e446e121f71cca71407e09600260405162000219919062000524565b60405180910390a1505050620007d2565b6000815190506200023b8162000750565b92915050565b60008151905062000252816200076a565b92915050565b600081519050620002698162000784565b92915050565b60008151905062000280816200079e565b92915050565b6000602082840312156200029957600080fd5b620002a5602062000541565b90506000620002b78482850162000384565b60008301525092915050565b600060e08284031215620002d657600080fd5b620002e260e062000541565b90506000620002f48482850162000241565b60008301525060206200030a848285016200026f565b6020830152506040620003208482850162000286565b6040830152506060620003368482850162000286565b60608301525060806200034c8482850162000286565b60808301525060a0620003628482850162000286565b60a08301525060c0620003788482850162000258565b60c08301525092915050565b6000815190506200039581620007b8565b92915050565b60008060006101208486031215620003b257600080fd5b6000620003c2868287016200022a565b9350506020620003d5868287016200022a565b9250506040620003e886828701620002c3565b9150509250925092565b620003fd8162000653565b82525050565b6200040e816200067b565b82525050565b6200041f81620006a3565b82525050565b6020820160008083015490506200043c8162000725565b6200044b600086018262000513565b5050505050565b60e0820160008083015490506200046981620006cb565b620004786000860182620003f2565b50600183015490506200048b8162000707565b6200049a602086018262000414565b5060028301620004ae604086018262000425565b5060038301620004c2606086018262000425565b5060048301620004d6608086018262000425565b5060058301620004ea60a086018262000425565b5060068301549050620004fd81620006e9565b6200050c60c086018262000403565b5050505050565b6200051e8162000649565b82525050565b600060e0820190506200053b600083018462000452565b92915050565b6000604051905081810181811067ffffffffffffffff821117156200056557600080fd5b8060405250919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b6000620005e68262000629565b9050919050565b6000620005fa82620005d9565b9050919050565b60006200060e82620005d9565b9050919050565b60006200062282620005d9565b9050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b6000620006608262000667565b9050919050565b6000620006748262000629565b9050919050565b600062000688826200068f565b9050919050565b60006200069c8262000629565b9050919050565b6000620006b082620006b7565b9050919050565b6000620006c48262000629565b9050919050565b6000620006e2620006dc8362000743565b6200056f565b9050919050565b600062000700620006fa8362000743565b6200058f565b9050919050565b60006200071e620007188362000743565b620005af565b9050919050565b60006200073c620007368362000743565b620005cf565b9050919050565b60008160001c9050919050565b6200075b81620005d9565b81146200076757600080fd5b50565b6200077581620005ed565b81146200078157600080fd5b50565b6200078f8162000601565b81146200079b57600080fd5b50565b620007a98162000615565b8114620007b557600080fd5b50565b620007c38162000649565b8114620007cf57600080fd5b50565b61318080620007e26000396000f3fe608060405234801561001057600080fd5b50600436106101735760003560e01c80639f24d8ed116100de578063e043095a11610097578063e7a45f2e11610071578063e7a45f2e1461049e578063eb02c301146104bc578063eb91d37e146104ec578063f38e266a1461050a57610173565b8063e043095a14610434578063e2158c3914610450578063e7702d051461048057610173565b80639f24d8ed14610346578063b1d0b9f914610376578063b5fffc8f14610392578063bcaa0c55146103c2578063c742bd41146103f2578063cff0ab961461041057610173565b8063651fafe111610130578063651fafe11461025e5780636e830f4a1461027a5780637adbf973146102965780637c7c200a146102b257806396d7d7e1146102e257806399fbab881461031257610173565b80632626ab0814610178578063270f2588146101945780632863612b146101c45780634c2fbfc6146101f457806361718a7d14610210578063630fd0ac14610240575b600080fd5b610192600480360361018d91908101906126e1565b61053a565b005b6101ae60048036036101a99190810190612733565b610617565b6040516101bb9190612e7b565b60405180910390f35b6101de60048036036101d99190810190612606565b6107e0565b6040516101eb9190612e0f565b60405180910390f35b61020e600480360361020991908101906126e1565b61092d565b005b61022a6004803603610225919081019061262f565b610a0b565b6040516102379190612e45565b60405180910390f35b610248610aaf565b6040516102559190612e7b565b60405180910390f35b610278600480360361027391908101906126e1565b610ab5565b005b610294600480360361028f91908101906126e1565b610b93565b005b6102b060048036036102ab91908101906125b4565b610c71565b005b6102cc60048036036102c79190810190612692565b610d80565b6040516102d99190612e7b565b60405180910390f35b6102fc60048036036102f79190810190612692565b610dea565b6040516103099190612e45565b60405180910390f35b61032c6004803603610327919081019061275c565b610eb0565b60405161033d959493929190612c4c565b60405180910390f35b610360600480360361035b91908101906127ae565b610f7e565b60405161036d9190612e60565b60405180910390f35b610390600480360361038b919081019061275c565b611287565b005b6103ac60048036036103a791908101906127ae565b611334565b6040516103b99190612e60565b60405180910390f35b6103dc60048036036103d79190810190612606565b6115b3565b6040516103e99190612c31565b60405180910390f35b6103fa61162b565b6040516104079190612ce3565b60405180910390f35b610418611658565b60405161042b9796959493929190612cfe565b60405180910390f35b61044e600480360361044991908101906125b4565b611738565b005b61046a60048036036104659190810190612733565b611885565b6040516104779190612cc8565b60405180910390f35b61048861198d565b6040516104959190612e7b565b60405180910390f35b6104a6611993565b6040516104b39190612ce3565b60405180910390f35b6104d660048036036104d1919081019061275c565b6119c0565b6040516104e39190612e60565b60405180910390f35b6104f4611b0f565b6040516105019190612e0f565b60405180910390f35b610524600480360361051f91908101906125b4565b611bbf565b6040516105319190612e45565b60405180910390f35b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146105ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016105c190612d8f565b60405180910390fd5b8060028001600082015181600001559050507f8c76ed4b51f8936a2cc3d76c5ca210ff17bd985fa4e446e121f71cca71407e09600260405161060c9190612e2a565b60405180910390a150565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146106a8576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161069f90612d8f565b60405180910390fd5b600954905081600b6000600954815260200190815260200160002060008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160000160146101000a81548160ff0219169083600181111561072e57fe5b021790555060408201518160000160156101000a81548160ff0219169083600181111561075757fe5b02179055506060820151816001016000820151816000015560208201518160010160006101000a81548160ff02191690831515021790555050506080820151816003016000820151816000015560208201518160010160006101000a81548160ff0219169083151502179055505050905050600960008154809291906001019190505550919050565b6107e86122f4565b6107f06122f4565b6107f86122f4565b600260060160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b15801561086357600080fd5b505afa158015610877573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525061089b919081019061270a565b9050600060018111156108aa57fe5b8460018111156108b657fe5b14156108dc576108d56108c7611cad565b600260040160000154611cd1565b9150610917565b6001808111156108e857fe5b8460018111156108f457fe5b141561091657610913610905611cad565b600260040160000154611d06565b91505b5b6109218183611d3b565b91508192505050919050565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146109bd576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016109b490612d8f565b60405180910390fd5b806002600501600082015181600001559050507f8c76ed4b51f8936a2cc3d76c5ca210ff17bd985fa4e446e121f71cca71407e096002604051610a009190612e2a565b60405180910390a150565b610a13612307565b610a1b612307565b610a23612307565b60006001811115610a3057fe5b876001811115610a3c57fe5b1415610a5857610a5187866000015186610dea565b9050610a89565b600180811115610a6457fe5b876001811115610a7057fe5b1415610a8857610a8587866000015186610dea565b90505b5b610aa0816000015187611d7490919063ffffffff16565b91508192505050949350505050565b600a5481565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610b45576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610b3c90612d8f565b60405180910390fd5b806002600401600082015181600001559050507f8c76ed4b51f8936a2cc3d76c5ca210ff17bd985fa4e446e121f71cca71407e096002604051610b889190612e2a565b60405180910390a150565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610c23576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610c1a90612d8f565b60405180910390fd5b806002600301600082015181600001559050507f8c76ed4b51f8936a2cc3d76c5ca210ff17bd985fa4e446e121f71cca71407e096002604051610c669190612e2a565b60405180910390a150565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614610d01576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610cf890612d8f565b60405180910390fd5b80600260060160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055507f8c76ed4b51f8936a2cc3d76c5ca210ff17bd985fa4e446e121f71cca71407e096002604051610d759190612e2a565b60405180910390a150565b60008060006001811115610d9057fe5b856001811115610d9c57fe5b1415610db357610dac8484611e32565b9050610ddf565b600180811115610dbf57fe5b856001811115610dcb57fe5b1415610dde57610ddb8484611e53565b90505b5b809150509392505050565b610df2612307565b6000610dff858585610d80565b905060006001811115610e0e57fe5b856001811115610e1a57fe5b1415610e4a57610e43816002600301604051806020016040529081600082015481525050611e32565b9050610e8e565b600180811115610e5657fe5b856001811115610e6257fe5b1415610e8d57610e8a8160028001604051806020016040529081600082015481525050611e32565b90505b5b6040518060400160405280828152602001600115158152509150509392505050565b600b6020528060005260406000206000915090508060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060000160149054906101000a900460ff16908060000160159054906101000a900460ff169080600101604051806040016040529081600082015481526020016001820160009054906101000a900460ff1615151515815250509080600301604051806040016040529081600082015481526020016001820160009054906101000a900460ff161515151581525050905085565b610f86612323565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611015576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161100c90612d8f565b60405180910390fd5b6000600b6000868152602001908152602001600020905083600181111561103857fe5b8160000160149054906101000a900460ff16600181111561105557fe5b14156110d7576110a18382600101604051806040016040529081600082015481526020016001820160009054906101000a900460ff161515151581525050611e7490919063ffffffff16565b816001016000820151816000015560208201518160010160006101000a81548160ff02191690831515021790555090505061114f565b61111d8382600301604051806040016040529081600082015481526020016001820160009054906101000a900460ff161515151581525050611e7490919063ffffffff16565b816003016000820151816000015560208201518160010160006101000a81548160ff0219169083151502179055509050505b806040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff1660018111156111cf57fe5b60018111156111da57fe5b81526020016000820160159054906101000a900460ff1660018111156111fc57fe5b600181111561120757fe5b815260200160018201604051806040016040529081600082015481526020016001820160009054906101000a900460ff161515151581525050815260200160038201604051806040016040529081600082015481526020016001820160009054906101000a900460ff161515151581525050815250509150509392505050565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614611316576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161130d90612d8f565b60405180910390fd5b61132b81600a54611ec490919063ffffffff16565b600a8190555050565b61133c612323565b6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146113cb576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016113c290612d8f565b60405180910390fd5b6000600b600086815260200190815260200160002090508360018111156113ee57fe5b8160000160149054906101000a900460ff16600181111561140b57fe5b14156114485782816001016000820151816000015560208201518160010160006101000a81548160ff02191690831515021790555090505061147b565b82816003016000820151816000015560208201518160010160006101000a81548160ff0219169083151502179055509050505b806040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff1660018111156114fb57fe5b600181111561150657fe5b81526020016000820160159054906101000a900460ff16600181111561152857fe5b600181111561153357fe5b815260200160018201604051806040016040529081600082015481526020016001820160009054906101000a900460ff161515151581525050815260200160038201604051806040016040529081600082015481526020016001820160009054906101000a900460ff161515151581525050815250509150509392505050565b60008060018111156115c157fe5b8260018111156115cd57fe5b146115fd57600260010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16611624565b600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff165b9050919050565b6000600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b60028060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16908060010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169080600201604051806020016040529081600082015481525050908060030160405180602001604052908160008201548152505090806004016040518060200160405290816000820154815250509080600501604051806020016040529081600082015481525050908060060160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905087565b600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16146117c8576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016117bf90612d8f565b60405180910390fd5b600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663a9059cbb82611812611f19565b6040518363ffffffff1660e01b815260040161182f929190612c9f565b602060405180830381600087803b15801561184957600080fd5b505af115801561185d573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525061188191908101906125dd565b5050565b60008082608001516000015114156118a05760019050611988565b6118a86122f4565b600260060160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b15801561191357600080fd5b505afa158015611927573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525061194b919081019061270a565b9050611955612307565b61196d84604001518560600151866080015185610a0b565b9050806020015180611983575060008160000151145b925050505b919050565b60095481565b6000600260010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b6119c8612323565b600b60008381526020019081526020016000206040518060a00160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016000820160149054906101000a900460ff166001811115611a5a57fe5b6001811115611a6557fe5b81526020016000820160159054906101000a900460ff166001811115611a8757fe5b6001811115611a9257fe5b815260200160018201604051806040016040529081600082015481526020016001820160009054906101000a900460ff161515151581525050815260200160038201604051806040016040529081600082015481526020016001820160009054906101000a900460ff161515151581525050815250509050919050565b611b176122f4565b600260060160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166396a0e5e36040518163ffffffff1660e01b815260040160206040518083038186803b158015611b8257600080fd5b505afa158015611b96573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250611bba919081019061270a565b905090565b611bc7612307565b6040518060400160405280611c88600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166370a08231866040518263ffffffff1660e01b8152600401611c339190612c31565b60206040518083038186803b158015611c4b57600080fd5b505afa158015611c5f573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250611c839190810190612785565b611fe2565b6fffffffffffffffffffffffffffffffff168152602001600115158152509050919050565b611cb56122f4565b6040518060200160405280670de0b6b3a7640000815250905090565b611cd96122f4565b6040518060200160405280611cfb848660000151611ec490919063ffffffff16565b815250905092915050565b611d0e6122f4565b6040518060200160405280611d3084866000015161204590919063ffffffff16565b815250905092915050565b611d436122f4565b6040518060200160405280611d6985600001518560000151670de0b6b3a764000061208f565b815250905092915050565b611d7c612307565b8260200151611dba576040518060400160405280611da7856000015185611ec490919063ffffffff16565b8152602001600015158152509050611e2c565b8183600001511115611dfb576040518060400160405280611de884866000015161204590919063ffffffff16565b8152602001600115158152509050611e2c565b6040518060400160405280611e1d85600001518561204590919063ffffffff16565b81526020016000151581525090505b92915050565b6000611e4b838360000151670de0b6b3a764000061208f565b905092915050565b6000611e6c83670de0b6b3a7640000846000015161208f565b905092915050565b611e7c612307565b816020015115611ea457611e9d8260000151846120bf90919063ffffffff16565b9050611ebe565b611ebb826000015184611d7490919063ffffffff16565b90505b92915050565b600080828401905083811015611f0f576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611f0690612daf565b60405180910390fd5b8091505092915050565b6000611fdd600a54600260000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401611f7f9190612c31565b60206040518083038186803b158015611f9757600080fd5b505afa158015611fab573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250611fcf9190810190612785565b61204590919063ffffffff16565b905090565b60008082905082816fffffffffffffffffffffffffffffffff161461203c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161203390612dcf565b60405180910390fd5b80915050919050565b600061208783836040518060400160405280601e81526020017f536166654d6174683a207375627472616374696f6e206f766572666c6f77000081525061217e565b905092915050565b60006120b6826120a885876121d990919063ffffffff16565b61224990919063ffffffff16565b90509392505050565b6120c7612307565b8260200151156121065760405180604001604052806120f3856000015185611ec490919063ffffffff16565b8152602001600115158152509050612178565b818360000151101561214757604051806040016040528061213485600001518561204590919063ffffffff16565b8152602001600115158152509050612178565b604051806040016040528061216984866000015161204590919063ffffffff16565b81526020016000151581525090505b92915050565b60008383111582906121c6576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016121bd9190612d6d565b60405180910390fd5b5060008385039050809150509392505050565b6000808314156121ec5760009050612243565b60008284029050828482816121fd57fe5b041461223e576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161223590612def565b60405180910390fd5b809150505b92915050565b600061228b83836040518060400160405280601a81526020017f536166654d6174683a206469766973696f6e206279207a65726f000000000000815250612293565b905092915050565b600080831182906122da576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016122d19190612d6d565b60405180910390fd5b5060008385816122e657fe5b049050809150509392505050565b6040518060200160405280600081525090565b6040518060400160405280600081526020016000151581525090565b6040518060a00160405280600073ffffffffffffffffffffffffffffffffffffffff1681526020016000600181111561235857fe5b81526020016000600181111561236a57fe5b815260200161237761238a565b815260200161238461238a565b81525090565b6040518060400160405280600081526020016000151581525090565b6000813590506123b5816130e8565b92915050565b6000813590506123ca816130ff565b92915050565b6000815190506123df816130ff565b92915050565b6000813590506123f481613116565b92915050565b60006020828403121561240c57600080fd5b6124166020612e96565b905060006124268482850161258a565b60008301525092915050565b60006020828403121561244457600080fd5b61244e6020612e96565b9050600061245e8482850161259f565b60008301525092915050565b60006040828403121561247c57600080fd5b6124866040612e96565b905060006124968482850161258a565b60008301525060206124aa848285016123bb565b60208301525092915050565b6000604082840312156124c857600080fd5b6124d26040612e96565b905060006124e28482850161258a565b60008301525060206124f6848285016123bb565b60208301525092915050565b600060e0828403121561251457600080fd5b61251e60a0612e96565b9050600061252e848285016123a6565b6000830152506020612542848285016123e5565b6020830152506040612556848285016123e5565b604083015250606061256a8482850161246a565b60608301525060a061257e8482850161246a565b60808301525092915050565b60008135905061259981613126565b92915050565b6000815190506125ae81613126565b92915050565b6000602082840312156125c657600080fd5b60006125d4848285016123a6565b91505092915050565b6000602082840312156125ef57600080fd5b60006125fd848285016123d0565b91505092915050565b60006020828403121561261857600080fd5b6000612626848285016123e5565b91505092915050565b60008060008060c0858703121561264557600080fd5b6000612653878288016123e5565b9450506020612664878288016124b6565b9350506060612675878288016124b6565b92505060a0612686878288016123fa565b91505092959194509250565b6000806000606084860312156126a757600080fd5b60006126b5868287016123e5565b93505060206126c68682870161258a565b92505060406126d7868287016123fa565b9150509250925092565b6000602082840312156126f357600080fd5b6000612701848285016123fa565b91505092915050565b60006020828403121561271c57600080fd5b600061272a84828501612432565b91505092915050565b600060e0828403121561274557600080fd5b600061275384828501612502565b91505092915050565b60006020828403121561276e57600080fd5b600061277c8482850161258a565b91505092915050565b60006020828403121561279757600080fd5b60006127a58482850161259f565b91505092915050565b6000806000608084860312156127c357600080fd5b60006127d18682870161258a565b93505060206127e2868287016123e5565b92505060406127f3868287016124b6565b9150509250925092565b61280681612f49565b82525050565b61281581612f49565b82525050565b61282481612f5b565b82525050565b61283381612f5b565b82525050565b61284281612fa4565b82525050565b61285181612fa4565b82525050565b61286081612fc8565b82525050565b61286f81612fc8565b82525050565b61287e81612fec565b82525050565b61288d81612fec565b82525050565b61289c81613010565b82525050565b6128ab81613010565b82525050565b60006128bc82612ec3565b6128c68185612ece565b93506128d6818560208601613022565b6128df816130bd565b840191505092915050565b60006128f7601983612ece565b91507f53746174653a206f6e6c7920636f72652063616e2063616c6c000000000000006000830152602082019050919050565b6000612937601b83612ece565b91507f536166654d6174683a206164646974696f6e206f766572666c6f7700000000006000830152602082019050919050565b6000612977601c83612ece565b91507f4d6174683a20556e73616665206361737420746f2075696e74313238000000006000830152602082019050919050565b60006129b7602183612ece565b91507f536166654d6174683a206d756c7469706c69636174696f6e206f766572666c6f60008301527f77000000000000000000000000000000000000000000000000000000000000006020830152604082019050919050565b602082016000820151612a266000850182612c13565b50505050565b602082016000820151612a426000850182612c13565b50505050565b602082016000808301549050612a5d816130a3565b612a6a6000860182612c13565b5050505050565b60e082016000808301549050612a8681613055565b612a936000860182612839565b5060018301549050612aa481613089565b612ab16020860182612875565b5060028301612ac36040860182612a48565b5060038301612ad56060860182612a48565b5060048301612ae76080860182612a48565b5060058301612af960a0860182612a48565b5060068301549050612b0a8161306f565b612b1760c0860182612857565b5050505050565b604082016000820151612b346000850182612c13565b506020820151612b47602085018261281b565b50505050565b604082016000820151612b636000850182612c13565b506020820151612b76602085018261281b565b50505050565b604082016000820151612b926000850182612c13565b506020820151612ba5602085018261281b565b50505050565b60e082016000820151612bc160008501826127fd565b506020820151612bd46020850182612893565b506040820151612be76040850182612893565b506060820151612bfa6060850182612b4d565b506080820151612c0d60a0850182612b4d565b50505050565b612c1c81612f9a565b82525050565b612c2b81612f9a565b82525050565b6000602082019050612c46600083018461280c565b92915050565b600060e082019050612c61600083018861280c565b612c6e60208301876128a2565b612c7b60408301866128a2565b612c886060830185612b7c565b612c9560a0830184612b7c565b9695505050505050565b6000604082019050612cb4600083018561280c565b612cc16020830184612c22565b9392505050565b6000602082019050612cdd600083018461282a565b92915050565b6000602082019050612cf86000830184612848565b92915050565b600060e082019050612d13600083018a612848565b612d206020830189612884565b612d2d6040830188612a2c565b612d3a6060830187612a2c565b612d476080830186612a2c565b612d5460a0830185612a2c565b612d6160c0830184612866565b98975050505050505050565b60006020820190508181036000830152612d8781846128b1565b905092915050565b60006020820190508181036000830152612da8816128ea565b9050919050565b60006020820190508181036000830152612dc88161292a565b9050919050565b60006020820190508181036000830152612de88161296a565b9050919050565b60006020820190508181036000830152612e08816129aa565b9050919050565b6000602082019050612e246000830184612a10565b92915050565b600060e082019050612e3f6000830184612a71565b92915050565b6000604082019050612e5a6000830184612b1e565b92915050565b600060e082019050612e756000830184612bab565b92915050565b6000602082019050612e906000830184612c22565b92915050565b6000604051905081810181811067ffffffffffffffff82111715612eb957600080fd5b8060405250919050565b600081519050919050565b600082825260208201905092915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b6000612f5482612f7a565b9050919050565b60008115159050919050565b6000819050612f75826130db565b919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b6000612faf82612fb6565b9050919050565b6000612fc182612f7a565b9050919050565b6000612fd382612fda565b9050919050565b6000612fe582612f7a565b9050919050565b6000612ff782612ffe565b9050919050565b600061300982612f7a565b9050919050565b600061301b82612f67565b9050919050565b60005b83811015613040578082015181840152602081019050613025565b8381111561304f576000848401525b50505050565b6000613068613063836130ce565b612edf565b9050919050565b600061308261307d836130ce565b612eff565b9050919050565b600061309c613097836130ce565b612f1f565b9050919050565b60006130b66130b1836130ce565b612f3f565b9050919050565b6000601f19601f8301169050919050565b60008160001c9050919050565b600281106130e557fe5b50565b6130f181612f49565b81146130fc57600080fd5b50565b61310881612f5b565b811461311357600080fd5b50565b6002811061312357600080fd5b50565b61312f81612f9a565b811461313a57600080fd5b5056fea365627a7a72315820965d8af3a0cdf32ad298a4db1ba5e6e9b5dd90c5d55fede16769f880f4da799a6c6578706572696d656e74616cf564736f6c63430005100040";
}
