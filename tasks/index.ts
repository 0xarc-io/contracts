import 'module-alias/register';

export * from './mozart-tasks';
export * from './spritz-tasks';
export * from './global-tasks';
export * from './ownership-tasks';
export * from './subgraph-tasks';
export * from './verify-contract-tasks';
export * from './staking-tasks';

import { task } from 'hardhat/config';

task('deploy-setup', 'Deploy all the smart contracts locally').setAction(async (taskArgs, hre) => {
  await hre.run('deploy-global');
  // await hre.run('deploy-spritz', { synth: 'LINKUSD' });
  await hre.run('deploy-mozart-synthetic', { name: 'STABLEx', symbol: 'STABLEx' });
  await hre.run('deploy-mozart', { synth: 'yUSD-STABLEx' });
  await hre.run('deploy-mozart-savings', { savings: 'STABLEx' });
  await hre.run('prepare-subgraph');
});
