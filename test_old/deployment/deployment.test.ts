// import fs from 'fs';
// import path from 'path';

// import { toWei, isAddress } from 'web3-utils';
// import { asyncForEach } from '@src/utils/asyncForEach';
// import {
//   ArcxToken,
//   AddressAccrual,
//   ArcProxy,
//   CoreV1,
//   StateV1,
//   SyntheticToken,
//   RewardCampaign,
//   TokenStakingAccrual,
// } from '@src/typings';

// import { ethers } from 'hardhat';
// import { AddressZero } from 'ethers/constants';
// import { SynthRegistry } from '@src/typings';
// import { getWaffleExpect } from '../helpers/testingUtils';

// require('dotenv').config();

// const { loadConnections } = require('../../publish/src/util');
// const { wrap, networks } = require('../../index');

// const expect = getWaffleExpect();

// describe('deployments', () => {
//   networks
//     .filter((n) => n !== 'local')
//     .forEach((network) => {
//       describe(network, () => {
//         const { getTarget, getSource, getStakingRewards, getSynths } = wrap({ network, fs, path });

//         // we need this outside the test runner in order to generate tests per contract name
//         const targets = getTarget();
//         const sources = getSource();
//         const stakingRewards = getStakingRewards();

//         if (Object.keys(targets).length == 0) {
//           return;
//         }

//         const getContract = (name) => {
//           if (targets[name]) {
//             return targets[name].address;
//           }

//           return AddressZero;
//         };

//         const connections = loadConnections({
//           network,
//           useFork: network == 'local',
//         });

//         const provider = new ethers.providers.JsonRpcProvider(connections.providerUrl);
//         const wallet = new ethers.Wallet(connections.privateKey, provider);

//         const intendedOwner = '0x62F31E08e279f3091d9755a09914DF97554eAe0b';
//         const intendedRewarder = '0x62F31E08e279f3091d9755a09914DF97554eAe0b';
//         let contracts = {
//           arcxToken: ArcxToken.at(wallet, getContract('ArcxToken')),
//           arcDAO: AddressAccrual.at(wallet, getContract('ArcDAO')),
//           synthRegistry: SynthRegistry.at(wallet, getContract('SynthRegistry')),
//         };

// describe('deployment.json', () => {
//   it('should have the correct owners', async () => {
//     expect(await contracts.arcxToken.owner()).to.equal(intendedOwner);
//     expect(await contracts.arcDAO.owner()).to.equal(intendedOwner);
//   });
// });

// const targetValues = Object.entries(targets);

// describe('synths.json', () => {
//   targetValues
//     .filter(([rootKey, rootValue]) => {
//       if (!rootValue.hasOwnProperty('dependencies')) {
//         return false;
//       }

//       return Object.keys(rootValue['dependencies']).length > 0;
//     })
//     .forEach(([rootKey, rootValue]: [any, any]) => {
//       const dependencies = rootValue.dependencies;
//       console.log(rootValue);

//       const synthProxy = ArcProxy.at(wallet, rootValue.address);
//       const coreV1 = CoreV1.at(wallet, synthProxy.address);
//       const stateV1 = StateV1.at(wallet, dependencies.StateV1.address);
//       const syntheticToken = SyntheticToken.at(wallet, dependencies.SyntheticToken.address);

//       it('should be added to the synth registry proxy', async () => {
//         const synthValue = await contracts.synthRegistry.synthsByAddress(
//           syntheticToken.address,
//         );

//         expect(synthValue.proxyAddress).to.equal(synthProxy.address);
//         expect(synthValue.syntheticAddress).to.equal(syntheticToken.address);

//         // @TODO: Make this more accurate
//         expect(synthValue.symbolKey).not.to.equal(AddressZero);
//       });

//       it('should have the correct configuration', async () => {
//         expect(await coreV1.getAdmin()).to.equal(intendedOwner);
//         expect(await coreV1.state()).to.equal(stateV1.address);
//         expect(await syntheticToken.isValidMinter(synthProxy.address)).to.be.true;
//         expect((await syntheticToken.getAllMinters()).length).to.equal(1);
//       });

//       it('should have the correct owners set', async () => {
//         expect(await stateV1.owner()).to.equal(intendedOwner);
//         expect(await stateV1.core()).to.equal(synthProxy.address);
//         expect(await syntheticToken.owner()).to.equal(intendedOwner);
//       });

//       it('should have the correct state addresses', async () => {
//         expect(await stateV1.oracle()).to.equal(dependencies.Oracle.address);
//         expect(await stateV1.syntheticAsset()).to.equal(
//           dependencies.SyntheticToken.address,
//         );
//         expect(await stateV1.collateralAsset()).to.equal(
//           dependencies.CollateralToken.address,
//         );
//       });
//     });
// });

// describe('rewards.json', () => {
//   for (const { name, type, stakingToken, rewardsToken, accrualToken } of stakingRewards) {
//     it(`${name} has valid staking, reward tokens and owner`, async () => {
//       const stakingRewardsName = `StakingRewards-${name}`;
//       const stakingRewardsContractAddress = getContract(stakingRewardsName);

//       if (stakingRewardsContractAddress == AddressZero) {
//         return;
//       }

//       expect(stakingRewardsContractAddress).not.to.be.null;

//       if (type == 'RewardCampaign') {
//         const stakingRewardsContract = RewardCampaign.at(
//           wallet,
//           stakingRewardsContractAddress,
//         );

//         expect((await stakingRewardsContract.stakingToken()).toLowerCase()).to.equal(
//           stakingToken.toLowerCase(),
//         );

//         expect((await stakingRewardsContract.rewardsToken()).toLowerCase()).to.equal(
//           rewardsToken.toLowerCase(),
//         );

//         expect((await stakingRewardsContract.accrualToken()).toLowerCase()).to.equal(
//           accrualToken.toLowerCase(),
//         );

//         expect(await stakingRewardsContract.owner()).to.equal(intendedOwner);
//         expect(await stakingRewardsContract.rewardsDistribution()).to.equal(
//           intendedRewarder,
//         );
//       }

//       if (type == 'TokenStakingAccrual') {
//         const stakingRewardsContract = TokenStakingAccrual.at(
//           wallet,
//           stakingRewardsContractAddress,
//         );

//         expect((await stakingRewardsContract.stakingToken()).toLowerCase()).to.equal(
//           stakingToken.toLowerCase(),
//         );

//         expect((await stakingRewardsContract.accrualToken()).toLowerCase()).to.equal(
//           stakingToken.toLowerCase(),
//         );
//       }
//     });
// }
// });
//       });
//     });

//   it('should pass if no tests are run', async () => {
//     return true;
//   });
// });
