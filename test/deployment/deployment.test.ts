import fs from 'fs';
import path from 'path';

import { toWei, isAddress } from 'web3-utils';
import { asyncForEach } from '@src/utils/asyncForEach';
import {
  ArcxToken,
  AddressAccrual,
  ArcProxy,
  CoreV1,
  StateV1,
  SyntheticToken,
  StakingRewards,
  TokenStakingAccrual,
  StakingRewardAccrual,
} from '@src/typings';
import { generatedWallets } from '../../src/utils/generatedWallets';
import { ethers } from 'ethers';
import { AddressZero } from 'ethers/constants';
import { SynthRegistry } from '@src/typings';

require('dotenv').config();

const { loadConnections } = require('../../publish/src/util');
const { toBytes32, wrap, networks } = require('../..');

describe('deployments', () => {
  networks
    .filter((n) => n !== 'local')
    .forEach((network) => {
      describe(network, () => {
        const { getTarget, getSource, getStakingRewards, getSynths } = wrap({ network, fs, path });

        // we need this outside the test runner in order to generate tests per contract name
        const targets = getTarget();
        const sources = getSource();
        const stakingRewards = getStakingRewards();

        if (Object.keys(targets).length == 0) {
          return;
        }

        const getContract = (name) => {
          if (targets[name]) {
            return targets[name].address;
          }

          return AddressZero;
        };

        const connections = loadConnections({
          network,
          useFork: network == 'local',
        });

        const provider = new ethers.providers.JsonRpcProvider(connections.providerUrl);
        const wallet = new ethers.Wallet(connections.privateKey, provider);

        const intendedOwner = wallet.address;
        const intendedRewarder = wallet.address;
        let contracts = {
          arcxToken: ArcxToken.at(wallet, getContract('ArcxToken')),
          arcDAO: AddressAccrual.at(wallet, getContract('ArcDAO')),
          synthRegistry: SynthRegistry.at(wallet, getContract('SynthRegistry')),
        };

        describe('deployment.json', () => {
          it('should have the correct owners', async () => {
            expect(await contracts.arcxToken.owner()).toEqual(intendedOwner);
            expect(await contracts.arcDAO.owner()).toEqual(intendedOwner);
          });
        });

        const targetValues = Object.entries(targets);

        describe('synths.json', () => {
          targetValues
            .filter(([rootKey, rootValue]) => Object.keys(rootValue['dependencies']).length > 0)
            .forEach(([rootKey, rootValue]: [any, any]) => {
              const dependencies = rootValue.dependencies;

              const synthProxy = ArcProxy.at(wallet, rootValue.address);
              const coreV1 = CoreV1.at(wallet, synthProxy.address);
              const stateV1 = StateV1.at(wallet, dependencies.StateV1.address);
              const syntheticToken = SyntheticToken.at(wallet, dependencies.SyntheticToken.address);

              it('should be added to the synth registry proxy', async () => {
                const synthValue = await contracts.synthRegistry.synthsByAddress(
                  syntheticToken.address,
                );

                expect(synthValue.proxyAddress).toEqual(synthProxy.address);
                expect(synthValue.syntheticAddress).toEqual(syntheticToken.address);

                // @TODO: Make this more accurate
                expect(synthValue.symbolKey).not.toEqual(AddressZero);
              });

              it('should have the correct proxy configuration', async () => {
                expect(await coreV1.getAdmin()).toEqual(intendedOwner);
                expect(await coreV1.state()).toEqual(stateV1.address);
              });

              it('should have the correct owners set', async () => {
                expect(await stateV1.admin()).toEqual(intendedOwner);
                expect(await stateV1.core()).toEqual(synthProxy.address);
                expect(await syntheticToken.arcAddress()).toEqual(synthProxy.address);
              });

              it('should have the correct state addresses', async () => {
                expect(await stateV1.oracle()).toEqual(dependencies.Oracle.address);
                expect(await stateV1.syntheticAsset()).toEqual(dependencies.SyntheticToken.address);
                expect(await stateV1.collateralAsset()).toEqual(
                  dependencies.CollateralToken.address,
                );
              });
            });
        });

        describe('rewards.json', () => {
          for (const { name, type, stakingToken, rewardsToken, accrualToken } of stakingRewards) {
            it(`${name} has valid staking, reward tokens and owner`, async () => {
              const stakingRewardsName = `StakingRewards-${name}`;
              const stakingRewardsContractAddress = getContract(stakingRewardsName);

              if (stakingRewardsContractAddress == AddressZero) {
                return;
              }

              expect(stakingRewardsContractAddress).not.toBeNull();

              if (type == 'StakingRewardAccrual') {
                const stakingRewardsContract = StakingRewardAccrual.at(
                  wallet,
                  stakingRewardsContractAddress,
                );

                expect((await stakingRewardsContract.stakingToken()).toLowerCase()).toEqual(
                  stakingToken.toLowerCase(),
                );

                expect((await stakingRewardsContract.rewardsToken()).toLowerCase()).toEqual(
                  rewardsToken.toLowerCase(),
                );

                expect((await stakingRewardsContract.accrualToken()).toLowerCase()).toEqual(
                  accrualToken.toLowerCase(),
                );

                expect(await stakingRewardsContract.owner()).toEqual(intendedOwner);
                expect(await stakingRewardsContract.rewardsDistribution()).toEqual(
                  intendedRewarder,
                );
              }

              if (type == 'TokenStakingAccrual') {
                const stakingRewardsContract = TokenStakingAccrual.at(
                  wallet,
                  stakingRewardsContractAddress,
                );

                expect((await stakingRewardsContract.stakingToken()).toLowerCase()).toEqual(
                  stakingToken.toLowerCase(),
                );

                expect((await stakingRewardsContract.accrualToken()).toLowerCase()).toEqual(
                  stakingToken.toLowerCase(),
                );
              }
            });
          }
        });
      });
    });

  it('should pass if no tests are run', async () => {
    return true;
  });
});
