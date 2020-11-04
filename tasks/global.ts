import { subtask, task } from 'hardhat/config';

task(
  'interact-global',
  'Deploy, update and interact with global contracts',
).setAction(async (taskArgs) => {});

// @TODO: Scenarios to plan for:
//        - Deploying all the core contracts
//          - ARCX Token
//          - Synth Registry
//        - Deploying a new version of KYF
//        - Deploy a new KYF Token
//        - Adding a new contract to the synth registry
//        - Deploy a new Skillset Token
//        - Transfer ownership of any new token to the rightful owner
//        - Getting verified on Etherscan
