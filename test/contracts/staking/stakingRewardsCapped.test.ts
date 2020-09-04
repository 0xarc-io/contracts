import 'jest';

import { StakingRewards } from '@src/typings/StakingRewards';
import { TestToken } from '@src/typings/TestToken';
import simpleDescribe from '@test/helpers/simpleDescribe';
import { ITestContext } from '@test/helpers/simpleDescribe';
import { Wallet, ethers } from 'ethers';
import Token from '@src/utils/Token';
import { BigNumber, BigNumberish, Signature } from 'ethers/utils';
import ArcNumber from '@src/utils/ArcNumber';
import { StakingRewardsAccrualCapped, KYFV2, KYF } from '@src/typings';
import { AddressZero } from 'ethers/constants';
import { expectRevert } from '../../../src/utils/expectRevert';

let ownerWallet: Wallet;
let userWallet: Wallet;
let arcWallet: Wallet;
let distributionWallet: Wallet;
let otherWallet: Wallet;

jest.setTimeout(30000);

let stakingRewards: StakingRewardsAccrualCapped;
let stakingToken: TestToken;
let rewardToken: TestToken;

let kyfTranche1: KYFV2;
let kyfTranche2: KYFV2;

const BASE = new BigNumber(10).pow(18);

async function init(ctx: ITestContext): Promise<void> {
  ownerWallet = ctx.wallets[0];
  userWallet = ctx.wallets[1];
  arcWallet = ctx.wallets[2];
  distributionWallet = ctx.wallets[3];
  otherWallet = ctx.wallets[4];
}

