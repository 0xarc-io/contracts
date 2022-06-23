import { BaseERC20, SapphireAssessor, SapphirePool } from '@src/typings';
import { ISapphireOracle } from '@src/typings/ISapphireOracle';

export type CoreContracts<T> = {
  core: T;
  oracle: ISapphireOracle;
  collateral: BaseERC20;
  pool: SapphirePool;
  assessor: SapphireAssessor;
};
