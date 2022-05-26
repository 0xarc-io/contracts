import { SapphireAssessor, SapphirePool } from '@src/typings';
import { IERC20 } from '@src/typings/IERC20';
import { ISapphireOracle } from '@src/typings/ISapphireOracle';

export type CoreContracts<T> = {
  core: T;
  oracle: ISapphireOracle;
  collateral: IERC20;
  pool: SapphirePool;
  assessor: SapphireAssessor;
};