simpleDescribe('StakingRewardsCapped', init, (ctx: ITestContext) => {
  beforeEach(async () => {
    stakingToken = await TestToken.deploy(ownerWallet, 'LINKUSD/USDC 50/50', 'BPT');
    rewardToken = await TestToken.deploy(ownerWallet, 'Arc Token', 'ARC');

    kyfTranche1 = await KYFV2.deploy(ownerWallet);
    kyfTranche2 = await KYFV2.deploy(ownerWallet);

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

  async function getContract(caller: Wallet) {
    return StakingRewardsAccrualCapped.at(caller, stakingRewards.address);
  }

  async function verifyUserIn(kyf: KYFV2, signature: Signature) {
    await kyf.verify(userWallet.address, signature.v, signature.r, signature.s);
  }

  async function approve(kyf: KYFV2) {
    await stakingRewards.setApprovedKYFInstance(kyf.address, true);
  }

  describe('#setStakeHardCap', () => {
    it('should not be able to set the hard cap as a non-owner', async () => {
      const contract = await getContract(otherWallet);
      await expectRevert(contract.setStakeHardCap(100));
    });

    it('should be able to set the hard cap as the owner', async () => {
      const contract = await getContract(ownerWallet);
      await contract.setStakeHardCap(100);
      expect(await (await contract.hardCap()).toNumber()).toEqual(100);
    });
  });

  describe('#setTokensClaimable', () => {
    it('should not be able to set the tokens as claimable as a non-owner', async () => {
      const contract = await getContract(otherWallet);
      await expectRevert(contract.setTokensClaimable(true));
    });

    it('should be able to make the tokens claimable by the owner', async () => {
      const contract = await getContract(ownerWallet);
      await contract.setTokensClaimable(true);
      expect(await contract.tokensClaimable()).toBeTruthy();
    });
  });

  describe('#setApprovedKYFInstance', () => {
    it('should not be able to set an instance as a non-owner', async () => {
      const contract = await getContract(otherWallet);
      await expectRevert(contract.setApprovedKYFInstance(kyfTranche1.address, true));
    });

    it('should able to set an instance as the owner', async () => {
      const contract = await getContract(ownerWallet);
      await contract.setApprovedKYFInstance(kyfTranche1.address, true);
      expect(await contract.kyfInstances(kyfTranche1.address)).toBeTruthy();
      expect((await contract.getApprovedKyfInstancesArray()).length).toEqual(1);
      expect(await contract.kyfInstancesArray(0)).toEqual(kyfTranche1.address);
    });

    it('should able to remove an instance as the owner', async () => {
      const contract = await getContract(ownerWallet);
      await contract.setApprovedKYFInstance(kyfTranche1.address, true);
      await contract.setApprovedKYFInstance(kyfTranche2.address, true);

      expect(await contract.kyfInstances(kyfTranche1.address)).toBeTruthy();
      expect(await contract.kyfInstances(kyfTranche2.address)).toBeTruthy();
      expect((await contract.getApprovedKyfInstancesArray()).length).toEqual(2);

      await contract.setApprovedKYFInstance(kyfTranche1.address, false);

      expect(await contract.kyfInstances(kyfTranche1.address)).toBeFalsy();
      expect(await contract.kyfInstances(kyfTranche2.address)).toBeTruthy();
      expect((await contract.getApprovedKyfInstancesArray()).length).toEqual(1);
      expect(await contract.kyfInstancesArray(0)).toEqual(kyfTranche2.address);
    });
  });

  describe('#stake', () => {
    let signature;

    beforeEach(async () => {
      await stakingRewards.setStakeHardCap(50);

      await kyfTranche1.setVerifier(ownerWallet.address);
      await kyfTranche1.setHardCap(10);
      await kyfTranche2.setVerifier(ownerWallet.address);
      await kyfTranche1.setHardCap(20);

      const hash = ethers.utils.solidityKeccak256(['address'], [userWallet.address]);
      const signedMessage = await ownerWallet.signMessage(ethers.utils.arrayify(hash));
      signature = ethers.utils.splitSignature(signedMessage);
    });

    it('should not be able to stake over the hard cap', async () => {
      await verifyUserIn(kyfTranche1, signature);
      await approve(kyfTranche1);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 51);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await expectRevert(userStaking.stake(51));
    });

    it('should not be able to stake over the hard cap in total', async () => {
      await verifyUserIn(kyfTranche1, signature);
      await approve(kyfTranche1);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 75);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 75);
      await userStaking.stake(25);
      await userStaking.stake(25);
      await expectRevert(userStaking.stake(25));
    });

    it('should not be able to staking without v1 verification', async () => {
      await approve(kyfTranche1);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await expectRevert(userStaking.stake(50));
    });

    it('should not be able to staking without v1 being added', async () => {
      await verifyUserIn(kyfTranche1, signature);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await expectRevert(userStaking.stake(50));
    });

    it('should not be able to staking without v2 verification', async () => {
      await verifyUserIn(kyfTranche1, signature);
      await approve(kyfTranche2);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await expectRevert(userStaking.stake(50));
    });

    it('should able to stake the hard cap', async () => {
      await verifyUserIn(kyfTranche1, signature);
      await approve(kyfTranche1);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await userStaking.stake(50);
      expect(await (await userStaking.balanceOf(userWallet.address)).toNumber()).toEqual(50);
    });

    it('should able to stake up to the hard cap', async () => {
      await verifyUserIn(kyfTranche1, signature);
      await approve(kyfTranche1);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await userStaking.stake(25);
      await userStaking.stake(25);
      expect(await (await userStaking.balanceOf(userWallet.address)).toNumber()).toEqual(50);
    });
  });

  describe('#getReward', () => {
    beforeEach(async () => {
      await stakingRewards.setStakeHardCap(50);

      await kyfTranche1.setVerifier(ownerWallet.address);
      await kyfTranche1.setHardCap(10);

      const hash = ethers.utils.solidityKeccak256(['address'], [userWallet.address]);
      const signedMessage = await ownerWallet.signMessage(ethers.utils.arrayify(hash));
      const signature = ethers.utils.splitSignature(signedMessage);

      await verifyUserIn(kyfTranche1, signature);
      await approve(kyfTranche1);

      await rewardToken.mintShare(stakingRewards.address, 100);
      await stakingRewards.notifyRewardAmount(100);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await userStaking.stake(50);

      // 100 Rewards, in half the time with the 100% stake == 50 tokens
      await ctx.evm.increaseTime(50);
      await ctx.evm.mineBlock();

      expect(
        await (await stakingRewards.earned(userWallet.address)).toNumber(),
      ).toBeGreaterThanOrEqual(new BigNumber(50).mul(2).div(3).toNumber());

      expect(
        await (await stakingRewards.earned(userWallet.address)).toNumber(),
      ).toBeLessThanOrEqual(new BigNumber(50).mul(2).div(3).add(3).toNumber());
    });

    it('should not be able to get the reward if the tokens are not claimable', async () => {
      const contract = await getContract(userWallet);
      await expectRevert(contract.getReward());
    });

    it('should be able to get the reward if the tokens are claimable', async () => {
      await stakingRewards.setTokensClaimable(true);
      const contract = await getContract(userWallet);
      await contract.getReward();

      expect(
        await (await rewardToken.balanceOf(userWallet.address)).toNumber(),
      ).toBeGreaterThanOrEqual(new BigNumber(50).mul(2).div(3).toNumber());

      expect(
        await (await rewardToken.balanceOf(userWallet.address)).toNumber(),
      ).toBeLessThanOrEqual(new BigNumber(50).mul(2).div(3).add(3).toNumber());
    });
  });
});
