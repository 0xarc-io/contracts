import { subtask, task } from 'hardhat/config';

task(
  'interact-d1',
  'Deploy, update and interact with D1 contracts',
).setAction(async (taskArgs) => {});

// @TODO: Scenarios to plan for:
//        - Deploying the entire stack
//        - Deploying a specific core version
//        - Deploying the state contract
//        - Transfering ownership to the rightful owner
//        - Print the proxy, core, collateral and synthetic addresses
//        - Getting verified on Etherscan
