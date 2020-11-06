import { subtask, task } from 'hardhat/config';

task(
  'interact-staking',
  'Deploy, update and interact with staking contracts',
).setAction(async (taskArgs) => {});

// @TODO: Scenarios to plan for:
//        - Deploying Proxy + Implementation
//        - Deploying AdminRewards
//        - Deploying RewardCampaign
//        - Calling init() on the contract
//        - Transfering ownership to the rightful owner
//        - Getting verified on Etherscan
