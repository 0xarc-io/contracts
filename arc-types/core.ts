import { SapphirePool, SyntheticTokenV2 } from '@src/typings';
import { IERC20 } from '@src/typings/IERC20';
import { IOracle } from '@src/typings/IOracle';

export enum Operation {
  Open,
  Borrow,
  Repay,
  Liquidate,
  TransferOwnership,
}

export type CoreContracts<T> = {
  core: T;
  oracle: IOracle;
  collateral: IERC20;
  synthetic: SyntheticTokenV2;
  pool: SapphirePool;
};
