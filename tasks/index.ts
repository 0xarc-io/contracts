import 'module-alias/register';

export * from './global-tasks';
export * from './ownership-tasks';
export * from './subgraph-tasks';
export * from './verify-contract-tasks';
export * from './oracle-tasks';
export * from './waitlistBatch-tasks';

import { task } from 'hardhat/config';

task('deploy-setup', 'Deploy all the smart contracts locally').setAction(
  async (taskArgs, hre) => {
    await hre.run('deploy-global');
    await hre.run('prepare-subgraph');
  },
);
