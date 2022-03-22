import { SapphireAssessor, SapphirePool } from '@src/typings';
import { IERC20 } from '@src/typings/IERC20';
import { IOracle } from '@src/typings/IOracle';

export type CoreContracts<T> = {
  core: T;
  oracle: IOracle;
  collateral: IERC20;
  pool: SapphirePool;
  assessor: SapphireAssessor;
};
