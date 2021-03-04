import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { TestToken, TestTokenFactory } from '@src/typings';
import ArcNumber from '@src/utils/ArcNumber';
import { ethers } from 'hardhat';
import { deployTestToken } from '../deployers';
import ArcDecimal from '@src/utils/ArcDecimal';
import { BigNumber, BigNumberish } from 'ethers';
import chai from 'chai';
import { BASE, TEN_PERCENT } from '@src/constants';
import { solidity } from 'ethereum-waffle';
import { generateContext, ITestContext } from '../context';
import { mozartFixture } from '../fixtures';
import { setupMozart } from '../setup';
import { MozartTestArc } from '@src/MozartTestArc';
import { MockJointCampaignFactory } from '@src/typings/MockJointCampaignFactory';
import { MockJointCampaign } from '@src/typings/MockJointCampaign';

chai.use(solidity);
const expect = chai.expect;

let jointCampaignOwner: MockJointCampaign;
let jointCampaignLido: MockJointCampaign;
let jointCampaignUser1: MockJointCampaign;
let jointCampaignUser2: MockJointCampaign;

let arc: MozartTestArc;

let stakingToken: TestToken;
let arcToken: TestToken;
let collabToken: TestToken;
let otherErc20: TestToken;

let owner: SignerWithAddress;
let lido: SignerWithAddress;
let user1: SignerWithAddress;
let user2: SignerWithAddress;

const ARC_REWARD_AMOUNT = ArcNumber.new(100);
const COLLAB_REWARD_AMOUNT = ArcNumber.new(200);
const STAKE_AMOUNT = ArcNumber.new(10);
const REWARD_DURATION = 10;

const DAO_ALLOCATION = ArcDecimal.new(0.4);
const SLASHER_CUT = ArcDecimal.new(0.3);
const STAKE_TO_DEBT_RATIO = 2;

const COLLATERAL_AMOUNT = ArcNumber.new(10);
const BORROW_AMOUNT = ArcNumber.new(5);

