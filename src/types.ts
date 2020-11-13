import { BigNumber, BigNumberish } from 'ethers/utils';
import { Signer, Wallet } from 'ethers';
import { BASE } from './constants';

export type SynthAddressBook = {
  state?: string;
  proxy?: string;
  core?: string;
  syntheticToken?: string;
  oracle?: string;
  collateralAsset?: string;
};

export type DeploymentConfig = {
  owner: string;
  name: string;
  symbol: string;
  collateralAsset: string;
  oracle: string;
  chainlinkAggregator: string;
  collateralRatio: BigNumberish;
  liquidationUserFee: BigNumberish;
  liquidationArcFee: BigNumberish;
  collateralLimit: BigNumberish;
  syntheticAssetLimit: BigNumberish;
  positionCollateralMinimum: BigNumberish;
};

export type AddressBook = {
  arcToken?: string;
  kyf?: string;
  synthRegistry?: string;
};

export enum AssetType {
  Collateral,
  Synthetic,
}

export type Decimal = {
  value: BigNumberish;
};

export enum Operation {
  Open,
  Borrow,
  Repay,
  Liquidate,
  TransferOwnership,
}

export type Int = {
  sign: boolean;
  value: BigNumberish;
};

export type Position = {
  owner: string;
  collateralAmount: Int;
  borrowedAmount: Int;
};

export type OperationParams = {
  id: BigNumberish;
  amountOne: BigNumberish;
  amountTwo: BigNumberish;
  addressOne?: string;
};

export type ActionOperated = {
  operation: Operation;
  params: OperationParams;
  updatedPosition: Position;
};

export type GraphPosition = {
  id: BigNumberish;
  owner: string;
  synth: string;
  collateralAmountSign: Boolean;
  collateralAmountValue: BigNumberish;
  borrowedAmountSign: Boolean;
  borrowedAmountValue: BigNumberish;
};

export type MarketParams = {
  collateralRatio: Decimal;
  liquidationUserFee: Decimal;
  liquidationArcFee: Decimal;
};

export type RiskParams = {
  collateralLimit: BigNumberish;
  syntheticLimit: BigNumberish;
  positionCollateralMinimum: BigNumberish;
};

export type D2Fees = {
  liquidationUserFee: BigNumberish;
  liquidationArcRatio: BigNumberish;
};

export interface TransactionOverrides {
  nonce?: BigNumberish | Promise<BigNumberish>;
  gasLimit?: BigNumberish | Promise<BigNumberish>;
  gasPrice?: BigNumberish | Promise<BigNumberish>;
  value?: BigNumberish | Promise<BigNumberish>;
  chainId?: number | Promise<number>;
  from?: Signer;
}

declare module 'ethers/utils' {
  interface BigNumber {
    bigMul(value: BigNumberish): BigNumber;
    bigDiv(value: BigNumberish): BigNumber;
  }
}

BigNumber.prototype.bigMul = function (value: BigNumberish): BigNumber {
  return this.mul(value).div(BASE);
};

BigNumber.prototype.bigDiv = function (value: BigNumberish): BigNumber {
  return this.mul(BASE).div(value);
};
