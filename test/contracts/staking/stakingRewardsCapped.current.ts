import 'jest';

import { StakingRewards } from '@src/typings/StakingRewards';
import { TestToken } from '@src/typings/TestToken';
import simpleDescribe from '@test/helpers/simpleDescribe';
import { ITestContext } from '@test/helpers/simpleDescribe';
import { Wallet } from 'ethers';
import Token from '@src/utils/Token';
import { BigNumber, BigNumberish } from 'ethers/utils';
import ArcNumber from '@src/utils/ArcNumber';
import { StakingRewardsAccrualCapped } from '@src/typings';
import { AddressZero } from 'ethers/constants';

let ownerWallet: Wallet;
let userWallet: Wallet;
let arcWallet: Wallet;
let distributionWallet: Wallet;

jest.setTimeout(30000);

let stakingRewards: StakingRewardsAccrualCapped;
let stakingToken: TestToken;
let rewardToken: TestToken;

const BASE = new BigNumber(10).pow(18);

async function init(ctx: ITestContext): Promise<void> {
  ownerWallet = ctx.wallets[0];
  userWallet = ctx.wallets[1];
  arcWallet = ctx.wallets[2];
  distributionWallet = ctx.wallets[3];
}

simpleDescribe('StakingRewardsCapped', init, (ctx: ITestContext) => {
  beforeEach(async () => {
    stakingToken = await TestToken.deploy(ownerWallet, 'LINKUSD/USDC 50/50', 'BPT');
    rewardToken = await TestToken.deploy(ownerWallet, 'Arc Token', 'ARC');

    stakingRewards = await StakingRewardsAccrualCapped.deploy(
      ownerWallet,
      ownerWallet.address,
      distributionWallet.address,
      rewardToken.address,
      stakingToken.address,
      AddressZero,
    );

    await stakingRewards.setRewardsDistribution(ownerWallet.address);
    await stakingRewards.setRewardsDuration(100);
  });

  describe('#setStakeHardCap', () => {
    it('should not be able to set the hard cap as a non-owner', async () => {});

    it('should be able to set the hard cap as the owner', async () => {});
  });

  describe('#setTokensClaimable', () => {
    it('should not be able to set the tokens as claimable as a non-owner', async () => {});

    it('should be able to make the tokens claimable by the owner', () => {});
  });

  describe('#setApprovedKYFInstance', () => {
    it('should not be able to set an instance as a non-owner', async () => {});

    it('should able to set an instance as the owner', async () => {});

    it('should able to remove an instance as the owner', async () => {});
  });

  describe('#stake', () => {
    it('should not be able to stake over the hard cap', async () => {});

    it('should not be able to stake over the hard cap in total', async () => {});

    it('should able to stake the hard cap', async () => {});

    it('should able to stake up to the hard cap', async () => {});
  });

  describe('#getReward', () => {
    it('should not be able to get the reward if the tokens are not claimable', async () => {});

    it('should be able to get the reward if the tokens are claimable', async () => {});
  });
});