describe('JointCampaign', () => {
  async function setTimestampTo(timestamp: number) {
    await jointCampaignOwner.setCurrentTimestamp(timestamp);
  }

  function arcEarned(user: SignerWithAddress) {
    return jointCampaignOwner.actualEarned(user.address, arcToken.address);
  }

  function lidoEarned(user: SignerWithAddress) {
    return jointCampaignOwner.actualEarned(user.address, collabToken.address);
  }

  /**
   * Opens a position and stakes the amount
   *
   * @param user staking user
   * @param amount the amount to stake
   * @returns the position ID
   */
  async function stake(user: SignerWithAddress, amount: BigNumber) {
    await mintAndApprove(stakingToken, user, amount);

    const newPosition = await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, user);

    const contract = MockJointCampaignFactory.connect(jointCampaignOwner.address, user);

    await contract.stake(amount, newPosition.params.id);

    return newPosition.params.id;
  }

  async function mintAndApprove(
    token: TestToken,
    tokenReceiver: SignerWithAddress,
    amount: BigNumber,
  ) {
    const tokenContract = TestTokenFactory.connect(token.address, tokenReceiver);
    await tokenContract.mintShare(tokenReceiver.address, amount);
    await tokenContract.approve(jointCampaignOwner.address, amount);
  }

  /**
   * skip calls init() and sets the reward duration
   */
  async function setupBasic() {
    if (!jointCampaignOwner || !owner) {
      throw 'Liquidity campaign or owner cannot be null';
    }

    await jointCampaignOwner.setRewardsDuration(REWARD_DURATION);

    await jointCampaignOwner.init(
      owner.address,
      owner.address,
      lido.address,
      arcToken.address,
      collabToken.address,
      stakingToken.address,
      DAO_ALLOCATION,
      SLASHER_CUT,
      STAKE_TO_DEBT_RATIO,
      await arc.coreAddress(),
    );

    await setTimestampTo(0);
  }

  /**
   * Also calls JointCampaign.init() and notifies the reward amounts
   */
  async function setup() {
    if (!jointCampaignOwner || !owner) {
      throw 'Liquidity campaign or owner cannot be null';
    }

    await setupBasic();

    await jointCampaignOwner.notifyRewardAmount(ARC_REWARD_AMOUNT, arcToken.address);
    await jointCampaignLido.notifyRewardAmount(COLLAB_REWARD_AMOUNT, collabToken.address);

    await setTimestampTo(0);
  }

  function fixtureInit(ctx: ITestContext): Promise<void> {
    return setupMozart(ctx, {
      oraclePrice: ArcNumber.new(1),
      collateralRatio: ArcNumber.new(2),
      interestRate: TEN_PERCENT,
    });
  }

  before(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
    lido = signers[1];
    user1 = signers[2];
    user2 = signers[3];
  });

  beforeEach(async () => {
    stakingToken = await deployTestToken(owner, '3Pool', 'CRV');
    arcToken = await deployTestToken(owner, 'Arc Token', 'ARC');
    collabToken = await deployTestToken(owner, 'collabToken', 'collab');
    otherErc20 = await deployTestToken(owner, 'Another ERC20 token', 'AERC20');

    jointCampaignOwner = await new MockJointCampaignFactory(owner).deploy();
    jointCampaignLido = MockJointCampaignFactory.connect(jointCampaignOwner.address, lido);
    jointCampaignUser1 = MockJointCampaignFactory.connect(jointCampaignOwner.address, user1);
    jointCampaignUser2 = MockJointCampaignFactory.connect(jointCampaignOwner.address, user2);

    await arcToken.mintShare(jointCampaignOwner.address, ARC_REWARD_AMOUNT);
    await collabToken.mintShare(jointCampaignOwner.address, COLLAB_REWARD_AMOUNT);

    const ctx: ITestContext = await generateContext(mozartFixture, fixtureInit);

    arc = ctx.sdks.mozart;
  });

  describe('View functions', () => {
    describe('#totalSupply', () => {
      beforeEach(setup);

      it('should return the correct amount of staking tokens', async () => {
        expect(await jointCampaignOwner.totalSupply()).to.eq(BigNumber.from(0));

        await stake(user1, STAKE_AMOUNT);

        expect(await jointCampaignOwner.totalSupply()).to.eq(STAKE_AMOUNT);

        await stake(user2, STAKE_AMOUNT);

        expect(await jointCampaignOwner.totalSupply()).to.eq(STAKE_AMOUNT.mul(2));
      });
    });

    describe('#balanceOf', () => {
      beforeEach(setup);

      it('should return 0 if user did not stake', async () => {
        expect(await jointCampaignOwner.balanceOf(user1.address)).to.eq(BigNumber.from(0));
      });

      it('should return the correct balance after staking', async () => {
        await stake(user1, STAKE_AMOUNT);

        expect(await jointCampaignOwner.balanceOf(user1.address)).to.eq(STAKE_AMOUNT);
      });
    });

    describe('#lastTimeRewardApplicable', () => {
      beforeEach(setup);

      it('arc: should return the block timestamp if called after the collab reward period but before the arc reward period', async () => {
        await setTimestampTo(REWARD_DURATION / 2);

        await arcToken.mintShare(jointCampaignOwner.address, ARC_REWARD_AMOUNT);
        await jointCampaignOwner.notifyRewardAmount(ARC_REWARD_AMOUNT, arcToken.address);

        await setTimestampTo(REWARD_DURATION);

        expect(await jointCampaignOwner.lastTimeRewardApplicable(arcToken.address)).to.eq(
          REWARD_DURATION,
        );
      });

      it('collab: should return the block timestamp if called after the arc reward period but before the collab reward period', async () => {
        await setTimestampTo(REWARD_DURATION / 2);

        await collabToken.mintShare(jointCampaignOwner.address, COLLAB_REWARD_AMOUNT);
        await jointCampaignLido.notifyRewardAmount(COLLAB_REWARD_AMOUNT, collabToken.address);

        await setTimestampTo(REWARD_DURATION);

        expect(await jointCampaignOwner.lastTimeRewardApplicable(collabToken.address)).to.eq(
          REWARD_DURATION,
        );
      });

      it('arc: should return the arc reward period if called after the arc reward period but before the renewed collab reward period', async () => {
        await setTimestampTo(REWARD_DURATION / 2);

        await collabToken.mintShare(jointCampaignOwner.address, COLLAB_REWARD_AMOUNT);
        await jointCampaignLido.notifyRewardAmount(COLLAB_REWARD_AMOUNT, collabToken.address);

        await setTimestampTo(REWARD_DURATION + 1);

        const arcPeriodFinish = await jointCampaignOwner.arcPeriodFinish();
        expect(await jointCampaignOwner.lastTimeRewardApplicable(arcToken.address)).to.eq(
          arcPeriodFinish,
        );
      });

      it('collab: should return the collab reward period if called after the collab reward period but before the arc reward period', async () => {
        await setTimestampTo(REWARD_DURATION / 2);

        await arcToken.mintShare(jointCampaignOwner.address, ARC_REWARD_AMOUNT);
        await jointCampaignOwner.notifyRewardAmount(ARC_REWARD_AMOUNT, arcToken.address);

        await setTimestampTo(REWARD_DURATION);

        const collabPeriodFinish = await jointCampaignOwner.collabPeriodFinish();
        expect(await jointCampaignOwner.lastTimeRewardApplicable(collabToken.address)).to.eq(
          collabPeriodFinish,
        );
      });
    });

    describe('#arcRewardPerTokenUser', () => {
      it('should return 0 if the supply is 0', async () => {
        await setup();
        expect(await jointCampaignOwner.arcRewardPerTokenUser()).to.eq(BigNumber.from(0));
      });

      it('should return a valid reward per token after someone staked', async () => {
        await setup();
        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        expect(await jointCampaignOwner.arcRewardPerTokenUser()).to.eq(ArcDecimal.new(0.6).value);
      });

      it('should return correct reward per token with two users staked', async () => {
        await setupBasic();

        await jointCampaignOwner.notifyRewardAmount(ARC_REWARD_AMOUNT, arcToken.address);
        await jointCampaignLido.notifyRewardAmount(COLLAB_REWARD_AMOUNT, collabToken.address);

        await stake(user1, STAKE_AMOUNT);
        await stake(user2, STAKE_AMOUNT); // adds 4 epochs; 3.5

        await setTimestampTo(1);

        // (4 epochs * 0.5 RPT + 0.25 RPT) * 0.6 = 1.35
        expect(await jointCampaignOwner.arcRewardPerTokenUser()).to.eq(ArcDecimal.new(0.3).value);
      });
    });

    describe('#collabRewardPerToken', () => {
      it('should return the reward per token stored if the supply is 0', async () => {
        await setup();
        expect(await jointCampaignOwner.collabRewardPerToken()).to.eq(BigNumber.from(0));
      });

      it('should return the correct reward per token after someone staked', async () => {
        await setup();
        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        expect(await jointCampaignOwner.collabRewardPerToken()).to.eq(ArcNumber.new(2));
      });

      it('should return correct reward per token with two tokens staked', async () => {
        await setupBasic();

        await jointCampaignOwner.notifyRewardAmount(ARC_REWARD_AMOUNT, arcToken.address);
        await jointCampaignLido.notifyRewardAmount(COLLAB_REWARD_AMOUNT, collabToken.address);

        await stake(user1, STAKE_AMOUNT);
        await stake(user2, STAKE_AMOUNT);

        await setTimestampTo(1);

        // 4 epochs * 1 RPT + 0.5 RPT
        expect(await jointCampaignOwner.collabRewardPerToken()).to.eq(ArcDecimal.new(1).value);
      });
    });

    describe('#arcEarned', () => {
      it('should return the correct amount of arcx earned over time', async () => {
        await setup();
        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        expect(await jointCampaignUser1.arcEarned(user1.address)).to.eq(ArcNumber.new(6));

        await setTimestampTo(2);

        expect(await jointCampaignUser1.arcEarned(user1.address)).to.eq(ArcNumber.new(12));
      });

      it('should return the correct amount of arcx earned over time while another user stakes in between', async () => {
        await setupBasic();
        await jointCampaignOwner.notifyRewardAmount(ARC_REWARD_AMOUNT, arcToken.address);
        await jointCampaignLido.notifyRewardAmount(COLLAB_REWARD_AMOUNT, collabToken.address);

        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        expect(await jointCampaignUser1.arcEarned(user1.address)).to.eq(ArcNumber.new(6));

        await setTimestampTo(2);

        await stake(user2, STAKE_AMOUNT);

        await setTimestampTo(3);

        expect(await jointCampaignUser1.arcEarned(user1.address)).to.eq(ArcDecimal.new(15).value);
        expect(await jointCampaignUser2.arcEarned(user2.address)).to.eq(ArcDecimal.new(3).value);
      });
    });

    describe('#collabEarned', () => {
      beforeEach(setup);

      it('should return the correct amount of collab earned over time', async () => {
        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        expect(await jointCampaignUser1.collabEarned(user1.address)).to.eq(ArcNumber.new(20));

        await setTimestampTo(2);

        expect(await jointCampaignUser1.collabEarned(user1.address)).to.eq(ArcNumber.new(40));
      });

      it('should return the correct amount of collab earned over time while another user stakes in between', async () => {
        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        expect(await jointCampaignUser1.collabEarned(user1.address)).to.eq(ArcNumber.new(20));

        await setTimestampTo(2);

        await stake(user2, STAKE_AMOUNT);

        await setTimestampTo(3);

        expect(await jointCampaignUser1.collabEarned(user1.address)).to.eq(ArcNumber.new(50));
        expect(await jointCampaignUser2.collabEarned(user2.address)).to.eq(ArcNumber.new(10));
      });
    });

    describe('#userAllocation', () => {
      beforeEach(setup);

      it('should return the correct user allocation', async () => {
        const userAllocation = await jointCampaignUser1.userAllocation();

        expect(userAllocation.value).to.eq(BASE.sub(DAO_ALLOCATION.value));
      });
    });

    describe('#getArcRewardForDuration', () => {
      beforeEach(setup);

      it('returns the correct ARC reward for duration', async () => {
        const rewardForDuration = await jointCampaignOwner.getArcRewardForDuration();

        expect(rewardForDuration).to.eq(ARC_REWARD_AMOUNT);
      });
    });

    describe('#getcollabRewardForDuration', () => {
      beforeEach(setup);

      it('returns the correct collab reward for duration', async () => {
        const rewardForDuration = await jointCampaignOwner.getCollabRewardForDuration();

        expect(rewardForDuration).to.eq(COLLAB_REWARD_AMOUNT);
      });
    });

    describe('#isMinter', () => {
      beforeEach(setup);

      it('should return false if user did not mint debt to the position', async () => {
        expect(await jointCampaignUser1.isMinter(user1.address, BORROW_AMOUNT, BigNumber.from(0)))
          .to.be.false;

        const user2Position = await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, user2);

        expect(
          await jointCampaignUser1.isMinter(user1.address, BORROW_AMOUNT, user2Position.params.id),
        ).to.be.false;
      });

      it('should return false if user minted a smaller amount than the given _amount', async () => {
        const user1Position = await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, user1);

        expect(
          await jointCampaignUser1.isMinter(
            user1.address,
            BORROW_AMOUNT.add(1),
            user1Position.params.id,
          ),
        ).to.be.false;
      });

      it('should return true if user minted an equal or greater amount of debt for the given position', async () => {
        const user1Position = await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, user1);

        expect(
          await jointCampaignUser1.isMinter(
            user1.address,
            BORROW_AMOUNT.div(2),
            user1Position.params.id,
          ),
        ).to.be.true;

        expect(
          await jointCampaignUser1.isMinter(user1.address, BORROW_AMOUNT, user1Position.params.id),
        ).to.be.true;
      });
    });
  });

  describe('Mutative functions', () => {
    describe('#stake', () => {
      beforeEach(setup);

      it('should not be able to stake the full amount with less debt', async () => {
        await mintAndApprove(stakingToken, user1, STAKE_AMOUNT);

        const newPosition = await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT.sub(1), user1);

        await expect(
          jointCampaignUser1.stake(STAKE_AMOUNT, newPosition.params.id),
        ).to.be.revertedWith('Must be a valid minter');
      });

      it('should not be able to set a lower debt requirement by staking less before the deadline', async () => {
        const newPositionId = await stake(user1, STAKE_AMOUNT);

        await expect(jointCampaignUser1.stake(BigNumber.from(1), newPositionId)).to.be.revertedWith(
          'Your new debt requirement cannot be lower than last time',
        );
      });

      it('should not be able to stake to a different position ID', async () => {
        await stake(user1, STAKE_AMOUNT);

        const newPosition = await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, user1);

        await mintAndApprove(stakingToken, user1, STAKE_AMOUNT);

        await expect(
          jointCampaignUser1.stake(STAKE_AMOUNT, newPosition.params.id),
        ).to.be.revertedWith('You cannot stake based on a different debt position');
      });

      it('should not be able to stake more than balance', async () => {
        await mintAndApprove(stakingToken, user1, STAKE_AMOUNT);

        const newPosition = await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, user1);

        await expect(
          jointCampaignUser1.stake(STAKE_AMOUNT.add(1), newPosition.params.id),
        ).to.be.revertedWith('TRANSFER_FROM_FAILED');
      });

      it('should be able to stake', async () => {
        await stake(user1, STAKE_AMOUNT);

        expect(await jointCampaignUser1.balanceOf(user1.address)).to.be.eq(STAKE_AMOUNT);
      });
    });

    describe('#slash', () => {
      beforeEach(setup);

      it('should not be able to slash if user has the amount of their debt snapshot', async () => {
        await stake(user1, STAKE_AMOUNT);

        await expect(jointCampaignUser2.slash(user1.address)).to.be.revertedWith(
          "You can't slash a user who is a valid minter",
        );
      });

      it('should revert if trying to slash after the end of the reward period', async () => {
        const positionId = await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(REWARD_DURATION);

        await arc.repay(positionId, BORROW_AMOUNT.div(2), BigNumber.from(0), user1);

        await expect(jointCampaignUser2.slash(user1.address)).to.be.revertedWith(
          'You cannot slash after the reward period',
        );
      });

      it('should be able to slash if the user does not have enough debt', async () => {
        // note: check for both rewards
        const positionId = await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        await arc.repay(positionId, BORROW_AMOUNT.div(2), BigNumber.from(0), user1);

        await jointCampaignUser2.slash(user1.address);

        const dao = await jointCampaignUser1.stakers(owner.address);

        // 10 earned, 3 slasher's cut * 0.6 (user allocation) = 1.8
        expect(await jointCampaignUser2.arcEarned(user2.address)).to.eq(ArcDecimal.new(1.8).value);
        expect(await jointCampaignUser2.collabEarned(user2.address)).to.eq(ArcNumber.new(20));
        expect(dao.arcRewardsEarned).to.eq(ArcNumber.new(7));
      });
    });

    describe('#getReward', () => {
      beforeEach(setup);

      it('should revert if no rewards are claimable', async () => {
        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        await expect(jointCampaignUser1.getReward(user1.address)).to.be.revertedWith(
          'At least one reward token must be claimable',
        );
      });

      it('should be able to claim both rewards gradually over time', async () => {
        await jointCampaignOwner.setArcTokensClaimable(true);
        await jointCampaignOwner.setCollabTokensClaimable(true);

        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        await jointCampaignUser1.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(ArcNumber.new(6));
        expect(await collabToken.balanceOf(user1.address)).to.eq(ArcNumber.new(20));

        await setTimestampTo(2);

        await jointCampaignUser1.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(ArcNumber.new(12));
        expect(await collabToken.balanceOf(user1.address)).to.eq(ArcNumber.new(40));
      });

      it('should be able to claim the right amount of rewards given the number of participants', async () => {
        await jointCampaignOwner.setArcTokensClaimable(true);
        await jointCampaignOwner.setCollabTokensClaimable(true);

        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        await jointCampaignUser1.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(ArcNumber.new(6));
        expect(await collabToken.balanceOf(user1.address)).to.eq(ArcNumber.new(20));

        await setTimestampTo(2);

        await stake(user2, STAKE_AMOUNT);

        await setTimestampTo(3);

        await jointCampaignUser1.getReward(user1.address);
        await jointCampaignUser2.getReward(user2.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(ArcDecimal.new(15).value);
        expect(await collabToken.balanceOf(user1.address)).to.eq(ArcNumber.new(50));

        expect(await arcToken.balanceOf(user2.address)).to.eq(ArcNumber.new(3));
        expect(await collabToken.balanceOf(user2.address)).to.eq(ArcNumber.new(10));
      });

      it('should claim the correct amount of rewards after calling #notifyRewardAmount a second time', async () => {
        await jointCampaignOwner.setArcTokensClaimable(true);
        await jointCampaignOwner.setCollabTokensClaimable(true);

        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(5);

        await jointCampaignUser1.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(ArcNumber.new(30));
        expect(await collabToken.balanceOf(user1.address)).to.eq(ArcNumber.new(100));

        await arcToken.mintShare(jointCampaignUser1.address, ARC_REWARD_AMOUNT);
        await collabToken.mintShare(jointCampaignUser1.address, COLLAB_REWARD_AMOUNT);
        // call notify reward amount a second time
        await jointCampaignOwner.notifyRewardAmount(ARC_REWARD_AMOUNT, arcToken.address); // arc reward per epoch = 15
        await jointCampaignLido.notifyRewardAmount(COLLAB_REWARD_AMOUNT, collabToken.address); // collab reward per epoch = 30

        await setTimestampTo(6);

        await jointCampaignUser1.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(ArcDecimal.new(39).value); // 30 + 15*0.6
        expect(await collabToken.balanceOf(user1.address)).to.eq(ArcDecimal.new(130).value); // 100 + 30
      });

      it('should claim the collab reward and skip, if the arc tokens are not claimable', async () => {
        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        // No rewards are claimable, expect revert
        await expect(jointCampaignUser1.getReward(user1.address)).to.be.revertedWith(
          'At least one reward token must be claimable',
        );

        expect(await arcToken.balanceOf(user1.address)).to.eq(ArcNumber.new(0));
        expect(await collabToken.balanceOf(user1.address)).to.eq(ArcNumber.new(0));

        await setTimestampTo(2);

        await expect(jointCampaignUser1.getReward(user1.address)).to.be.revertedWith(
          'At least one reward token must be claimable',
        );

        expect(await arcToken.balanceOf(user1.address)).to.eq(ArcNumber.new(0));
        expect(await collabToken.balanceOf(user1.address)).to.eq(ArcNumber.new(0));

        await jointCampaignOwner.setCollabTokensClaimable(true);

        await setTimestampTo(3);

        await jointCampaignUser1.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(ArcNumber.new(0));
        expect(await collabToken.balanceOf(user1.address)).to.eq(ArcNumber.new(60));

        await setTimestampTo(4);

        await jointCampaignUser1.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(ArcNumber.new(0));
        expect(await collabToken.balanceOf(user1.address)).to.eq(ArcNumber.new(80));

        await jointCampaignOwner.setArcTokensClaimable(true);

        await setTimestampTo(5);

        await jointCampaignUser1.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(ArcNumber.new(30));
        expect(await collabToken.balanceOf(user1.address)).to.eq(ArcNumber.new(100));
      });

      it('should update rewards accordingly if user exits in between', async () => {
        await jointCampaignOwner.setArcTokensClaimable(true);
        await jointCampaignOwner.setCollabTokensClaimable(true);

        const positionId = await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        await jointCampaignUser1.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(ArcNumber.new(6));
        expect(await collabToken.balanceOf(user1.address)).to.eq(ArcNumber.new(20));

        await setTimestampTo(2);

        await jointCampaignUser1.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(ArcNumber.new(12));
        expect(await collabToken.balanceOf(user1.address)).to.eq(ArcNumber.new(40));

        await setTimestampTo(3);

        await jointCampaignUser1.exit();

        expect(await arcToken.balanceOf(user1.address)).to.eq(ArcNumber.new(18));
        expect(await collabToken.balanceOf(user1.address)).to.eq(ArcNumber.new(60));

        await setTimestampTo(4);

        await jointCampaignUser1.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(ArcNumber.new(18));
        expect(await collabToken.balanceOf(user1.address)).to.eq(ArcNumber.new(60));

        await setTimestampTo(5);

        await mintAndApprove(stakingToken, user1, STAKE_AMOUNT);
        await jointCampaignUser1.stake(STAKE_AMOUNT, positionId);

        await setTimestampTo(6);

        await jointCampaignUser1.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(ArcNumber.new(24));
        expect(await collabToken.balanceOf(user1.address)).to.eq(ArcNumber.new(80));
      });
    });

    describe('#withdraw', () => {
      beforeEach(setup);

      it('should not be able to withdraw more than the balance', async () => {
        await stake(user1, STAKE_AMOUNT);
        await expect(jointCampaignUser1.withdraw(STAKE_AMOUNT.add(1))).to.be.revertedWith(
          'subtraction overflow',
        );
      });

      it('should withdraw the correct amount', async () => {
        await stake(user1, STAKE_AMOUNT);

        await jointCampaignUser1.withdraw(STAKE_AMOUNT);

        const balance = await stakingToken.balanceOf(user1.address);

        expect(balance).to.eq(STAKE_AMOUNT);
      });
    });

    describe('#exit', () => {
      beforeEach(setup);

      it('should revert if no rewards are claimable', async () => {
        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        await expect(jointCampaignUser1.exit()).to.be.revertedWith(
          'At least one reward token must be claimable',
        );
      });

      it('should be able to exit and get the right amount of staked tokens and rewards', async () => {
        await jointCampaignOwner.setArcTokensClaimable(true);
        await jointCampaignOwner.setCollabTokensClaimable(true);

        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        await jointCampaignUser1.exit();

        const stakingBalance = await stakingToken.balanceOf(user1.address);
        const arcBalance = await arcToken.balanceOf(user1.address);
        const collabBalance = await collabToken.balanceOf(user1.address);

        expect(stakingBalance).to.eq(STAKE_AMOUNT);
        expect(arcBalance).to.eq(ArcNumber.new(6));
        expect(collabBalance).to.eq(ArcNumber.new(20));
      });
    });
  });

  describe('Restricted functions', () => {
    describe('#init', () => {
      it('should not be callable by anyone', async () => {
        await expect(
          jointCampaignUser1.init(
            user1.address,
            user1.address,
            lido.address,
            arcToken.address,
            collabToken.address,
            stakingToken.address,
            DAO_ALLOCATION,
            SLASHER_CUT,
            STAKE_TO_DEBT_RATIO,
            await arc.coreAddress(),
          ),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('should revert if one of the init variables are null', async () => {
        await expect(
          jointCampaignOwner.init(
            user1.address,
            user1.address,
            lido.address,
            arcToken.address,
            collabToken.address,
            stakingToken.address,
            DAO_ALLOCATION,
            SLASHER_CUT,
            BigNumber.from(0),
            await arc.coreAddress(),
          ),
        ).to.be.revertedWith('One or more values is empty');
      });

      it('should skip be callable by the contract owner', async () => {
        await jointCampaignOwner.init(
          owner.address,
          owner.address,
          lido.address,
          arcToken.address,
          collabToken.address,
          stakingToken.address,
          DAO_ALLOCATION,
          SLASHER_CUT,
          STAKE_TO_DEBT_RATIO,
          await arc.coreAddress(),
        );

        const arcDao = await jointCampaignOwner.arcDAO();
        const arcRewardsDistributor = await jointCampaignOwner.arcRewardsDistributor();
        const collabRewardsDistributor = await jointCampaignOwner.collabRewardsDistributor();
        const arcRewardToken = await jointCampaignOwner.arcRewardToken();
        const collabRewardToken = await jointCampaignOwner.collabRewardToken();
        const daoAllocation = await jointCampaignOwner.daoAllocation();
        const slasherCut = await jointCampaignOwner.slasherCut();
        const stakeToDebtRatio = await jointCampaignOwner.stakeToDebtRatio();
        const stateContract = await jointCampaignOwner.stateContract();

        expect(arcDao).to.eq(owner.address);
        expect(arcRewardsDistributor).to.eq(owner.address);
        expect(collabRewardsDistributor).to.eq(lido.address);
        expect(arcRewardToken).to.eq(arcToken.address);
        expect(collabRewardToken).to.eq(collabToken.address);
        expect(daoAllocation).to.eq(DAO_ALLOCATION.value);
        expect(slasherCut).to.eq(SLASHER_CUT.value);
        expect(stakeToDebtRatio).to.eq(STAKE_TO_DEBT_RATIO);
        expect(stateContract).to.eq(await arc.coreAddress());

        expect(await jointCampaignOwner.isInitialized()).to.be.true;
      });

      it('should not be callable by owner a second time', async () => {
        await jointCampaignOwner.init(
          owner.address,
          owner.address,
          lido.address,
          arcToken.address,
          collabToken.address,
          stakingToken.address,
          DAO_ALLOCATION,
          SLASHER_CUT,
          STAKE_TO_DEBT_RATIO,
          await arc.coreAddress(),
        );

        await expect(
          jointCampaignOwner.init(
            owner.address,
            owner.address,
            lido.address,
            arcToken.address,
            collabToken.address,
            stakingToken.address,
            DAO_ALLOCATION,
            SLASHER_CUT,
            STAKE_TO_DEBT_RATIO,
            await arc.coreAddress(),
          ),
        ).to.be.revertedWith('One or more values is empty');
      });
    });

    describe('#setcollabRewardsDistributor', () => {
      beforeEach(setup);

      it('should not be callable by anyone', async () => {
        await expect(
          jointCampaignUser1.setcollabRewardsDistributor(user1.address),
        ).to.be.revertedWith('Caller is not the collab rewards distributor');
      });

      it('should set rewards distributor if called by current collabRewardsDistributor', async () => {
        await jointCampaignLido.setcollabRewardsDistributor(owner.address);

        expect(await jointCampaignOwner.collabRewardsDistributor()).to.eq(owner.address);
      });
    });

    describe('#setArcRewardsDistributor', () => {
      it('should not be callable by anyone', async () => {
        await expect(jointCampaignUser1.setArcRewardsDistributor(user1.address)).to.be.revertedWith(
          'Ownable: caller is not the owner',
        );
      });

      it('should set rewards distributor if called by owner', async () => {
        await jointCampaignOwner.setArcRewardsDistributor(owner.address);

        expect(await jointCampaignOwner.arcRewardsDistributor()).to.eq(owner.address);
      });
    });

    describe('#setRewardsDuration', () => {
      it('should not be called by anyone', async () => {
        await expect(
          jointCampaignUser1.setRewardsDuration(BigNumber.from(REWARD_DURATION)),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('should skip be callable by the contract owner and set the right duration', async () => {
        const duration = BigNumber.from(REWARD_DURATION);

        await jointCampaignOwner.setRewardsDuration(duration);

        expect(await jointCampaignOwner.rewardsDuration()).to.eq(duration);
      });
    });

    describe('#notifyRewardAmount', () => {
      beforeEach(setupBasic);

      it('should not be callable by anyone', async () => {
        await expect(
          jointCampaignUser1.notifyRewardAmount(ARC_REWARD_AMOUNT, arcToken.address),
        ).to.be.revertedWith('Caller is not a reward distributor');
        await expect(
          jointCampaignUser1.notifyRewardAmount(COLLAB_REWARD_AMOUNT, collabToken.address),
        ).to.be.revertedWith('Caller is not a reward distributor');
      });

      it('should be callable by the arc distributor', async () => {
        await jointCampaignOwner.notifyRewardAmount(ARC_REWARD_AMOUNT, arcToken.address);

        expect(await jointCampaignOwner.arcRewardRate()).to.eq(ArcNumber.new(10));
      });

      it('should be callable by the collab distributor', async () => {
        await jointCampaignLido.notifyRewardAmount(COLLAB_REWARD_AMOUNT, collabToken.address);

        expect(await jointCampaignOwner.collabRewardRate()).to.eq(ArcNumber.new(20));
      });

      it('should revert if ARCx reward amount is less than the amount of ARCx on the contract', async () => {
        await expect(
          jointCampaignOwner.notifyRewardAmount(
            ARC_REWARD_AMOUNT.add(ArcNumber.new(1)),
            arcToken.address,
          ),
        ).to.be.revertedWith('Provided reward too high for the balance of ARCx token');
      });

      it('should revert if collab reward amount is less than the amount of collab on the contract', async () => {
        await expect(
          jointCampaignLido.notifyRewardAmount(
            COLLAB_REWARD_AMOUNT.add(ArcNumber.new(1)),
            collabToken.address,
          ),
        ).to.be.revertedWith('Provided reward too high for the balance of collab token');
      });

      it('should revert if ARCx distributor tries to notify the collab rewards', async () => {
        await expect(
          jointCampaignOwner.notifyRewardAmount(COLLAB_REWARD_AMOUNT.add(1), collabToken.address),
        ).to.be.revertedWith(
          'Only the collab rewards distributor can notify the amount of collab rewards',
        );
      });

      it('should revert if collab distributor tries to notify the ARCx rewards', async () => {
        await expect(
          jointCampaignLido.notifyRewardAmount(ARC_REWARD_AMOUNT.add(1), arcToken.address),
        ).to.be.revertedWith(
          'Only the ARCx rewards distributor can notify the amount of ARCx rewards',
        );
      });

      it('should update arc rewards correctly after a new reward update', async () => {
        await jointCampaignOwner.notifyRewardAmount(ARC_REWARD_AMOUNT, arcToken.address);

        expect(await jointCampaignOwner.arcRewardRate()).to.eq(ArcNumber.new(10));

        await setTimestampTo(1);

        await arcToken.mintShare(jointCampaignOwner.address, ARC_REWARD_AMOUNT);
        await jointCampaignOwner.notifyRewardAmount(ARC_REWARD_AMOUNT, arcToken.address);

        expect(await jointCampaignOwner.arcRewardRate()).to.eq(ArcNumber.new(19)); // 90 remaining + 100 = 190 / 10 = 19
      });

      it('should update collab rewards correctly after a new reward update', async () => {
        await jointCampaignLido.notifyRewardAmount(COLLAB_REWARD_AMOUNT, collabToken.address);

        expect(await jointCampaignOwner.collabRewardRate()).to.eq(ArcNumber.new(20));

        await setTimestampTo(1);

        await collabToken.mintShare(jointCampaignOwner.address, COLLAB_REWARD_AMOUNT);
        await jointCampaignLido.notifyRewardAmount(COLLAB_REWARD_AMOUNT, collabToken.address);

        expect(await jointCampaignOwner.collabRewardRate()).to.eq(ArcNumber.new(38)); // 180 remaining + 200 = 380 / 10 = 38
      });
    });

    describe('#recoverERC20', () => {
      const erc20Share = ArcNumber.new(10);

      beforeEach(async () => {
        await otherErc20.mintShare(jointCampaignOwner.address, erc20Share);
      });

      it('should not be callable by anyone', async () => {
        await expect(
          jointCampaignUser1.recoverERC20(otherErc20.address, erc20Share),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('should not recover staking or collab', async () => {
        await setup();
        await stakingToken.mintShare(jointCampaignOwner.address, erc20Share);
        await collabToken.mintShare(jointCampaignOwner.address, erc20Share);

        await expect(
          jointCampaignOwner.recoverERC20(stakingToken.address, erc20Share),
        ).to.be.revertedWith('Cannot withdraw the staking or collab reward tokens');
        await expect(
          jointCampaignOwner.recoverERC20(collabToken.address, erc20Share),
        ).to.be.revertedWith('Cannot withdraw the staking or collab reward tokens');
      });

      it('should revert if owner tries to recover a greater amount of ARC than the surplus reward amount', async () => {
        await setup();

        await arcToken.mintShare(jointCampaignOwner.address, erc20Share);

        await expect(
          jointCampaignOwner.recoverERC20(arcToken.address, erc20Share.add(1)),
        ).to.be.revertedWith('Only the surplus of the reward can be recovered, not more');
      });

      it('should let owner recover the erc20 on this contract', async () => {
        const balance0 = await otherErc20.balanceOf(owner.address);

        await jointCampaignOwner.recoverERC20(otherErc20.address, erc20Share);

        const balance1 = await otherErc20.balanceOf(owner.address);

        expect(balance1).to.eq(balance0.add(erc20Share));
      });

      it('should let owner recover the surplus of ARC on the contract', async () => {
        await setup();

        await arcToken.mintShare(jointCampaignOwner.address, erc20Share);

        const arcBalance = await arcToken.balanceOf(owner.address);

        await jointCampaignOwner.recoverERC20(arcToken.address, erc20Share);

        expect(await arcToken.balanceOf(owner.address)).to.eq(arcBalance.add(erc20Share));
      });
    });

    describe('#recovercollab', () => {
      it('should not be callable by anyone', async () => {
        await expect(jointCampaignUser1.recovercollab(ArcNumber.new(10))).to.be.revertedWith(
          'Caller is not the collab rewards distributor',
        );
      });

      it('should revert if lido tries to recover a greater amount of ARC than the surplus reward amount', async () => {
        await setup();

        await collabToken.mintShare(jointCampaignLido.address, ArcNumber.new(10));

        await expect(jointCampaignLido.recovercollab(ArcNumber.new(11))).to.be.revertedWith(
          'Only the surplus of the reward can be recovered, not more',
        );
      });

      it('should let collab reward distributor recover the surplus of collab on the contract', async () => {
        await setup();

        await collabToken.mintShare(jointCampaignLido.address, ArcNumber.new(10));

        const balance = await collabToken.balanceOf(lido.address);

        await jointCampaignLido.recovercollab(ArcNumber.new(10));

        expect(await collabToken.balanceOf(lido.address)).to.eq(balance.add(ArcNumber.new(10)));
      });
    });

    describe('#setArcTokensClaimable', () => {
      it('should not be claimable by anyone', async () => {
        await expect(jointCampaignUser1.setArcTokensClaimable(true)).to.be.revertedWith(
          'Ownable: caller is not the owner',
        );
      });

      it('should be callable by the contract owner', async () => {
        await jointCampaignOwner.setArcTokensClaimable(true);

        expect(await jointCampaignOwner.arcTokensClaimable()).to.be.eq(true);
      });
    });
  });

  describe('#setCollabTokensClaimable', () => {
    it('should not be called by anyone', async () => {
      await expect(jointCampaignUser1.setCollabTokensClaimable(true)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('should be callable by the contract owner', async () => {
      await jointCampaignOwner.setCollabTokensClaimable(true);

      expect(await jointCampaignOwner.collabTokensClaimable()).to.be.eq(true);
    });
  });

  describe('Scenarios', () => {
    it('should distribut rewards to 3 users correctly', async () => {
      await setupBasic();
      await jointCampaignOwner.setRewardsDuration(20);

      const signers = await ethers.getSigners();
      const user3 = signers[4];
      const jointCampaignUser3 = MockJointCampaignFactory.connect(
        jointCampaignOwner.address,
        user3,
      );
      let user3Position: BigNumberish;

      const arcRewardAmount = ArcNumber.new(150);
      const lidoRewardAmount = ArcNumber.new(300);

      await stake(user1, STAKE_AMOUNT);

      await setTimestampTo(1);

      await stake(user2, STAKE_AMOUNT);

      await setTimestampTo(3);

      await arcToken.mintShare(jointCampaignOwner.address, arcRewardAmount);
      await jointCampaignOwner.notifyRewardAmount(arcRewardAmount, arcToken.address);

      expect(await arcEarned(user1)).to.eq(ArcDecimal.new(0).value);
      expect(await arcEarned(user2)).to.eq(ArcDecimal.new(0).value);
      expect(await arcEarned(user2)).to.eq(ArcDecimal.new(0).value);
      expect(await lidoEarned(user2)).to.eq(ArcDecimal.new(0).value);

      await setTimestampTo(4);

      expect(await arcEarned(user1)).to.eq(ArcDecimal.new(3.75).value);
      expect(await lidoEarned(user1)).to.eq(ArcDecimal.new(0).value);
      expect(await arcEarned(user2)).to.eq(ArcDecimal.new(3.75).value);
      expect(await lidoEarned(user2)).to.eq(ArcDecimal.new(0).value);

      await setTimestampTo(5);

      await collabToken.mintShare(jointCampaignOwner.address, lidoRewardAmount);
      await jointCampaignLido.notifyRewardAmount(lidoRewardAmount, collabToken.address);

      expect(await arcEarned(user1)).to.eq(ArcDecimal.new(7.5).value);
      expect(await lidoEarned(user1)).to.eq(ArcDecimal.new(0).value);
      expect(await arcEarned(user2)).to.eq(ArcDecimal.new(7.5).value);
      expect(await lidoEarned(user2)).to.eq(ArcDecimal.new(0).value);

      await setTimestampTo(6);

      expect(await arcEarned(user1)).to.eq(ArcDecimal.new(11.25).value);
      expect(await lidoEarned(user1)).to.eq(ArcDecimal.new(7.5).value);
      expect(await arcEarned(user2)).to.eq(ArcDecimal.new(11.25).value);
      expect(await lidoEarned(user2)).to.eq(ArcDecimal.new(7.5).value);

      await setTimestampTo(7);

      // no rewards are claimable -> revert
      await expect(jointCampaignUser1.getReward(user1.address)).to.be.revertedWith(
        'At least one reward token must be claimable',
      );

      await setTimestampTo(9);

      await jointCampaignOwner.setCollabTokensClaimable(true);

      expect(await arcEarned(user1)).to.eq(ArcDecimal.new(22.5).value);
      expect(await lidoEarned(user1)).to.eq(ArcDecimal.new(30).value);
      expect(await arcEarned(user2)).to.eq(ArcDecimal.new(22.5).value);
      expect(await lidoEarned(user2)).to.eq(ArcDecimal.new(30).value);

      await setTimestampTo(10);

      user3Position = await stake(user3, STAKE_AMOUNT);

      expect(await arcEarned(user1)).to.eq(ArcDecimal.new(26.25).value);
      expect(await lidoEarned(user1)).to.eq(ArcDecimal.new(37.5).value);
      expect(await arcEarned(user2)).to.eq(ArcDecimal.new(26.25).value);
      expect(await lidoEarned(user2)).to.eq(ArcDecimal.new(37.5).value);
      expect(await arcEarned(user3)).to.eq(ArcDecimal.new(0).value);
      expect(await lidoEarned(user3)).to.eq(ArcDecimal.new(0).value);

      await setTimestampTo(11);

      await jointCampaignUser2.getReward(user2.address);

      expect(await arcToken.balanceOf(user2.address)).to.eq(BigNumber.from(0)); // ARC tokens not yet claimable
      expect(await collabToken.balanceOf(user2.address)).to.eq(ArcDecimal.new(42.5).value);

      expect(await arcEarned(user1)).to.eq(ArcDecimal.new(28.75).value);
      expect(await lidoEarned(user1)).to.eq(ArcDecimal.new(42.5).value);
      expect(await arcEarned(user2)).to.eq(ArcDecimal.new(28.75).value);
      expect(await lidoEarned(user2)).to.eq(ArcDecimal.new(42.5).value);
      expect(await arcEarned(user3)).to.eq(ArcDecimal.new(2.5).value);
      expect(await lidoEarned(user3)).to.eq(ArcDecimal.new(5).value);

      await setTimestampTo(12);

      await arcToken.mintShare(jointCampaignOwner.address, arcRewardAmount);
      await jointCampaignOwner.notifyRewardAmount(arcRewardAmount, arcToken.address);

      await setTimestampTo(13);

      await jointCampaignOwner.setCollabTokensClaimable(false);

      expect(await arcEarned(user1)).to.eq(ArcDecimal.new(35.125).value);
      expect(await lidoEarned(user1)).to.eq(ArcDecimal.new(52.5).value);
      expect(await arcEarned(user2)).to.eq(ArcDecimal.new(35.125).value);
      expect(await lidoEarned(user2)).to.eq(ArcDecimal.new(52.5).value);
      expect(await arcEarned(user3)).to.eq(ArcDecimal.new(8.875).value);
      expect(await lidoEarned(user3)).to.eq(ArcDecimal.new(15).value);

      await setTimestampTo(15);

      // reverts because no rewards are claimable
      await expect(jointCampaignUser1.getReward(user1.address)).to.be.revertedWith(
        'At least one reward token must be claimable',
      );

      await setTimestampTo(19);

      await jointCampaignOwner.setArcTokensClaimable(true);

      expect(await arcEarned(user1)).to.eq(ArcDecimal.new(58.375).value);
      expect(await lidoEarned(user1)).to.eq(ArcDecimal.new(82.5).value);
      expect(await arcEarned(user2)).to.eq(ArcDecimal.new(58.375).value);
      expect(await lidoEarned(user2)).to.eq(ArcDecimal.new(82.5).value);
      expect(await arcEarned(user3)).to.eq(ArcDecimal.new(32.125).value);
      expect(await lidoEarned(user3)).to.eq(ArcDecimal.new(45).value);

      await setTimestampTo(21);

      await jointCampaignOwner.setCollabTokensClaimable(true);

      expect(await arcEarned(user1)).to.eq(ArcDecimal.new(66.125).value);
      expect(await lidoEarned(user1)).to.eq(ArcDecimal.new(92.5).value);
      expect(await arcEarned(user2)).to.eq(ArcDecimal.new(66.125).value);
      expect(await lidoEarned(user2)).to.eq(ArcDecimal.new(92.5).value);
      expect(await arcEarned(user3)).to.eq(ArcDecimal.new(39.875).value);
      expect(await lidoEarned(user3)).to.eq(ArcDecimal.new(55).value);

      await setTimestampTo(22);

      await jointCampaignUser2.exit();

      expect(await stakingToken.balanceOf(user2.address)).to.eq(STAKE_AMOUNT);
      expect(await arcToken.balanceOf(user2.address)).to.eq(ArcDecimal.new(42).value); // 70 * 0.6
      expect(await collabToken.balanceOf(user2.address)).to.eq(ArcDecimal.new(97.5).value);

      expect(await arcEarned(user1)).to.eq(ArcDecimal.new(70).value);
      expect(await lidoEarned(user1)).to.eq(ArcDecimal.new(97.5).value);
      expect(await arcEarned(user2)).to.eq(ArcDecimal.new(70).value);
      expect(await lidoEarned(user2)).to.eq(ArcDecimal.new(97.5).value);
      expect(await arcEarned(user3)).to.eq(ArcDecimal.new(43.75).value);
      expect(await lidoEarned(user3)).to.eq(ArcDecimal.new(60).value);

      await setTimestampTo(24);

      await jointCampaignUser3.exit();

      expect(await stakingToken.balanceOf(user3.address)).to.eq(STAKE_AMOUNT);
      expect(await arcToken.balanceOf(user3.address)).to.eq(ArcDecimal.new(33.225).value); // 55.375 * 0.6
      expect(await collabToken.balanceOf(user3.address)).to.eq(ArcDecimal.new(75).value);

      expect(await arcEarned(user1)).to.eq(ArcDecimal.new(81.625).value);
      expect(await lidoEarned(user1)).to.eq(ArcDecimal.new(112.5).value);
      expect(await arcEarned(user2)).to.eq(ArcDecimal.new(70).value);
      expect(await lidoEarned(user2)).to.eq(ArcDecimal.new(97.5).value);
      expect(await arcEarned(user3)).to.eq(ArcDecimal.new(55.375).value);
      expect(await lidoEarned(user3)).to.eq(ArcDecimal.new(75).value);

      await setTimestampTo(25);

      const user3StakingToken = TestTokenFactory.connect(stakingToken.address, user3);
      await user3StakingToken.approve(jointCampaignUser3.address, STAKE_AMOUNT);
      await jointCampaignUser3.stake(STAKE_AMOUNT, user3Position);

      expect(await arcEarned(user1)).to.eq(ArcDecimal.new(93.25).value);
      expect(await lidoEarned(user1)).to.eq(ArcDecimal.new(127.5).value);
      expect(await arcEarned(user2)).to.eq(ArcDecimal.new(70).value);
      expect(await lidoEarned(user2)).to.eq(ArcDecimal.new(97.5).value);
      expect(await arcEarned(user3)).to.eq(ArcDecimal.new(55.375).value);
      expect(await lidoEarned(user3)).to.eq(ArcDecimal.new(75).value);

      await setTimestampTo(32);

      expect(await arcEarned(user1)).to.eq(ArcDecimal.new(133.9375).value);
      expect(await lidoEarned(user1)).to.eq(ArcDecimal.new(127.5).value);
      expect(await arcEarned(user2)).to.eq(ArcDecimal.new(70).value);
      expect(await lidoEarned(user2)).to.eq(ArcDecimal.new(97.5).value);
      expect(await arcEarned(user3)).to.eq(ArcDecimal.new(96.0625).value);
      expect(await lidoEarned(user3)).to.eq(ArcDecimal.new(75).value);

      await setTimestampTo(40);

      await jointCampaignUser3.exit();
      await jointCampaignUser1.exit();

      expect(await stakingToken.balanceOf(user1.address)).to.eq(STAKE_AMOUNT);
      expect(await arcToken.balanceOf(user1.address)).to.eq(ArcDecimal.new(80.3625).value); // 133.9375 * 0.6
      expect(await collabToken.balanceOf(user1.address)).to.eq(ArcDecimal.new(127.5).value);

      expect(await stakingToken.balanceOf(user2.address)).to.eq(STAKE_AMOUNT);
      expect(await arcToken.balanceOf(user2.address)).to.eq(ArcDecimal.new(42).value); // 70 * 0.6
      expect(await collabToken.balanceOf(user2.address)).to.eq(ArcDecimal.new(97.5).value);

      expect(await stakingToken.balanceOf(user3.address)).to.eq(STAKE_AMOUNT);
      expect(await arcToken.balanceOf(user3.address)).to.eq(ArcDecimal.new(57.6375).value); // 96.0625 * 0.6
      expect(await collabToken.balanceOf(user3.address)).to.eq(ArcDecimal.new(75).value);
    });
  });
});
