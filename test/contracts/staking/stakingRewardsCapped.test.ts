import 'jest';

import { StakingRewards } from '@src/typings/StakingRewards';
import { TestToken } from '@src/typings/TestToken';
import simpleDescribe from '@test/helpers/simpleDescribe';
import { ITestContext } from '@test/helpers/simpleDescribe';
import { Wallet, ethers } from 'ethers';

import Token from '@src/utils/Token';

import { BigNumber, BigNumberish, Signature } from 'ethers/utils';
import { KYFV2, KYF } from '@src/typings';
import { AddressZero } from 'ethers/constants';
import { expectRevert } from '../../../src/utils/expectRevert';
import { TestArc } from '../../../src/TestArc';
import { MockStakingRewardsAccrualCapped } from '@src/typings/MockStakingRewardsAccrualCapped';

let ownerWallet: Wallet;
let userWallet: Wallet;
let arcWallet: Wallet;
let slasherWallet: Wallet;
let distributionWallet: Wallet;
let otherWallet: Wallet;

jest.setTimeout(30000);

let arc: TestArc;

let stakingRewards: MockStakingRewardsAccrualCapped;
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
  slasherWallet = ctx.wallets[5];
}

simpleDescribe('StakingRewardsCapped', init, (ctx: ITestContext) => {
  beforeEach(async () => {
    stakingToken = await TestToken.deploy(ownerWallet, 'LINKUSD/USDC 50/50', 'BPT');
    rewardToken = await TestToken.deploy(ownerWallet, 'Arc Token', 'ARC');

    kyfTranche1 = await KYFV2.deploy(ownerWallet);
    kyfTranche2 = await KYFV2.deploy(ownerWallet);

    arc = await TestArc.init(ownerWallet);
    await arc.deployTestArc();

    stakingRewards = await MockStakingRewardsAccrualCapped.awaitDeployment(
      ownerWallet,
      ownerWallet.address,
      distributionWallet.address,
      rewardToken.address,
      stakingToken.address,
      AddressZero,
    );

    await stakingRewards.setCurrentTimestamp(0);
    await stakingRewards.setStateContract(arc.state.address);
    await stakingRewards.setDebtRequirement(50);
    await stakingRewards.setRewardsDistribution(ownerWallet.address);
    await stakingRewards.setRewardsDuration(100);
  });

  async function getContract(caller: Wallet) {
    return MockStakingRewardsAccrualCapped.at(caller, stakingRewards.address);
  }

  async function verifyUserIn(kyf: KYFV2, address: string = userWallet.address) {
    const hash = ethers.utils.solidityKeccak256(['address'], [address]);
    const signedMessage = await ownerWallet.signMessage(ethers.utils.arrayify(hash));
    const signature = ethers.utils.splitSignature(signedMessage);
    await kyf.verify(address, signature.v, signature.r, signature.s);
  }

  async function approve(kyf: KYFV2) {
    await stakingRewards.setApprovedKYFInstance(kyf.address, true);
  }

  describe('#setDebtRequirement', () => {
    it('should not be able to set the ratio as a non-owner', async () => {
      const contract = await getContract(otherWallet);
      await expectRevert(contract.setDebtRequirement(100));
    });

    it('should be able to set the ratio as the owner', async () => {
      const contract = await getContract(ownerWallet);
      await contract.setDebtRequirement(100);
      expect(await (await contract.debtRequirement()).toNumber()).toEqual(100);
    });
  });

  describe('#setStateContract', () => {
    it('should not be able to set the hard cap as a non-owner', async () => {
      const contract = await getContract(otherWallet);
      await expectRevert(contract.setStateContract(otherWallet.address));
    });

    it('should be able to set the hard cap as the owner', async () => {
      const contract = await getContract(ownerWallet);
      await contract.setStateContract(ownerWallet.address);
      expect(await await contract.state()).toEqual(ownerWallet.address);
    });
  });

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
    let positionId: BigNumberish;

    beforeEach(async () => {
      await stakingRewards.setStakeHardCap(50);
      await stakingRewards.setDebtRequirement(50);

      await kyfTranche1.setVerifier(ownerWallet.address);
      await kyfTranche1.setHardCap(10);
      await kyfTranche2.setVerifier(ownerWallet.address);
      await kyfTranche1.setHardCap(20);

      const result = await arc._borrowSynthetic(50, 100, userWallet);
      positionId = result.params.id;
    });

    it('should not be able to stake over the hard cap', async () => {
      await verifyUserIn(kyfTranche1, userWallet.address);
      await approve(kyfTranche1);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 51);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);

      await expectRevert(userStaking.stake(51, positionId));
    });

    it('should not be able to stake over the hard cap in total', async () => {
      await verifyUserIn(kyfTranche1, userWallet.address);
      await approve(kyfTranche1);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 75);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 75);

      await userStaking.stake(25, positionId);
      await userStaking.stake(25, positionId);
      await expectRevert(userStaking.stake(25, positionId));
    });

    it('should not be able to staking without v1 verification', async () => {
      await approve(kyfTranche1);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await expectRevert(userStaking.stake(50, positionId));
    });

    it('should not be able to staking without v1 being added', async () => {
      await verifyUserIn(kyfTranche1, userWallet.address);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await expectRevert(userStaking.stake(50, positionId));
    });

    it('should not be able to staking without v2 verification', async () => {
      await verifyUserIn(kyfTranche1, userWallet.address);
      await approve(kyfTranche2);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await expectRevert(userStaking.stake(50, positionId));
    });

    it('should not able to stake with an invalid position', async () => {
      await verifyUserIn(kyfTranche1, userWallet.address);
      await approve(kyfTranche1);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await expectRevert(userStaking.stake(50, 90));
    });

    it('should not able to stake without enough debt', async () => {
      await verifyUserIn(kyfTranche1, userWallet.address);
      await approve(kyfTranche1);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);

      // To stake 50, you need at least $5 in debt (10 debt to stake ratio)
      await arc._repay(positionId, 9, 0, userWallet);
      await expectRevert(userStaking.stake(50, positionId));
    });

    it('should able to stake the hard cap', async () => {
      await verifyUserIn(kyfTranche1, userWallet.address);
      await approve(kyfTranche1);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await userStaking.stake(50, positionId);
      expect(await (await userStaking.balanceOf(userWallet.address)).toNumber()).toEqual(50);
    });

    it('should able to stake up to the hard cap', async () => {
      await verifyUserIn(kyfTranche1, userWallet.address);
      await approve(kyfTranche1);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await userStaking.stake(25, positionId);
      await userStaking.stake(25, positionId);
      expect(await (await userStaking.balanceOf(userWallet.address)).toNumber()).toEqual(50);
    });
  });

  describe('#slash', () => {
    let positionId: BigNumberish;
    let startingTime: number;

    const expectedReward = new BigNumber(100).mul(6).div(10);

    beforeEach(async () => {
      await stakingRewards.setStakeHardCap(50);

      await kyfTranche1.setVerifier(ownerWallet.address);
      await kyfTranche1.setHardCap(10);

      await verifyUserIn(kyfTranche1, userWallet.address);
      await verifyUserIn(kyfTranche1, slasherWallet.address);

      await approve(kyfTranche1);

      startingTime = await (
        await ownerWallet.provider.getBlock(await ownerWallet.provider.getBlockNumber())
      ).timestamp;

      await rewardToken.mintShare(stakingRewards.address, 100);
      await stakingRewards.notifyRewardAmount(100);
      await stakingRewards.setCurrentTimestamp(0);
      await stakingRewards.setDebtDeadline(200);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);

      // Give the slasher funds
      await arc._borrowSynthetic(60, 100, slasherWallet);

      const result = await arc._borrowSynthetic(60, 100, userWallet);
      positionId = result.params.id;
      await userStaking.stake(50, result.params.id);

      await stakingRewards.setCurrentTimestamp(150);

      expect(
        await (await stakingRewards.earned(userWallet.address)).toNumber(),
      ).toBeGreaterThanOrEqual(expectedReward.toNumber());

      await stakingRewards.setTokensClaimable(true);
    });

    it('should not be able to slash a user with enough debt', async () => {
      const contract = await getContract(slasherWallet);
      await arc.repay(positionId, 10, 0, userWallet);
      await expectRevert(contract.slash(userWallet.address));
    });

    it('should not be able to slash past the debt deadline', async () => {
      const contract = await getContract(slasherWallet);
      await arc.repay(positionId, 10, 0, userWallet);
      await stakingRewards.setCurrentTimestamp(200);
      await expectRevert(contract.slash(userWallet.address));
    });

    it('should not be able to slash as a non-kyf user', async () => {
      await kyfTranche1.remove(slasherWallet.address);

      const contract = await getContract(slasherWallet);
      await arc.repay(positionId, 20, 0, userWallet);
      await expectRevert(contract.slash(userWallet.address));
    });

    it('should be able to slash as a kyf user', async () => {
      const contract = await getContract(slasherWallet);
      await arc.repay(positionId, 20, 0, userWallet);
      await contract.slash(userWallet.address);
    });

    it('should be able to slash if the user does not have debt', async () => {
      const contract = await getContract(slasherWallet);
      // The sneaky user repays their debt
      await arc.repay(positionId, 20, 0, userWallet);

      const preSlashBalance = await stakingRewards.balanceOf(userWallet.address);

      // A good slasher catches them and slashes their balance
      await contract.slash(userWallet.address);

      const postSlashBlaance = await stakingRewards.balanceOf(userWallet.address);

      // We ensure that the user didn't actually lose any funds
      expect(preSlashBalance).toEqual(postSlashBlaance);

      // The slasher's earnings should be good
      expect(
        await (await stakingRewards.earned(slasherWallet.address)).toNumber(),
      ).toBeGreaterThanOrEqual(expectedReward.div(3).sub(1).toNumber());

      // The user should not have no earnings
      expect(await (await stakingRewards.earned(userWallet.address)).toNumber()).toEqual(0);

      // We now try to slash the user again
      await contract.slash(userWallet.address);
      await contract.getReward(slasherWallet.address);

      // The slasher should still be good
      expect(
        await (await rewardToken.balanceOf(slasherWallet.address)).toNumber(),
      ).toBeGreaterThanOrEqual(expectedReward.div(2).div(3).sub(1).toNumber());

      await stakingRewards.setCurrentTimestamp(200);

      // Let's make sure the slashed user doesnt lose their funds
      const userBalance = await stakingRewards.balanceOf(userWallet.address);
      await (await getContract(userWallet)).exit();
      await (await getContract(slasherWallet)).exit();

      expect(
        await (await rewardToken.balanceOf(slasherWallet.address)).toNumber(),
      ).toBeGreaterThanOrEqual(expectedReward.div(3).sub(1).toNumber());

      // Hooray, they got their funds back
      expect(await stakingToken.balanceOf(userWallet.address)).toEqual(userBalance);
    });
  });

  describe('#getReward', () => {
    let positionId: BigNumberish;

    beforeEach(async () => {
      await stakingRewards.setStakeHardCap(50);
      await stakingRewards.setCurrentTimestamp(0);
      await stakingRewards.setRewardsDuration(100);
      await stakingRewards.setDebtDeadline(200);

      await kyfTranche1.setVerifier(ownerWallet.address);
      await kyfTranche1.setHardCap(10);

      await verifyUserIn(kyfTranche1, userWallet.address);
      await verifyUserIn(kyfTranche1, slasherWallet.address);

      await approve(kyfTranche1);

      await rewardToken.mintShare(stakingRewards.address, 100);
      await stakingRewards.notifyRewardAmount(100);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);

      const result = await arc._borrowSynthetic(50, 100, userWallet);
      positionId = result.params.id;
      await userStaking.stake(50, result.params.id);
    });

    it('should not be able to get the reward if the tokens are not claimable', async () => {
      const contract = await getContract(userWallet);
      await expectRevert(contract.getReward(userWallet.address));
    });

    it('should be able to claim a portion of the rewards if the tokens are claimable but the debt deadline has not been met', async () => {
      await stakingRewards.setTokensClaimable(true);
      const contract = await getContract(userWallet);

      // Set the duration to be half way past the time period
      await stakingRewards.setCurrentTimestamp(150);

      // All of the tokens should be earned
      let earned = await contract.earned(userWallet.address);
      expect(earned.toNumber()).toBeGreaterThanOrEqual(
        new BigNumber(100).mul(6).div(10).toNumber(),
      );

      // Since we're now 1/2 past the debt deadline and 100% of the way through the reward
      // period we should be able to get 1/2 of the earned amount

      const balanceBefore = await rewardToken.balanceOf(userWallet.address);
      await stakingRewards.getReward(userWallet.address);

      let balanceAfter = await rewardToken.balanceOf(userWallet.address);
      expect(balanceAfter.toString()).toEqual(balanceBefore.add(earned.div(2)).toString());

      // Let's fast forward to the end of the debt deadline
      await stakingRewards.setCurrentTimestamp(200);
      await stakingRewards.getReward(userWallet.address);

      balanceAfter = await rewardToken.balanceOf(userWallet.address);
      expect(balanceAfter.toString()).toEqual(balanceBefore.add(earned).toString());
    });

    it('should be able to claim slashed rewards gradually over time as well', async () => {
      await stakingRewards.setTokensClaimable(true);

      // Ensure the user has earned all their tokens
      await stakingRewards.setCurrentTimestamp(150);
      const userEarnings = await stakingRewards.earned(userWallet.address);

      // Make them slashable by repaying all their debt
      await arc._repay(positionId, 50, 100, userWallet);

      // The slasher slashes and should have 1/3 of the rewards
      const slasherContract = await getContract(slasherWallet);
      await slasherContract.slash(userWallet.address);
      const slasherEarnings = userEarnings.div(3);
      expect(
        await (await stakingRewards.earned(slasherWallet.address)).toNumber(),
      ).toBeGreaterThanOrEqual(slasherEarnings.sub(1).toNumber());

      // Fast forward to the end debt requirement period
      await stakingRewards.setCurrentTimestamp(175);
      const beforeSlasherBalance = await rewardToken.balanceOf(slasherWallet.address);
      await stakingRewards.getReward(slasherWallet.address);

      let afterSlasherBalance = await rewardToken.balanceOf(slasherWallet.address);
      expect(afterSlasherBalance.toNumber()).toBeGreaterThanOrEqual(
        beforeSlasherBalance.add(slasherEarnings.mul(3).div(4)).sub(1).toNumber(),
      );

      // Fast forward to the end of the rewards period
      await stakingRewards.setCurrentTimestamp(200);
      await stakingRewards.getReward(slasherWallet.address);
      afterSlasherBalance = await rewardToken.balanceOf(slasherWallet.address);
      expect(afterSlasherBalance.toNumber()).toBeGreaterThanOrEqual(
        beforeSlasherBalance.add(slasherEarnings).sub(1).toNumber(),
      );
    });
  });
});
