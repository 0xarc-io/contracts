import 'jest';

import { TestToken } from '@src/typings/TestToken';
import simpleDescribe from '@test/helpers/simpleDescribe';
import { ITestContext } from '@test/helpers/simpleDescribe';
import { ethers, Wallet } from 'ethers';
import Token from '@src/utils/Token';
import { BigNumber, BigNumberish } from 'ethers/utils';
import ArcNumber from '@src/utils/ArcNumber';
import { TokenStakingAccrual } from '@src/typings/TokenStakingAccrual';
import { expectRevert } from '@src/utils/expectRevert';
import { ArcProxy, KYFV2, MockRewardCampaign } from '@src/typings';
import { TestArc } from '../../../src/TestArc';
import ArcDecimal from '../../../src/utils/ArcDecimal';
import { Test } from 'mocha';
import { Zero } from 'ethers/constants';

let ownerWallet: Wallet;
let userWallet: Wallet;
let slasherWallet: Wallet;
let distributionWallet: Wallet;

jest.setTimeout(30000);

let arc: TestArc;
let stakingRewards: MockRewardCampaign;

let stakingToken: TestToken;
let rewardToken: TestToken;

let kyfTranche1: KYFV2;
let kyfTranche2: KYFV2;

const BASE = new BigNumber(10).pow(18);

async function init(ctx: ITestContext): Promise<void> {
  ownerWallet = ctx.wallets[0];
  userWallet = ctx.wallets[1];
  slasherWallet = ctx.wallets[2];
  distributionWallet = ctx.wallets[3];
}

