import '@test/contracts/mozart/node_modules/@test/contracts/spritz/node_modules/module-alias/register';

import { TestToken } from '@src/typings/TestToken';
import simpleDescribe from '@test/helpers/simpleDescribe';
import { ITestContext } from '@test/helpers/simpleDescribe';
import { ethers } from 'ethers';
import Token from '@src/utils/Token';
import {
  BigNumber,
  BigNumberish,
} from '@test/contracts/mozart/node_modules/@test/contracts/spritz/node_modules/ethers/utils';
import ArcNumber from '@src/utils/ArcNumber';
import { expectRevert } from '@test/helpers/expectRevert';
import { ArcProxy, KYFV2, MockRewardCampaign } from '@src/typings';
import { D1TestArc } from '../../../src/D1TestArc';
import ArcDecimal from '../../../src/utils/ArcDecimal';
import { Zero } from '@test/contracts/mozart/node_modules/@test/contracts/spritz/node_modules/ethers/constants';
import { getWaffleExpect, Account } from '../../helpers/testingUtils';

let ownerAccount: Account;
let userAccount: Account;
let slasherAccount: Account;
let distributionAccount: Account;

const expect = getWaffleExpect();

let arc: D1TestArc;
let stakingRewards: MockRewardCampaign;

let stakingToken: TestToken;
let rewardToken: TestToken;

let kyfTranche1: KYFV2;
let kyfTranche2: KYFV2;

const BASE = new BigNumber(10).pow(18);

