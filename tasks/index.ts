import 'module-alias/register';

export * from './global-tasks';
export * from './ownership-tasks';
export * from './task-utils';
export * from './staking-tasks';
export * from './oracle-tasks';
export * from './waitlist-tasks';
export * from './sapphire-tasks';
export * from './utility-tasks';
export * from './passport-tasks';
export * from './distributor-tasks';

import { task } from 'hardhat/config';

task('deploy-setup', 'Deploy all the smart contracts locally').setAction(
  async (taskArgs, hre) => {
    await hre.run('deploy-global');
  },
);