simpleDescribe('RewardCampaign', init, (ctx: ITestContext) => {
  const DAO_ALLOCATION = ArcDecimal.new(0.4);
  const SLAHSER_CUT = ArcDecimal.new(0.3);
  const USER_ALLOCATION = ArcDecimal.new(1).value.sub(DAO_ALLOCATION.value);
  const DEBT_TO_STAKE = 2;
  const REWARDS_END_DATE = 100;
  const VESTING_END_DATE = 200;
  const HARD_CAP = ArcNumber.new(2100);
  const REWARD_AMOUNT = ArcNumber.new(100);
  const DEBT_AMOUNT = HARD_CAP.div(DEBT_TO_STAKE);

  async function setup() {
    stakingToken = await TestToken.deploy(ownerWallet, 'LINKUSD/USDC 50/50', 'BPT');
    rewardToken = await TestToken.deploy(ownerWallet, 'Arc Token', 'ARC');

    kyfTranche1 = await KYFV2.deploy(ownerWallet);
    kyfTranche2 = await KYFV2.deploy(ownerWallet);

    arc = await TestArc.init(ownerWallet);
    await arc.deployTestArc();

    stakingRewards = await MockRewardCampaign.awaitDeployment(
      ownerWallet,
      ownerWallet.address,
      distributionWallet.address,
      rewardToken.address,
      stakingToken.address,
    );

    stakingRewards = await MockRewardCampaign.at(
      ownerWallet,
      (await ArcProxy.deploy(ownerWallet, stakingRewards.address, ownerWallet.address, [])).address,
    );

    await rewardToken.mintShare(stakingRewards.address, REWARD_AMOUNT);

    await stakingRewards.setCurrentTimestamp(0);
    await stakingRewards.setRewardsDistributor(ownerWallet.address);
    await stakingRewards.setRewardsDuration(REWARDS_END_DATE);

    await stakingRewards.init(
      ownerWallet.address,
      ownerWallet.address,
      rewardToken.address,
      stakingToken.address,
      DAO_ALLOCATION,
      SLAHSER_CUT,
      arc.state.address,
      VESTING_END_DATE,
      DEBT_TO_STAKE,
      HARD_CAP,
    );

    await kyfTranche1.setVerifier(ownerWallet.address);
    await kyfTranche1.setHardCap(10);
    await kyfTranche2.setVerifier(ownerWallet.address);
    await kyfTranche2.setHardCap(10);

    await stakingRewards.notifyRewardAmount(REWARD_AMOUNT);
  }

  /* ========== Helpers ========== */

  async function getContract(caller: Wallet) {
    return MockRewardCampaign.at(caller, stakingRewards.address);
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

  async function mint(amount: BigNumberish, wallet: Wallet) {
    await stakingToken.mintShare(wallet.address, amount);
    await Token.approve(
      stakingToken.address,
      wallet,
      stakingRewards.address,
      new BigNumber(amount).mul(10),
    );
  }

  async function stake(amount: BigNumberish, id: BigNumberish, wallet: Wallet) {
    const userStaking = await getContract(wallet);
    await userStaking.stake(amount, id);
  }

  async function slash(user: string, wallet: Wallet) {
    const slasherStaking = await getContract(wallet);
    await slasherStaking.slash(user);
  }

  async function getReward(wallet: Wallet) {
    const userStaking = await getContract(wallet);
    await userStaking.getReward(wallet.address);
  }

  /* ========== Public fuctions ========== */

  describe('#stake', () => {
    let positionId: BigNumberish;
    let altPositionId: BigNumberish;

    beforeEach(setup);

    beforeEach(async () => {
      const result1 = await arc._borrowSynthetic(DEBT_AMOUNT, DEBT_AMOUNT, userWallet);
      positionId = result1.params.id;

      const result2 = await arc._borrowSynthetic(DEBT_AMOUNT, DEBT_AMOUNT, slasherWallet);
      altPositionId = result2.params.id;
    });

    it('should not be able to stake over the hard cap', async () => {
      await verifyUserIn(kyfTranche1, userWallet.address);
      await approve(kyfTranche1);
      await mint(HARD_CAP.add(1), userWallet);
      await expectRevert(stake(HARD_CAP.add(1), positionId, userWallet));
    });

    it('should not be able to stake over the hard cap in total', async () => {
      await verifyUserIn(kyfTranche1, userWallet.address);
      await approve(kyfTranche1);
      await mint(HARD_CAP.mul(3), userWallet);
      await stake(HARD_CAP, positionId, userWallet);
      await expectRevert(stake(HARD_CAP, positionId, userWallet));
    });

    it('should not be able to stake without being verified', async () => {
      await approve(kyfTranche1);
      await mint(HARD_CAP, userWallet);
      await expectRevert(stake(HARD_CAP, positionId, userWallet));
    });

    it('should not be able to stake without a valid debt position owned by the same user', async () => {
      await verifyUserIn(kyfTranche1, userWallet.address);
      await approve(kyfTranche1);
      await mint(HARD_CAP, userWallet);
      await expectRevert(stake(HARD_CAP, altPositionId, userWallet));
    });

    it('should not be able to stake 1/2 of the hard cap with less than 1/2 the debt', async () => {
      await verifyUserIn(kyfTranche1, userWallet.address);
      await approve(kyfTranche1);
      await mint(HARD_CAP, userWallet);

      const newPosition = await arc._borrowSynthetic(DEBT_AMOUNT.div(2), DEBT_AMOUNT, userWallet);
      await expectRevert(stake(HARD_CAP, newPosition.params.id, userWallet));
    });

    it('should be able to stake 1/2 of the hard cap with 1/2 the debt', async () => {
      await verifyUserIn(kyfTranche1, userWallet.address);
      await approve(kyfTranche1);
      await mint(HARD_CAP.div(2), userWallet);

      const newPosition = await arc._borrowSynthetic(DEBT_AMOUNT.div(2), DEBT_AMOUNT, userWallet);
      await stake(HARD_CAP.div(2), newPosition.params.id, userWallet);

      const stakerDetails = await stakingRewards.stakers(userWallet.address);
      expect(stakerDetails.balance).toEqual(HARD_CAP.div(2));
      expect(stakerDetails.debtSnapshot).toEqual(DEBT_AMOUNT.div(2));
      expect(stakerDetails.positionId).toEqual(newPosition.params.id);
      expect(stakerDetails.rewardsEarned).toEqual(ArcNumber.new(0));
      expect(stakerDetails.rewardPerTokenPaid).toEqual(ArcNumber.new(0));
    });

    it('should not be able to stake the full amount with less debt', async () => {
      await verifyUserIn(kyfTranche1, userWallet.address);
      await approve(kyfTranche1);
      await mint(HARD_CAP, userWallet);

      const newPosition = await arc._borrowSynthetic(
        DEBT_AMOUNT.div(2),
        DEBT_AMOUNT.div(2),
        userWallet,
      );
      await expectRevert(stake(HARD_CAP, newPosition.params.id, userWallet));
    });

    it('should be able to stake the maximum with the correct debt amount', async () => {
      await verifyUserIn(kyfTranche1, userWallet.address);
      await approve(kyfTranche1);
      await mint(HARD_CAP, userWallet);
      await stake(HARD_CAP, positionId, userWallet);

      const stakerDetails = await stakingRewards.stakers(userWallet.address);
      expect(stakerDetails.balance).toEqual(HARD_CAP);
      expect(stakerDetails.debtSnapshot).toEqual(DEBT_AMOUNT);
      expect(stakerDetails.positionId).toEqual(positionId);
      expect(stakerDetails.rewardsEarned).toEqual(ArcNumber.new(0));
      expect(stakerDetails.rewardPerTokenPaid).toEqual(ArcNumber.new(0));
    });

    it('should not be able to set a lower debt requirement by staking less before the deadline', async () => {});
  });

  describe('#slash', () => {
    let userPosition: BigNumberish;
    let slasherPosition: BigNumberish;

    beforeEach(async () => {
      await setup();

      const result1 = await arc._borrowSynthetic(DEBT_AMOUNT, DEBT_AMOUNT, userWallet);
      userPosition = result1.params.id;

      const result2 = await arc._borrowSynthetic(DEBT_AMOUNT, DEBT_AMOUNT, slasherWallet);
      slasherPosition = result2.params.id;

      await approve(kyfTranche1);
      await verifyUserIn(kyfTranche1, userWallet.address);
      await mint(HARD_CAP, userWallet);
      await stake(HARD_CAP, userPosition, userWallet);
    });

    it('should not be able to slash if user has the amount of their debt snapshot', async () => {
      await expectRevert(slash(userWallet.address, slasherWallet));
    });

    it('should not be able to slash past the vesting end date', async () => {
      await arc.repay(userPosition, DEBT_AMOUNT, 0, userWallet);
      await stakingRewards.setCurrentTimestamp(200);
      await expectRevert(slash(userWallet.address, slasherWallet));
    });

    it('should not be able to slash if the tokens are unstaked but debt is there', async () => {
      await stakingRewards.setCurrentTimestamp(100);

      const earned = await stakingRewards.earned(userWallet.address);
      expect(earned.gte(USER_ALLOCATION.mul(REWARD_AMOUNT).div(BASE).sub(100))).toBeTruthy();

      await expectRevert(slash(userWallet.address, slasherWallet));
    });

    it('should be able to slash if the user does not have enough debt', async () => {
      await stakingRewards.setCurrentTimestamp(100);

      await arc.repay(userPosition, DEBT_AMOUNT, 0, userWallet);

      await slash(userWallet.address, slasherWallet);

      expect(
        await (await stakingRewards.earned(slasherWallet.address)).gte(
          USER_ALLOCATION.mul(SLAHSER_CUT.value).mul(REWARD_AMOUNT).div(BASE).div(BASE).sub(100),
        ),
      ).toBeTruthy();

      expect(
        await (await stakingRewards.earned(ownerWallet.address)).gte(
          USER_ALLOCATION.mul(ArcNumber.new(1).sub(SLAHSER_CUT.value))
            .mul(REWARD_AMOUNT)
            .div(BASE)
            .div(BASE)
            .sub(100),
        ),
      ).toBeTruthy();
    });
  });

  describe('#getReward', () => {
    let userPosition: BigNumberish;
    let slasherPosition: BigNumberish;

    beforeEach(setup);

    beforeEach(async () => {
      const result1 = await arc._borrowSynthetic(DEBT_AMOUNT, DEBT_AMOUNT, userWallet);
      userPosition = result1.params.id;

      const result2 = await arc._borrowSynthetic(DEBT_AMOUNT, DEBT_AMOUNT, slasherWallet);
      slasherPosition = result2.params.id;

      await approve(kyfTranche1);
      await verifyUserIn(kyfTranche1, userWallet.address);
      await mint(HARD_CAP, userWallet);
      await stake(HARD_CAP, userPosition, userWallet);
    });

    it('should not be able to get the reward if the tokens are not claimable after the reward period', async () => {
      await stakingRewards.setCurrentTimestamp(150);
      await expectRevert(getReward(userWallet));
    });

    it('should not be able to get the reward if the tokens are not claimable after the vesting date', async () => {
      await stakingRewards.setCurrentTimestamp(250);
      await expectRevert(getReward(userWallet));
    });

    it('should be able to claim 1/2 the rewards if 1/2 way through the vesting end date', async () => {
      await stakingRewards.setCurrentTimestamp(150);
      await stakingRewards.setTokensClaimable(true);
      await getReward(userWallet);

      expect(
        await (await rewardToken.balanceOf(userWallet.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(2).div(BASE).sub(100),
        ),
      );
    });

    it('should be able to claim rewards gradually over time', async () => {
      await stakingRewards.setTokensClaimable(true);

      await stakingRewards.setCurrentTimestamp(125);
      await getReward(userWallet);
      expect(
        await (await rewardToken.balanceOf(userWallet.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(4).div(BASE).sub(100),
        ),
      );

      await stakingRewards.setCurrentTimestamp(150);
      await getReward(userWallet);
      expect(
        await (await rewardToken.balanceOf(userWallet.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(2).div(BASE).sub(100),
        ),
      );

      await stakingRewards.setCurrentTimestamp(200);
      await getReward(userWallet);
      expect(
        await (await rewardToken.balanceOf(userWallet.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(BASE).sub(100),
        ),
      );
    });

    it('should not be able to claim rewards twice past the end of the vesting date', async () => {
      await stakingRewards.setTokensClaimable(true);
      await stakingRewards.setCurrentTimestamp(200);

      await getReward(userWallet);
      expect(
        await (await rewardToken.balanceOf(userWallet.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(BASE).sub(100),
        ),
      );

      await getReward(userWallet);
      expect(
        await (await rewardToken.balanceOf(userWallet.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(BASE).sub(100),
        ),
      );
    });
  });

  describe('#withdraw', () => {
    beforeEach(setup);

    it('should be able to withdraw', async () => {
      const contract = await getContract(userWallet);
      const result = await arc._borrowSynthetic(DEBT_AMOUNT, DEBT_AMOUNT, userWallet);

      await approve(kyfTranche1);
      await verifyUserIn(kyfTranche1, userWallet.address);
      await mint(HARD_CAP, userWallet);
      await stake(HARD_CAP, result.params.id, userWallet);

      expect(await stakingToken.balanceOf(userWallet.address)).toEqual(new BigNumber(0));

      await contract.withdraw(HARD_CAP);

      expect(await stakingToken.balanceOf(userWallet.address)).toEqual(HARD_CAP);
    });
  });

  describe('#exit', () => {
    let userPosition: BigNumberish;

    beforeEach(async () => {
      await setup();

      const result = await arc._borrowSynthetic(DEBT_AMOUNT, DEBT_AMOUNT, userWallet);
      userPosition = result.params.id;

      await approve(kyfTranche1);
      await verifyUserIn(kyfTranche1, userWallet.address);
      await mint(HARD_CAP, userWallet);
      await stake(HARD_CAP, userPosition, userWallet);
      await stakingRewards.setCurrentTimestamp(10);
    });

    it('should not be able to be called before the tokens are tradable', async () => {
      const contract = await getContract(userWallet);
      await expectRevert(contract.exit());
    });

    it('should be able to exit', async () => {
      await stakingRewards.setTokensClaimable(true);

      const contract = await getContract(userWallet);
      await contract.exit();

      expect(await stakingToken.balanceOf(userWallet.address)).toEqual(HARD_CAP);
      expect(await rewardToken.balanceOf(userWallet.address)).toEqual(Zero);

      await stake(HARD_CAP, userPosition, userWallet);
      await stakingRewards.setCurrentTimestamp(99);
      await contract.exit();

      expect(await stakingToken.balanceOf(userWallet.address)).toEqual(HARD_CAP);
      expect(await rewardToken.balanceOf(userWallet.address)).toEqual(Zero);

      await stake(HARD_CAP, userPosition, userWallet);
      await stakingRewards.setCurrentTimestamp(150);
      await contract.exit();

      expect(await stakingToken.balanceOf(userWallet.address)).toEqual(HARD_CAP);
      expect(await (await rewardToken.balanceOf(userWallet.address)).gte(Zero)).toBeTruthy();
    });
  });

  /* ========== Admin fuctions ========== */

  describe('#notifyRewardAmount', () => {
    beforeEach(setup);

    it('should not be callable by anyone', async () => {
      await expectRevert((await getContract(userWallet)).notifyRewardAmount(REWARD_AMOUNT));
      await expectRevert((await getContract(slasherWallet)).notifyRewardAmount(REWARD_AMOUNT));
    });

    it('should only be callable by the rewards distributor', async () => {
      await rewardToken.mintShare(stakingRewards.address, REWARD_AMOUNT);
      await (await getContract(ownerWallet)).notifyRewardAmount(REWARD_AMOUNT);
    });
  });

  describe('#recoverERC20', () => {
    let dummyToken: TestToken;

    beforeEach(async () => {
      await setup();
      dummyToken = await TestToken.deploy(ownerWallet, 'TEST', 'TEST');
      await dummyToken.mintShare(stakingRewards.address, 100);
    });

    it('should not be callable by anyone', async () => {
      await expectRevert((await getContract(userWallet)).recoverERC20(dummyToken.address, 100));
      await expectRevert((await getContract(slasherWallet)).recoverERC20(dummyToken.address, 100));
    });

    it('should only be callable by the contract owner', async () => {
      await (await getContract(ownerWallet)).recoverERC20(dummyToken.address, 100);
    });
  });

  describe('#setTokensClaimable', () => {
    beforeEach(setup);

    it('should not be callable by anyone', async () => {
      await expectRevert((await getContract(userWallet)).setTokensClaimable(true));
      await expectRevert((await getContract(slasherWallet)).setTokensClaimable(true));
    });

    it('should only be callable by the contract owner', async () => {
      expect(await stakingRewards.tokensClaimable()).toBeFalsy();
      await (await getContract(ownerWallet)).setTokensClaimable(true);
      expect(await stakingRewards.tokensClaimable()).toBeTruthy();
    });
  });

  describe('#init', () => {
    beforeEach(setup);

    it('should not be callable by anyone', async () => {
      await expectRevert(
        (await getContract(userWallet)).init(
          ownerWallet.address,
          ownerWallet.address,
          rewardToken.address,
          stakingToken.address,
          DAO_ALLOCATION,
          SLAHSER_CUT,
          arc.state.address,
          VESTING_END_DATE,
          DEBT_TO_STAKE,
          HARD_CAP,
        ),
      );
      await expectRevert(
        (await getContract(slasherWallet)).init(
          ownerWallet.address,
          ownerWallet.address,
          rewardToken.address,
          stakingToken.address,
          DAO_ALLOCATION,
          SLAHSER_CUT,
          arc.state.address,
          VESTING_END_DATE,
          DEBT_TO_STAKE,
          HARD_CAP,
        ),
      );
    });

    it('should only be callable by the contract owner', async () => {
      await (await getContract(ownerWallet)).init(
        ownerWallet.address,
        ownerWallet.address,
        rewardToken.address,
        stakingToken.address,
        DAO_ALLOCATION,
        SLAHSER_CUT,
        arc.state.address,
        VESTING_END_DATE,
        DEBT_TO_STAKE,
        HARD_CAP,
      );

      expect(await stakingRewards.daoAllocation()).toEqual(DAO_ALLOCATION.value);
      expect(await stakingRewards.slasherCut()).toEqual(SLAHSER_CUT.value);
      expect(await (await stakingRewards.vestingEndDate()).toNumber()).toEqual(VESTING_END_DATE);
      expect(await (await stakingRewards.debtToStake()).toNumber()).toEqual(DEBT_TO_STAKE);
      expect(await stakingRewards.hardCap()).toEqual(HARD_CAP);
      expect(await stakingRewards.stateContract()).toEqual(arc.state.address);
    });
  });

  describe('#setApprovedKYFInstance', () => {
    beforeEach(setup);

    it('should not be callable by anyone', async () => {
      await expectRevert(
        (await getContract(userWallet)).setApprovedKYFInstance(kyfTranche1.address, true),
      );
      await expectRevert(
        (await getContract(slasherWallet)).setApprovedKYFInstance(kyfTranche1.address, true),
      );
    });

    it('should only be callable by the contract owner', async () => {
      expect(await stakingRewards.kyfInstances(kyfTranche1.address)).toBeFalsy();
      await (await getContract(ownerWallet)).setApprovedKYFInstance(kyfTranche1.address, true);
      expect(await stakingRewards.kyfInstances(kyfTranche1.address)).toBeTruthy();
    });
  });
});