async function init(ctx: ITestContext): Promise<void> {
  ownerAccount = ctx.accounts[0];
  userAccount = ctx.accounts[1];
  slasherAccount = ctx.accounts[2];
  distributionAccount = ctx.accounts[3];
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
    stakingToken = await TestToken.deploy(ownerAccount.signer, 'LINKUSD/USDC 50/50', 'BPT');
    rewardToken = await TestToken.deploy(ownerAccount.signer, 'Arc Token', 'ARC');

    kyfTranche1 = await KYFV2.deploy(ownerAccount.signer);
    kyfTranche2 = await KYFV2.deploy(ownerAccount.signer);

    arc = await D1TestArc.init(ownerAccount.signer);
    await arc.deployTestArc();

    stakingRewards = await MockRewardCampaign.awaitDeployment(
      ownerAccount.signer,
      ownerAccount.address,
      distributionAccount.address,
      rewardToken.address,
      stakingToken.address,
    );

    stakingRewards = await MockRewardCampaign.at(
      ownerAccount.signer,
      (await ArcProxy.deploy(ownerAccount.signer, stakingRewards.address, ownerAccount.address, []))
        .address,
    );

    await rewardToken.mintShare(stakingRewards.address, REWARD_AMOUNT);

    await stakingRewards.setCurrentTimestamp(0);
    await stakingRewards.setRewardsDistributor(ownerAccount.address);
    await stakingRewards.setRewardsDuration(REWARDS_END_DATE);

    await stakingRewards.init(
      ownerAccount.address,
      ownerAccount.address,
      rewardToken.address,
      stakingToken.address,
      DAO_ALLOCATION,
      SLAHSER_CUT,
      arc.state.address,
      VESTING_END_DATE,
      DEBT_TO_STAKE,
      HARD_CAP,
    );

    await kyfTranche1.setVerifier(ownerAccount.address);
    await kyfTranche1.setHardCap(10);
    await kyfTranche2.setVerifier(ownerAccount.address);
    await kyfTranche2.setHardCap(10);

    await stakingRewards.notifyRewardAmount(REWARD_AMOUNT);
  }

  /* ========== Helpers ========== */

  async function getContract(caller: Account) {
    return MockRewardCampaign.at(caller.signer, stakingRewards.address);
  }

  async function verifyUserIn(kyf: KYFV2, address: string = userAccount.address) {
    const hash = ethers.utils.solidityKeccak256(['address'], [address]);
    const signedMessage = await ownerAccount.signer.signMessage(ethers.utils.arrayify(hash));
    const signature = ethers.utils.splitSignature(signedMessage);
    await kyf.verify(address, signature.v, signature.r, signature.s);
  }

  async function approve(kyf: KYFV2) {
    await stakingRewards.setApprovedKYFInstance(kyf.address, true);
  }

  async function mint(amount: BigNumberish, account: Account) {
    await stakingToken.mintShare(account.address, amount);
    await Token.approve(
      stakingToken.address,
      account.signer,
      stakingRewards.address,
      new BigNumber(amount).mul(10),
    );
  }

  async function stake(amount: BigNumberish, id: BigNumberish, wallet: Account) {
    const userStaking = await getContract(wallet);
    await userStaking.stake(amount, id);
  }

  async function slash(user: string, wallet: Account) {
    const slasherStaking = await getContract(wallet);
    await slasherStaking.slash(user);
  }

  async function getReward(wallet: Account) {
    const userStaking = await getContract(wallet);
    await userStaking.getReward(wallet.address);
  }

  /* ========== Public fuctions ========== */

  describe('#stake', () => {
    let positionId: BigNumberish;
    let altPositionId: BigNumberish;

    beforeEach(setup);

    beforeEach(async () => {
      const result1 = await arc._borrowSynthetic(DEBT_AMOUNT, DEBT_AMOUNT, userAccount.signer);
      positionId = result1.params.id;

      const result2 = await arc._borrowSynthetic(DEBT_AMOUNT, DEBT_AMOUNT, slasherAccount.signer);
      altPositionId = result2.params.id;
    });

    it('should not be able to stake over the hard cap', async () => {
      await verifyUserIn(kyfTranche1, userAccount.address);
      await approve(kyfTranche1);
      await mint(HARD_CAP.add(1), userAccount);
      await expectRevert(stake(HARD_CAP.add(1), positionId, userAccount));
    });

    it('should not be able to stake over the hard cap in total', async () => {
      await verifyUserIn(kyfTranche1, userAccount.address);
      await approve(kyfTranche1);
      await mint(HARD_CAP.mul(3), userAccount);
      await stake(HARD_CAP, positionId, userAccount);
      await expectRevert(stake(HARD_CAP, positionId, userAccount));
    });

    it('should not be able to stake without being verified', async () => {
      await approve(kyfTranche1);
      await mint(HARD_CAP, userAccount);
      await expectRevert(stake(HARD_CAP, positionId, userAccount));
    });

    it('should not be able to stake without a valid debt position owned by the same user', async () => {
      await verifyUserIn(kyfTranche1, userAccount.address);
      await approve(kyfTranche1);
      await mint(HARD_CAP, userAccount);
      await expectRevert(stake(HARD_CAP, altPositionId, userAccount));
    });

    it('should not be able to stake 1/2 of the hard cap with less than 1/2 the debt', async () => {
      await verifyUserIn(kyfTranche1, userAccount.address);
      await approve(kyfTranche1);
      await mint(HARD_CAP, userAccount);

      const newPosition = await arc._borrowSynthetic(
        DEBT_AMOUNT.div(2),
        DEBT_AMOUNT,
        userAccount.signer,
      );
      await expectRevert(stake(HARD_CAP, newPosition.params.id, userAccount));
    });

    it('should be able to stake 1/2 of the hard cap with 1/2 the debt', async () => {
      await verifyUserIn(kyfTranche1, userAccount.address);
      await approve(kyfTranche1);
      await mint(HARD_CAP.div(2), userAccount);

      const newPosition = await arc._borrowSynthetic(
        DEBT_AMOUNT.div(2),
        DEBT_AMOUNT,
        userAccount.signer,
      );
      await stake(HARD_CAP.div(2), newPosition.params.id, userAccount);

      const stakerDetails = await stakingRewards.stakers(userAccount.address);
      expect(stakerDetails.balance).to.equal(HARD_CAP.div(2));
      expect(stakerDetails.debtSnapshot).to.equal(DEBT_AMOUNT.div(2));
      expect(stakerDetails.positionId).to.equal(newPosition.params.id);
      expect(stakerDetails.rewardsEarned).to.equal(ArcNumber.new(0));
      expect(stakerDetails.rewardPerTokenPaid).to.equal(ArcNumber.new(0));
    });

    it('should not be able to stake the full amount with less debt', async () => {
      await verifyUserIn(kyfTranche1, userAccount.address);
      await approve(kyfTranche1);
      await mint(HARD_CAP, userAccount);

      const newPosition = await arc._borrowSynthetic(
        DEBT_AMOUNT.div(2),
        DEBT_AMOUNT.div(2),
        userAccount.signer,
      );
      await expectRevert(stake(HARD_CAP, newPosition.params.id, userAccount));
    });

    it('should be able to stake the maximum with the correct debt amount', async () => {
      await verifyUserIn(kyfTranche1, userAccount.address);
      await approve(kyfTranche1);
      await mint(HARD_CAP, userAccount);
      await stake(HARD_CAP, positionId, userAccount);

      const stakerDetails = await stakingRewards.stakers(userAccount.address);
      expect(stakerDetails.balance).to.equal(HARD_CAP);
      expect(stakerDetails.debtSnapshot).to.equal(DEBT_AMOUNT);
      expect(stakerDetails.positionId).to.equal(positionId);
      expect(stakerDetails.rewardsEarned).to.equal(ArcNumber.new(0));
      expect(stakerDetails.rewardPerTokenPaid).to.equal(ArcNumber.new(0));
    });

    it('should not be able to set a lower debt requirement by staking less before the deadline', async () => {});
  });

  describe('#slash', () => {
    let userPosition: BigNumberish;
    let slasherPosition: BigNumberish;

    beforeEach(async () => {
      await setup();

      const result1 = await arc._borrowSynthetic(DEBT_AMOUNT, DEBT_AMOUNT, userAccount.signer);
      userPosition = result1.params.id;

      const result2 = await arc._borrowSynthetic(DEBT_AMOUNT, DEBT_AMOUNT, slasherAccount.signer);
      slasherPosition = result2.params.id;

      await approve(kyfTranche1);
      await verifyUserIn(kyfTranche1, userAccount.address);
      await mint(HARD_CAP, userAccount);
      await stake(HARD_CAP, userPosition, userAccount);
    });

    it('should not be able to slash if user has the amount of their debt snapshot', async () => {
      await expectRevert(slash(userAccount.address, slasherAccount));
    });

    it('should not be able to slash past the vesting end date', async () => {
      await arc.repay(userPosition, DEBT_AMOUNT, 0, userAccount.signer);
      await stakingRewards.setCurrentTimestamp(200);
      await expectRevert(slash(userAccount.address, slasherAccount));
    });

    it('should not be able to slash if the tokens are unstaked but debt is there', async () => {
      await stakingRewards.setCurrentTimestamp(100);

      const earned = await stakingRewards.earned(userAccount.address);
      expect(earned.gte(USER_ALLOCATION.mul(REWARD_AMOUNT).div(BASE).sub(100))).to.be.true;

      await expectRevert(slash(userAccount.address, slasherAccount));
    });

    it('should be able to slash if the user does not have enough debt', async () => {
      await stakingRewards.setCurrentTimestamp(100);

      await arc.repay(userPosition, DEBT_AMOUNT, 0, userAccount.signer);

      await slash(userAccount.address, slasherAccount);

      expect(
        await (await stakingRewards.earned(slasherAccount.address)).gte(
          USER_ALLOCATION.mul(SLAHSER_CUT.value).mul(REWARD_AMOUNT).div(BASE).div(BASE).sub(100),
        ),
      ).to.be.true;

      expect(
        await (await stakingRewards.earned(ownerAccount.address)).gte(
          USER_ALLOCATION.mul(ArcNumber.new(1).sub(SLAHSER_CUT.value))
            .mul(REWARD_AMOUNT)
            .div(BASE)
            .div(BASE)
            .sub(100),
        ),
      ).to.be.true;
    });
  });

  describe('#getReward', () => {
    let userPosition: BigNumberish;
    let slasherPosition: BigNumberish;

    beforeEach(setup);

    beforeEach(async () => {
      const result1 = await arc._borrowSynthetic(DEBT_AMOUNT, DEBT_AMOUNT, userAccount.signer);
      userPosition = result1.params.id;

      const result2 = await arc._borrowSynthetic(DEBT_AMOUNT, DEBT_AMOUNT, slasherAccount.signer);
      slasherPosition = result2.params.id;

      await approve(kyfTranche1);
      await verifyUserIn(kyfTranche1, userAccount.address);
      await mint(HARD_CAP, userAccount);
      await stake(HARD_CAP, userPosition, userAccount);
    });

    it('should not be able to get the reward if the tokens are not claimable after the reward period', async () => {
      await stakingRewards.setCurrentTimestamp(150);
      await expectRevert(getReward(userAccount));
    });

    it('should not be able to get the reward if the tokens are not claimable after the vesting date', async () => {
      await stakingRewards.setCurrentTimestamp(250);
      await expectRevert(getReward(userAccount));
    });

    it('should be able to claim 1/2 the rewards if 1/2 way through the vesting end date', async () => {
      await stakingRewards.setCurrentTimestamp(150);
      await stakingRewards.setTokensClaimable(true);
      await getReward(userAccount);

      expect(
        await (await rewardToken.balanceOf(userAccount.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(2).div(BASE).sub(100),
        ),
      );
    });

    it('should be able to claim rewards gradually over time', async () => {
      await stakingRewards.setTokensClaimable(true);

      await stakingRewards.setCurrentTimestamp(125);
      await getReward(userAccount);
      expect(
        await (await rewardToken.balanceOf(userAccount.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(4).div(BASE).sub(100),
        ),
      );

      await stakingRewards.setCurrentTimestamp(150);
      await getReward(userAccount);
      expect(
        await (await rewardToken.balanceOf(userAccount.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(2).div(BASE).sub(100),
        ),
      );

      await stakingRewards.setCurrentTimestamp(200);
      await getReward(userAccount);
      expect(
        await (await rewardToken.balanceOf(userAccount.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(BASE).sub(100),
        ),
      );
    });

    it('should not be able to claim rewards twice past the end of the vesting date', async () => {
      await stakingRewards.setTokensClaimable(true);
      await stakingRewards.setCurrentTimestamp(200);

      await getReward(userAccount);
      expect(
        await (await rewardToken.balanceOf(userAccount.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(BASE).sub(100),
        ),
      );

      await getReward(userAccount);
      expect(
        await (await rewardToken.balanceOf(userAccount.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(BASE).sub(100),
        ),
      );
    });
  });

  describe('#withdraw', () => {
    beforeEach(setup);

    it('should be able to withdraw', async () => {
      const contract = await getContract(userAccount);
      const result = await arc._borrowSynthetic(DEBT_AMOUNT, DEBT_AMOUNT, userAccount.signer);

      await approve(kyfTranche1);
      await verifyUserIn(kyfTranche1, userAccount.address);
      await mint(HARD_CAP, userAccount);
      await stake(HARD_CAP, result.params.id, userAccount);

      expect(await stakingToken.balanceOf(userAccount.address)).to.equal(new BigNumber(0));

      await contract.withdraw(HARD_CAP);

      expect(await stakingToken.balanceOf(userAccount.address)).to.equal(HARD_CAP);
    });
  });

  describe('#exit', () => {
    let userPosition: BigNumberish;

    beforeEach(async () => {
      await setup();

      const result = await arc._borrowSynthetic(DEBT_AMOUNT, DEBT_AMOUNT, userAccount.signer);
      userPosition = result.params.id;

      await approve(kyfTranche1);
      await verifyUserIn(kyfTranche1, userAccount.address);
      await mint(HARD_CAP, userAccount);
      await stake(HARD_CAP, userPosition, userAccount);
      await stakingRewards.setCurrentTimestamp(10);
    });

    it('should not be able to be called before the tokens are tradable', async () => {
      const contract = await getContract(userAccount);
      await expectRevert(contract.exit());
    });

    it('should be able to exit', async () => {
      await stakingRewards.setTokensClaimable(true);

      const contract = await getContract(userAccount);
      await contract.exit();

      expect(await stakingToken.balanceOf(userAccount.address)).to.equal(HARD_CAP);
      expect(await rewardToken.balanceOf(userAccount.address)).to.equal(Zero);

      await stake(HARD_CAP, userPosition, userAccount);
      await stakingRewards.setCurrentTimestamp(99);
      await contract.exit();

      expect(await stakingToken.balanceOf(userAccount.address)).to.equal(HARD_CAP);
      expect(await rewardToken.balanceOf(userAccount.address)).to.equal(Zero);

      await stake(HARD_CAP, userPosition, userAccount);
      await stakingRewards.setCurrentTimestamp(150);
      await contract.exit();

      expect(await stakingToken.balanceOf(userAccount.address)).to.equal(HARD_CAP);
      expect(await (await rewardToken.balanceOf(userAccount.address)).gte(Zero)).to.be.true;
    });
  });

  /* ========== Admin fuctions ========== */

  describe('#notifyRewardAmount', () => {
    beforeEach(setup);

    it('should not be callable by anyone', async () => {
      await expectRevert((await getContract(userAccount)).notifyRewardAmount(REWARD_AMOUNT));
      await expectRevert((await getContract(slasherAccount)).notifyRewardAmount(REWARD_AMOUNT));
    });

    it('should only be callable by the rewards distributor', async () => {
      await rewardToken.mintShare(stakingRewards.address, REWARD_AMOUNT);
      await (await getContract(ownerAccount)).notifyRewardAmount(REWARD_AMOUNT);
    });
  });

  describe('#recoverERC20', () => {
    let dummyToken: TestToken;

    beforeEach(async () => {
      await setup();
      dummyToken = await TestToken.deploy(ownerAccount.signer, 'TEST', 'TEST');
      await dummyToken.mintShare(stakingRewards.address, 100);
    });

    it('should not be callable by anyone', async () => {
      await expectRevert((await getContract(userAccount)).recoverERC20(dummyToken.address, 100));
      await expectRevert((await getContract(slasherAccount)).recoverERC20(dummyToken.address, 100));
    });

    it('should only be callable by the contract owner', async () => {
      await (await getContract(ownerAccount)).recoverERC20(dummyToken.address, 100);
    });
  });

  describe('#setTokensClaimable', () => {
    beforeEach(setup);

    it('should not be callable by anyone', async () => {
      await expectRevert((await getContract(userAccount)).setTokensClaimable(true));
      await expectRevert((await getContract(slasherAccount)).setTokensClaimable(true));
    });

    it('should only be callable by the contract owner', async () => {
      expect(await stakingRewards.tokensClaimable()).to.be.false;
      await (await getContract(ownerAccount)).setTokensClaimable(true);
      expect(await stakingRewards.tokensClaimable()).to.be.true;
    });
  });

  describe('#init', () => {
    beforeEach(setup);

    it('should not be callable by anyone', async () => {
      await expectRevert(
        (await getContract(userAccount)).init(
          ownerAccount.address,
          ownerAccount.address,
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
        (await getContract(slasherAccount)).init(
          ownerAccount.address,
          ownerAccount.address,
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
      await (await getContract(ownerAccount)).init(
        ownerAccount.address,
        ownerAccount.address,
        rewardToken.address,
        stakingToken.address,
        DAO_ALLOCATION,
        SLAHSER_CUT,
        arc.state.address,
        VESTING_END_DATE,
        DEBT_TO_STAKE,
        HARD_CAP,
      );

      expect(await stakingRewards.daoAllocation()).to.equal(DAO_ALLOCATION.value);
      expect(await stakingRewards.slasherCut()).to.equal(SLAHSER_CUT.value);
      expect(await (await stakingRewards.vestingEndDate()).toNumber()).to.equal(VESTING_END_DATE);
      expect(await (await stakingRewards.debtToStake()).toNumber()).to.equal(DEBT_TO_STAKE);
      expect(await stakingRewards.hardCap()).to.equal(HARD_CAP);
      expect(await stakingRewards.stateContract()).to.equal(arc.state.address);
    });
  });

  describe('#setApprovedKYFInstance', () => {
    beforeEach(setup);

    it('should not be callable by anyone', async () => {
      await expectRevert(
        (await getContract(userAccount)).setApprovedKYFInstance(kyfTranche1.address, true),
      );
      await expectRevert(
        (await getContract(slasherAccount)).setApprovedKYFInstance(kyfTranche1.address, true),
      );
    });

    it('should only be callable by the contract owner', async () => {
      expect(await stakingRewards.kyfInstances(kyfTranche1.address)).to.be.false;
      await (await getContract(ownerAccount)).setApprovedKYFInstance(kyfTranche1.address, true);
      expect(await stakingRewards.kyfInstances(kyfTranche1.address)).to.be.true;
    });
  });
});
