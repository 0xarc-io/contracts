import 'module-alias/register';

export * from './global-tasks';
export * from './oracle-tasks';
export * from './waitlist-tasks';
export * from './utility-tasks';
export * from './passport-tasks';

import { task } from 'hardhat/config';

task('deploy-setup', 'Deploy all the smart contracts locally').setAction(
  async (_, hre) => {
    await hre.run('deploy-global');
  },
);
