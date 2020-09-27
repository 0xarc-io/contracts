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
import { TestArc } from '../../../src/TestArc';

let ownerWallet: Wallet;
let userWallet: Wallet;
let arcWallet: Wallet;
let slasherWallet: Wallet;
let distributionWallet: Wallet;
let otherWallet: Wallet;

jest.setTimeout(30000);

let arc: TestArc;

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

    stakingRewards = await StakingRewardsAccrualCapped.awaitDeployment(
      ownerWallet,
      ownerWallet.address,
      distributionWallet.address,
      rewardToken.address,
      stakingToken.address,
      AddressZero,
    );

    await stakingRewards.setStateContract(arc.state.address);
    await stakingRewards.setDebtRequirement(50);
    await stakingRewards.setRewardsDistribution(ownerWallet.address);
    await stakingRewards.setRewardsDuration(100);
  });

  async function getContract(caller: Wallet) {
    return StakingRewardsAccrualCapped.at(caller, stakingRewards.address);
  }

  async function verifyUserIn(
    kyf: KYFV2,
    signature: Signature,
    address: string = userWallet.address,
  ) {
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
    let signature;
    let positionId: BigNumberish;

    beforeEach(async () => {
      await stakingRewards.setStakeHardCap(50);
      await stakingRewards.setDebtRequirement(50);

      await kyfTranche1.setVerifier(ownerWallet.address);
      await kyfTranche1.setHardCap(10);
      await kyfTranche2.setVerifier(ownerWallet.address);
      await kyfTranche1.setHardCap(20);

      const hash = ethers.utils.solidityKeccak256(['address'], [userWallet.address]);
      const signedMessage = await ownerWallet.signMessage(ethers.utils.arrayify(hash));
      signature = ethers.utils.splitSignature(signedMessage);

      const result = await arc._borrowSynthetic(50, 100, userWallet);
      positionId = result.params.id;
    });

    it('should not be able to stake over the hard cap', async () => {
      await verifyUserIn(kyfTranche1, signature);
      await approve(kyfTranche1);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 51);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);

      await expectRevert(userStaking.stake(51, positionId));
    });

    it('should not be able to stake over the hard cap in total', async () => {
      await verifyUserIn(kyfTranche1, signature);
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
      await verifyUserIn(kyfTranche1, signature);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await expectRevert(userStaking.stake(50, positionId));
    });

    it('should not be able to staking without v2 verification', async () => {
      await verifyUserIn(kyfTranche1, signature);
      await approve(kyfTranche2);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await expectRevert(userStaking.stake(50, positionId));
    });

    it('should not able to stake with an invalid position', async () => {
      await verifyUserIn(kyfTranche1, signature);
      await approve(kyfTranche1);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await expectRevert(userStaking.stake(50, 90));
    });

    it('should not able to stake without enough debt', async () => {
      await verifyUserIn(kyfTranche1, signature);
      await approve(kyfTranche1);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);

      // To stake 50, you need at least $5 in debt (10 debt to stake ratio)
      await arc._repay(positionId, 9, 0, userWallet);
      await expectRevert(userStaking.stake(50, positionId));
    });

    it('should able to stake the hard cap', async () => {
      await verifyUserIn(kyfTranche1, signature);
      await approve(kyfTranche1);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);
      await userStaking.stake(50, positionId);
      expect(await (await userStaking.balanceOf(userWallet.address)).toNumber()).toEqual(50);
    });

    it('should able to stake up to the hard cap', async () => {
      await verifyUserIn(kyfTranche1, signature);
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

    const expectedReward = new BigNumber(50).mul(2).div(3);

    beforeEach(async () => {
      await stakingRewards.setStakeHardCap(50);

      await kyfTranche1.setVerifier(ownerWallet.address);
      await kyfTranche1.setHardCap(10);

      const userHash = ethers.utils.solidityKeccak256(['address'], [userWallet.address]);
      const userSignedMessage = await ownerWallet.signMessage(ethers.utils.arrayify(userHash));
      const userSignature = ethers.utils.splitSignature(userSignedMessage);
      await verifyUserIn(kyfTranche1, userSignature);

      const slasherHash = ethers.utils.solidityKeccak256(['address'], [slasherWallet.address]);
      const slasherSignedMessage = await ownerWallet.signMessage(
        ethers.utils.arrayify(slasherHash),
      );
      const slasherSignature = ethers.utils.splitSignature(slasherSignedMessage);
      await verifyUserIn(kyfTranche1, slasherSignature, slasherWallet.address);

      await approve(kyfTranche1);

      startingTime = await (
        await ownerWallet.provider.getBlock(await ownerWallet.provider.getBlockNumber())
      ).timestamp;

      await rewardToken.mintShare(stakingRewards.address, 100);
      await stakingRewards.notifyRewardAmount(100);
      await stakingRewards.setDebtDeadline(startingTime + 200);

      const userStaking = await getContract(userWallet);
      await stakingToken.mintShare(userWallet.address, 50);
      await Token.approve(stakingToken.address, userWallet, stakingRewards.address, 50);

      // Give the slasher funds
      await arc._borrowSynthetic(50, 100, slasherWallet);

      const result = await arc._borrowSynthetic(50, 100, userWallet);
      positionId = result.params.id;
      await userStaking.stake(50, result.params.id);

      // 100 Rewards, in half the time with the 100% stake == 50 tokens
      await ctx.evm.increaseTime(50);
      await ctx.evm.mineBlock();

      expect(
        await (await stakingRewards.earned(userWallet.address)).toNumber(),
      ).toBeGreaterThanOrEqual(expectedReward.toNumber());

      await stakingRewards.setTokensClaimable(true);
    });

    it('should not be able to slash a user with enough debt', async () => {
      const contract = await getContract(slasherWallet);
      await arc.repay(positionId, 10, 0, userWallet);
      await ctx.evm.increaseTime(155);
      await ctx.evm.mineBlock();
      await expectRevert(contract.slash(userWallet.address));
    });

    // it.only('should not be able to slash past the debt deadline', async () => {
    //   const contract = await getContract(slasherWallet);
    //   await arc.repay(positionId, 10, 0, userWallet);
    //   await ctx.evm.increaseTime(155);
    //   await ctx.evm.mineBlock();
    //   await expectRevert(contract.slash(userWallet.address));
    // });

    // it.only('should be able to slash before the debt deadline', async () => {
    //   const contract = await getContract(slasherWallet);
    //   await arc.repay(positionId, 10, 0, userWallet);
    //   await ctx.evm.increaseTime(100);
    //   await ctx.evm.mineBlock();
    //   await contract.slash(userWallet.address);
    //   await contract.slash(userWallet.address);
    // });

    it('should not be able to slash as a non-kyf user', async () => {
      await kyfTranche1.remove(slasherWallet.address);
      const contract = await getContract(slasherWallet);
      await arc.repay(positionId, 10, 0, userWallet);
      await expectRevert(contract.slash(userWallet.address));
    });

    it('should be able to slash as a kyf user', async () => {
      const contract = await getContract(slasherWallet);
      await arc.repay(positionId, 10, 0, userWallet);
      await contract.slash(userWallet.address);
    });

    it('should be able to slash if the user removes their debt from the system', async () => {});

    it('should be able to slash if the user does not have debt', async () => {
      const contract = await getContract(slasherWallet);
      // The sneaky user repays their debt
      await arc.repay(positionId, 10, 0, userWallet);

      const preSlashBalance = await stakingRewards.balanceOf(userWallet.address);

      // A good slasher catches them and slashes their balance
      await contract.slash(userWallet.address);

      const postSlashBlaance = await stakingRewards.balanceOf(userWallet.address);

      // We ensure that the user didn't actually lose any funds
      expect(preSlashBalance).toEqual(postSlashBlaance);

      // The slasher's earnings should be good
      expect(
        await (await stakingRewards.earned(slasherWallet.address)).toNumber(),
      ).toBeGreaterThanOrEqual(expectedReward.toNumber());

      // The user should not have no earnings
      expect(await (await stakingRewards.earned(userWallet.address)).toNumber()).toEqual(0);

      // We now try to slash the user again
      await contract.slash(userWallet.address);
      await contract.getReward(slasherWallet.address);

      // The slasher should still be good
      expect(
        await (await rewardToken.balanceOf(slasherWallet.address)).toNumber(),
      ).toBeGreaterThanOrEqual(expectedReward.toNumber());

      // Let's make sure the slashed user doesnt lose their funds
      const userBalance = await stakingRewards.balanceOf(userWallet.address);
      await (await getContract(userWallet)).exit();

      // Hooray, they got their funds back
      expect(await stakingToken.balanceOf(userWallet.address)).toEqual(userBalance);
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

      const result = await arc._borrowSynthetic(50, 100, userWallet);
      await userStaking.stake(50, result.params.id);

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
      await expectRevert(contract.getReward(userWallet.address));
    });

    it('should be able to get the reward if the tokens are claimable', async () => {
      await stakingRewards.setTokensClaimable(true);
      const contract = await getContract(userWallet);
      await contract.getReward(userWallet.address);

      expect(
        await (await rewardToken.balanceOf(userWallet.address)).toNumber(),
      ).toBeGreaterThanOrEqual(new BigNumber(50).mul(2).div(3).toNumber());

      expect(
        await (await rewardToken.balanceOf(userWallet.address)).toNumber(),
      ).toBeLessThanOrEqual(new BigNumber(50).mul(2).div(3).add(3).toNumber());
    });
  });
});
