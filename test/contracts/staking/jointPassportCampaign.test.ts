import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  JointPassportCampaignFactory,
  TestToken,
  TestTokenFactory,
  MockJointPassportCampaign,
  MockJointPassportCampaignFactory,
  MockSapphirePassportScores,
} from '@src/typings';
import { deployTestToken } from '../deployers';
import { BigNumber, utils } from 'ethers';
import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import {
  addSnapshotBeforeRestoreAfterEach,
  immediatelyUpdateMerkleRoot,
} from '@test/helpers/testingUtils';
import { getEmptyScoreProof, getScoreProof } from '@src/utils/getScoreProof';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';
import _ from 'lodash';
import { BASE } from '@src/constants';
import { ethers } from 'hardhat';
import { PassportScore, PassportScoreProof } from '@arc-types/sapphireCore';
import { PassportScoreTree } from '@src/MerkleTree';
import { DEFAULT_PROOF_PROTOCOL } from '@test/helpers/sapphireDefaults';

chai.use(solidity);
const expect = chai.expect;

const ARC_REWARD_AMOUNT = utils.parseEther('100');
const COLLAB_REWARD_AMOUNT = utils.parseEther('200');
const STAKE_AMOUNT = utils.parseEther('10');
const MAX_STAKE_PER_USER = STAKE_AMOUNT.mul(2);
const REWARD_DURATION = 10;

const DAO_ALLOCATION = utils.parseEther('0.4');

const CREDIT_SCORE_THRESHOLD = BigNumber.from(500);

describe('JointPassportCampaign', () => {
  let ctx: ITestContext;

  /**
   * Instance connected with the owner (ARC account)
   */
  let arcPassportCampaign: MockJointPassportCampaign;
  let collabPassportCampaign: MockJointPassportCampaign;
  let user1PassportCampaign: MockJointPassportCampaign;
  let user2PassportCampaign: MockJointPassportCampaign;

  let creditScoreContract: MockSapphirePassportScores;

  let user1CreditScore: PassportScore;
  let user2CreditScore: PassportScore;
  let unauthorizedCreditScore: PassportScore;

  let user1ScoreProof: PassportScoreProof;
  let user1OtherProtoScoreProof: PassportScoreProof;
  let user2ScoreProof: PassportScoreProof;
  let unauthorizedScoreProof: PassportScoreProof;

  let creditScoreTree: PassportScoreTree;

  let stakingToken: TestToken;
  let arcToken: TestToken;
  let collabToken: TestToken;

  let admin: SignerWithAddress; // the owner of the contract
  let collab: SignerWithAddress; // the collab reward distributor
  let user1: SignerWithAddress; // main staker
  let user2: SignerWithAddress; // another staker w/ valid credit score
  let unauthorized: SignerWithAddress; // low credit score

  async function setTimestampTo(timestamp: number) {
    await arcPassportCampaign.setCurrentTimestamp(timestamp);
  }

  async function stake(
    user: SignerWithAddress,
    amount: BigNumber,
    scoreProof?: PassportScoreProof,
  ) {
    await mintAndApprove(stakingToken, user, amount);
    // await arcPassportCampaign.connect(user).stake(amount, scoreProof);
    return arcPassportCampaign
      .connect(user)
      .stake(amount, scoreProof || getEmptyScoreProof(user.address));
  }

  async function mintAndApprove(
    token: TestToken,
    tokenReceiver: SignerWithAddress,
    amount: BigNumber,
  ) {
    const tokenContract = TestTokenFactory.connect(
      token.address,
      tokenReceiver,
    );
    await tokenContract.mintShare(tokenReceiver.address, amount);
    await tokenContract.approve(arcPassportCampaign.address, amount);
  }

  async function withdraw(
    user: SignerWithAddress,
    amount: BigNumber = STAKE_AMOUNT,
  ) {
    await arcPassportCampaign.connect(user).withdraw(amount);
  }

  async function exitCampaign(user: SignerWithAddress) {
    await arcPassportCampaign.connect(user).exit();
  }

  async function claimReward(user: SignerWithAddress) {
    await arcPassportCampaign.connect(user).getReward(user.address);
  }

  function rewardBalanceOf(
    user: SignerWithAddress,
    token: TestToken,
  ): Promise<BigNumber> {
    return token.balanceOf(user.address);
  }

  function earned(
    user: SignerWithAddress,
    token: TestToken,
  ): Promise<BigNumber> {
    return arcPassportCampaign.actualEarned(user.address, token.address);
  }

  /**
   * Initializes the contract, sets the reward duration and sets the
   * timestamp to 0.
   */
  async function deployCampaign() {
    if (!admin) {
      throw 'Admin cannot be null';
    }

    const passportCampaign = await new MockJointPassportCampaignFactory(
      admin,
    ).deploy(
      admin.address,
      admin.address,
      collab.address,
      arcToken.address,
      collabToken.address,
      stakingToken.address,
      creditScoreContract.address,
      DAO_ALLOCATION,
      MAX_STAKE_PER_USER,
      CREDIT_SCORE_THRESHOLD,
    );

    await passportCampaign.setRewardsDuration(REWARD_DURATION);
    await passportCampaign.setCurrentTimestamp(0);

    return passportCampaign;
  }

  /**
   * Initializes the contract, mints the rewards to the contract, then calls
   * `notifyRewardAmount()` for both reward tokens.
   */
  async function notifyRewards() {
    await arcToken.mintShare(arcPassportCampaign.address, ARC_REWARD_AMOUNT);
    await collabToken.mintShare(
      arcPassportCampaign.address,
      COLLAB_REWARD_AMOUNT,
    );

    await arcPassportCampaign.notifyRewardAmount(
      ARC_REWARD_AMOUNT,
      arcToken.address,
    );
    await arcPassportCampaign
      .connect(collab)
      .notifyRewardAmount(COLLAB_REWARD_AMOUNT, collabToken.address);
  }

  async function init(ctx: ITestContext) {
    const signers = await ctx.signers;
    admin = signers.admin;
    collab = signers.positionOperator;
    user1 = signers.staker;
    user2 = signers.minter;
    unauthorized = signers.unauthorized;

    user1CreditScore = {
      account: user1.address,
      protocol: DEFAULT_PROOF_PROTOCOL,
      score: CREDIT_SCORE_THRESHOLD,
    };

    const user1OtherProtoScore = {
      ...user1CreditScore,
      protocol: 'defi.other',
    };

    user2CreditScore = {
      account: user2.address,
      protocol: DEFAULT_PROOF_PROTOCOL,
      score: CREDIT_SCORE_THRESHOLD,
    };

    unauthorizedCreditScore = {
      account: unauthorized.address,
      protocol: DEFAULT_PROOF_PROTOCOL,
      score: CREDIT_SCORE_THRESHOLD.sub(10),
    };

    creditScoreTree = new PassportScoreTree([
      user1CreditScore,
      user1OtherProtoScore,
      user2CreditScore,
      unauthorizedCreditScore,
    ]);

    user1ScoreProof = getScoreProof(user1CreditScore, creditScoreTree);
    user1OtherProtoScoreProof = getScoreProof(
      user1OtherProtoScore,
      creditScoreTree,
    );
    user2ScoreProof = getScoreProof(user2CreditScore, creditScoreTree);
    unauthorizedScoreProof = getScoreProof(
      unauthorizedCreditScore,
      creditScoreTree,
    );
  }

  before(async () => {
    ctx = await generateContext(sapphireFixture, init);
    await setupSapphire(ctx, {
      merkleRoot: creditScoreTree.getHexRoot(),
    });

    creditScoreContract = ctx.contracts.sapphire.passportScores;

    stakingToken = await deployTestToken(admin, 'Staking Token', 'STK');
    arcToken = await deployTestToken(admin, 'Arc Token', 'ARC');
    collabToken = await deployTestToken(admin, 'Collab reward token', 'CLB');

    arcPassportCampaign = await deployCampaign();

    collabPassportCampaign = arcPassportCampaign.connect(collab);
    user1PassportCampaign = arcPassportCampaign.connect(user1);
    user2PassportCampaign = arcPassportCampaign.connect(user2);

    await mintAndApprove(stakingToken, user1, STAKE_AMOUNT);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#constructor', () => {
    it('reverts if the variables are null', async () => {
      await expect(
        new JointPassportCampaignFactory(user1).deploy(
          user1.address,
          user1.address,
          collab.address,
          arcToken.address,
          collabToken.address,
          stakingToken.address,
          creditScoreContract.address,
          DAO_ALLOCATION,
          MAX_STAKE_PER_USER,
          BigNumber.from(0),
        ),
      ).to.be.revertedWith(
        'JointPassportCampaign: one or more values is empty',
      );
    });

    it('initializes the variables correctly', async () => {
      const campaign = await new JointPassportCampaignFactory(user1).deploy(
        user1.address,
        user1.address,
        collab.address,
        arcToken.address,
        collabToken.address,
        stakingToken.address,
        creditScoreContract.address,
        DAO_ALLOCATION,
        MAX_STAKE_PER_USER,
        CREDIT_SCORE_THRESHOLD,
      );

      const arcDao = await campaign.arcDAO();
      const rewardsDistributor = await campaign.rewardsDistributor();
      const collabRewardsDistributor = await campaign.collabRewardsDistributor();
      const _arcToken = await campaign.rewardToken();
      const _collabToken = await campaign.collabRewardToken();
      const _stakingToken = await campaign.stakingToken();
      const _creditScoreContract = await campaign.passportScoresContract();
      const daoAllocation = await campaign.daoAllocation();
      const maxStakePerUser = await campaign.maxStakePerUser();
      const creditScoreThreshold = await campaign.creditScoreThreshold();

      expect(arcDao).to.eq(user1.address);
      expect(rewardsDistributor).to.eq(user1.address);
      expect(collabRewardsDistributor).to.eq(collab.address);
      expect(_arcToken).to.eq(arcToken.address);
      expect(_collabToken).to.eq(collabToken.address);
      expect(_stakingToken).to.eq(stakingToken.address);
      expect(_creditScoreContract).to.eq(creditScoreContract.address);
      expect(daoAllocation).to.eq(DAO_ALLOCATION);
      expect(maxStakePerUser).to.eq(MAX_STAKE_PER_USER);
      expect(creditScoreThreshold).to.eq(CREDIT_SCORE_THRESHOLD);
    });
  });

  describe('View functions', () => {
    describe('#totalSupply', () => {
      it('should return the correct amount of staking tokens', async () => {
        await notifyRewards();

        expect(await arcPassportCampaign.totalSupply()).to.eq(
          BigNumber.from(0),
        );

        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        expect(await arcPassportCampaign.totalSupply()).to.eq(STAKE_AMOUNT);

        await stake(user2, STAKE_AMOUNT, user2ScoreProof);

        expect(await arcPassportCampaign.totalSupply()).to.eq(
          STAKE_AMOUNT.mul(2),
        );
      });
    });

    describe('#balanceOf', () => {
      beforeEach(notifyRewards);

      it('should return 0 if user did not stake', async () => {
        expect(await arcPassportCampaign.balanceOf(user1.address)).to.eq(
          BigNumber.from(0),
        );
      });

      it('should return the correct balance after staking', async () => {
        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        expect(await arcPassportCampaign.balanceOf(user1.address)).to.eq(
          STAKE_AMOUNT,
        );
      });
    });

    describe('#lastTimeRewardApplicable', () => {
      beforeEach(notifyRewards);

      it('arc: should return the block timestamp if called after the collab reward period but before the arc reward period', async () => {
        await setTimestampTo(REWARD_DURATION / 2);

        await arcToken.mintShare(
          arcPassportCampaign.address,
          ARC_REWARD_AMOUNT,
        );
        await arcPassportCampaign.notifyRewardAmount(
          ARC_REWARD_AMOUNT,
          arcToken.address,
        );

        await setTimestampTo(REWARD_DURATION);

        expect(
          await arcPassportCampaign.lastTimeRewardApplicable(arcToken.address),
        ).to.eq(REWARD_DURATION);
      });

      it('collab: should return the block timestamp if called after the arc reward period but before the collab reward period', async () => {
        await setTimestampTo(REWARD_DURATION / 2);

        await collabToken.mintShare(
          arcPassportCampaign.address,
          COLLAB_REWARD_AMOUNT,
        );
        await collabPassportCampaign.notifyRewardAmount(
          COLLAB_REWARD_AMOUNT,
          collabToken.address,
        );

        await setTimestampTo(REWARD_DURATION);

        expect(
          await arcPassportCampaign.lastTimeRewardApplicable(
            collabToken.address,
          ),
        ).to.eq(REWARD_DURATION);
      });

      it('arc: should return the arc reward period if called after the arc reward period but before the renewed collab reward period', async () => {
        await setTimestampTo(REWARD_DURATION / 2);

        await collabToken.mintShare(
          arcPassportCampaign.address,
          COLLAB_REWARD_AMOUNT,
        );
        await collabPassportCampaign.notifyRewardAmount(
          COLLAB_REWARD_AMOUNT,
          collabToken.address,
        );

        await setTimestampTo(REWARD_DURATION + 1);

        const arcPeriodFinish = await arcPassportCampaign.periodFinish();
        expect(
          await arcPassportCampaign.lastTimeRewardApplicable(arcToken.address),
        ).to.eq(arcPeriodFinish);
      });

      it('collab: should return the collab reward period if called after the collab reward period but before the arc reward period', async () => {
        await setTimestampTo(REWARD_DURATION / 2);

        await arcToken.mintShare(
          arcPassportCampaign.address,
          ARC_REWARD_AMOUNT,
        );
        await arcPassportCampaign.notifyRewardAmount(
          ARC_REWARD_AMOUNT,
          arcToken.address,
        );

        await setTimestampTo(REWARD_DURATION);

        const collabPeriodFinish = await arcPassportCampaign.collabPeriodFinish();
        expect(
          await arcPassportCampaign.lastTimeRewardApplicable(
            collabToken.address,
          ),
        ).to.eq(collabPeriodFinish);
      });
    });

    describe('#arcRewardPerTokenUser', () => {
      it('should return 0 if the supply is 0', async () => {
        await notifyRewards();
        expect(await arcPassportCampaign.arcRewardPerTokenUser()).to.eq(
          BigNumber.from(0),
        );
      });

      it('should return a valid reward per token after someone staked', async () => {
        await notifyRewards();
        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(1);

        expect(await arcPassportCampaign.arcRewardPerTokenUser()).to.eq(
          utils.parseEther('0.6'),
        );
      });

      it('should return correct reward per token with two users staked', async () => {
        await notifyRewards();

        await stake(user1, STAKE_AMOUNT, user1ScoreProof);
        await stake(user2, STAKE_AMOUNT, user2ScoreProof); // adds 4 epochs; 3.5

        await setTimestampTo(1);

        // (4 epochs * 0.5 RPT + 0.25 RPT) * 0.6 = 1.35
        expect(await arcPassportCampaign.arcRewardPerTokenUser()).to.eq(
          utils.parseEther('0.3'),
        );
      });
    });

    describe('#collabRewardPerToken', () => {
      it('should return the reward per token stored if the supply is 0', async () => {
        await notifyRewards();
        expect(await arcPassportCampaign.collabRewardPerToken()).to.eq(
          BigNumber.from(0),
        );
      });

      it('should return the correct reward per token after someone staked', async () => {
        await notifyRewards();
        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(1);

        expect(await arcPassportCampaign.collabRewardPerToken()).to.eq(
          utils.parseEther('2'),
        );
      });

      it('should return correct reward per token with two tokens staked', async () => {
        await notifyRewards();

        await stake(user1, STAKE_AMOUNT, user1ScoreProof);
        await stake(user2, STAKE_AMOUNT, user2ScoreProof);

        await setTimestampTo(1);

        // 4 epochs * 1 RPT + 0.5 RPT
        expect(await arcPassportCampaign.collabRewardPerToken()).to.eq(
          utils.parseEther('1'),
        );
      });
    });

    describe('#arcEarned', () => {
      it('should return the correct amount of arcx earned over time', async () => {
        await notifyRewards();
        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(1);

        expect(await user1PassportCampaign.arcEarned(user1.address)).to.eq(
          utils.parseEther('6'),
        );

        await setTimestampTo(2);

        expect(await user1PassportCampaign.arcEarned(user1.address)).to.eq(
          utils.parseEther('12'),
        );
      });

      it('should return the correct amount of arcx earned over time while another user stakes in between', async () => {
        await notifyRewards();

        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(1);

        expect(await user1PassportCampaign.arcEarned(user1.address)).to.eq(
          utils.parseEther('6'),
        );

        await setTimestampTo(2);

        await stake(user2, STAKE_AMOUNT, user2ScoreProof);

        await setTimestampTo(3);

        expect(await user1PassportCampaign.arcEarned(user1.address)).to.eq(
          utils.parseEther('15'),
        );
        expect(await user2PassportCampaign.arcEarned(user2.address)).to.eq(
          utils.parseEther('3'),
        );
      });
    });

    describe('#collabEarned', () => {
      beforeEach(notifyRewards);

      it('should return the correct amount of collab earned over time', async () => {
        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(1);

        expect(await user1PassportCampaign.collabEarned(user1.address)).to.eq(
          utils.parseEther('20'),
        );

        await setTimestampTo(2);

        expect(await user1PassportCampaign.collabEarned(user1.address)).to.eq(
          utils.parseEther('40'),
        );
      });

      it('should return the correct amount of collab earned over time while another user stakes in between', async () => {
        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(1);

        expect(await user1PassportCampaign.collabEarned(user1.address)).to.eq(
          utils.parseEther('20'),
        );

        await setTimestampTo(2);

        await stake(user2, STAKE_AMOUNT, user2ScoreProof);

        await setTimestampTo(3);

        expect(await user1PassportCampaign.collabEarned(user1.address)).to.eq(
          utils.parseEther('50'),
        );
        expect(await user2PassportCampaign.collabEarned(user2.address)).to.eq(
          utils.parseEther('10'),
        );
      });
    });

    describe('#userAllocation', () => {
      it('should return the correct user allocation', async () => {
        const userAllocation = await user1PassportCampaign.userAllocation();

        expect(userAllocation).to.eq(BASE.sub(DAO_ALLOCATION));
      });
    });

    describe('#getRewardForDuration', () => {
      it('returns the correct ARC reward for duration', async () => {
        await notifyRewards();
        const rewardForDuration = await arcPassportCampaign.getRewardForDuration();

        expect(rewardForDuration).to.eq(ARC_REWARD_AMOUNT);
      });
    });

    describe('#getCollabRewardForDuration', () => {
      it('returns the correct collab reward for duration', async () => {
        await notifyRewards();
        const rewardForDuration = await arcPassportCampaign.getCollabRewardForDuration();

        expect(rewardForDuration).to.eq(COLLAB_REWARD_AMOUNT);
      });
    });
  });

  describe('Mutative functions', () => {
    describe('#stake', () => {
      it('reverts if called without a valid credit score proof', async () => {
        await expect(stake(user1, STAKE_AMOUNT)).to.be.revertedWith(
          'SapphirePassportScores: invalid proof',
        );
      });

      it('reverts if called by a user with a credit score that is lower than required', async () => {
        await expect(
          stake(unauthorized, STAKE_AMOUNT, unauthorizedScoreProof),
        ).to.be.revertedWith(
          'PassportCampaign: user does not meet the credit score requirement',
        );
      });

      it('reverts if user stakes more than the limit', async () => {
        await expect(
          stake(user1, STAKE_AMOUNT.mul(3), user1ScoreProof),
        ).to.be.revertedWith(
          'PassportCampaign: cannot stake more than the limit',
        );
      });

      it('reverts if staking more than the balance', async () => {
        await mintAndApprove(stakingToken, user1, STAKE_AMOUNT);

        await expect(
          user1PassportCampaign.stake(STAKE_AMOUNT.add(1), user1ScoreProof),
        ).to.be.revertedWith('TRANSFER_FROM_FAILED');
      });

      it(`reverts if trying to stake with a proof other than the user's`, async () => {
        await expect(
          stake(user1, STAKE_AMOUNT, user2ScoreProof),
        ).to.be.revertedWith(
          'PassportScoreVerifiable: proof does not belong to the caller',
        );
      });

      it('reverts if the proof protocol does not match the one registered', async () => {
        await expect(
          stake(user1, STAKE_AMOUNT, user1OtherProtoScoreProof),
        ).to.be.revertedWith('JointPassportCampaign: invalid proof protocol');
      });

      it('should be able to stake', async () => {
        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        expect(await user1PassportCampaign.balanceOf(user1.address)).to.be.eq(
          STAKE_AMOUNT,
        );
      });

      it('should be able to stake more than the initial limit if the limit has been set to 0', async () => {
        // Set limit to STAKE_AMOUNT
        await arcPassportCampaign.setMaxStakePerUser(STAKE_AMOUNT);

        // User stakes
        await user1PassportCampaign.stake(STAKE_AMOUNT, user1ScoreProof);

        // User tries to stake more but fails
        await expect(
          stake(user1, STAKE_AMOUNT, user1ScoreProof),
        ).to.be.revertedWith(
          'PassportCampaign: cannot stake more than the limit',
        );

        // Admin sets the limit to 0
        await arcPassportCampaign.setMaxStakePerUser(0);

        // User tries to stake more and succeeds
        expect(await user1PassportCampaign.balanceOf(user1.address)).to.eq(
          STAKE_AMOUNT,
        );

        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        expect(await user1PassportCampaign.balanceOf(user1.address)).to.eq(
          STAKE_AMOUNT.mul(2),
        );
      });

      it('should update reward correctly after staking', async () => {
        await notifyRewards();
        await user1PassportCampaign.stake(STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(1);

        let arcEarned = await user1PassportCampaign.arcEarned(user1.address);
        let collabEarned = await user1PassportCampaign.collabEarned(
          user1.address,
        );

        expect(arcEarned).to.eq(utils.parseEther('6'));
        expect(collabEarned).to.eq(utils.parseEther('20'));

        await setTimestampTo(2);

        arcEarned = await user1PassportCampaign.arcEarned(user1.address);
        collabEarned = await user1PassportCampaign.collabEarned(user1.address);

        expect(arcEarned).to.eq(utils.parseEther('12'));
        expect(collabEarned).to.eq(utils.parseEther('40'));
      });
    });

    // describe('#stakeWithPermit');

    describe('#getReward', () => {
      beforeEach(async () => {
        await notifyRewards();
      });

      it('reverts if no rewards are claimable', async () => {
        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(1);

        await expect(
          user1PassportCampaign.getReward(user1.address),
        ).to.be.revertedWith(
          'JointPassportCampaign: at least one reward token must be claimable',
        );
      });

      it('claims both rewards gradually over time', async () => {
        await arcPassportCampaign.setTokensClaimable(true);
        await arcPassportCampaign.setCollabTokensClaimable(true);

        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(1);

        await user1PassportCampaign.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('6'),
        );
        expect(await collabToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('20'),
        );

        await setTimestampTo(2);

        await user1PassportCampaign.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('12'),
        );
        expect(await collabToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('40'),
        );
      });

      it('claims the right amount of rewards given the number of participants', async () => {
        await arcPassportCampaign.setTokensClaimable(true);
        await arcPassportCampaign.setCollabTokensClaimable(true);

        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(1);

        await user1PassportCampaign.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('6'),
        );
        expect(await collabToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('20'),
        );

        await setTimestampTo(2);

        await stake(user2, STAKE_AMOUNT, user2ScoreProof);

        await setTimestampTo(3);

        await user1PassportCampaign.getReward(user1.address);
        await user2PassportCampaign.getReward(user2.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('15'),
        );
        expect(await collabToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('50'),
        );

        expect(await arcToken.balanceOf(user2.address)).to.eq(
          utils.parseEther('3'),
        );
        expect(await collabToken.balanceOf(user2.address)).to.eq(
          utils.parseEther('10'),
        );
      });

      it('claims the correct amount of rewards after calling #notifyRewardAmount a second time', async () => {
        await arcPassportCampaign.setTokensClaimable(true);
        await arcPassportCampaign.setCollabTokensClaimable(true);

        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(5);

        await user1PassportCampaign.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('30'),
        );
        expect(await collabToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('100'),
        );

        await arcToken.mintShare(
          user1PassportCampaign.address,
          ARC_REWARD_AMOUNT,
        );
        await collabToken.mintShare(
          user1PassportCampaign.address,
          COLLAB_REWARD_AMOUNT,
        );
        // call notify reward amount a second time
        await arcPassportCampaign.notifyRewardAmount(
          ARC_REWARD_AMOUNT,
          arcToken.address,
        ); // arc reward per epoch = 15
        await collabPassportCampaign.notifyRewardAmount(
          COLLAB_REWARD_AMOUNT,
          collabToken.address,
        ); // collab reward per epoch = 30

        await setTimestampTo(6);

        await user1PassportCampaign.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('39'),
        ); // 30 + 15*0.6
        expect(await collabToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('130'),
        ); // 100 + 30
      });

      it('claims the collab reward and skip the arc tokens if they are not claimable', async () => {
        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(1);

        // No rewards are claimable, expect revert
        await expect(
          user1PassportCampaign.getReward(user1.address),
        ).to.be.revertedWith(
          'JointPassportCampaign: at least one reward token must be claimable',
        );

        expect(await arcToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('0'),
        );
        expect(await collabToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('0'),
        );

        await setTimestampTo(2);

        await expect(
          user1PassportCampaign.getReward(user1.address),
        ).to.be.revertedWith(
          'JointPassportCampaign: at least one reward token must be claimable',
        );

        expect(await arcToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('0'),
        );
        expect(await collabToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('0'),
        );

        await arcPassportCampaign.setCollabTokensClaimable(true);

        await setTimestampTo(3);

        await user1PassportCampaign.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('0'),
        );
        expect(await collabToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('60'),
        );

        await setTimestampTo(4);

        await user1PassportCampaign.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('0'),
        );
        expect(await collabToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('80'),
        );

        await arcPassportCampaign.setTokensClaimable(true);

        await setTimestampTo(5);

        await user1PassportCampaign.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('30'),
        );
        expect(await collabToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('100'),
        );
      });

      it('claims the rewards even if no proof was passed', async () => {
        await arcPassportCampaign.setTokensClaimable(true);
        await user1PassportCampaign.stake(STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(1);

        await user1PassportCampaign.getReward(user1.address);

        const currentBalance = await arcToken.balanceOf(user1.address);

        expect(currentBalance).to.eq(utils.parseEther('6'));
      });

      it('updates rewards accordingly if the user exits in between', async () => {
        await arcPassportCampaign.setTokensClaimable(true);
        await arcPassportCampaign.setCollabTokensClaimable(true);

        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(1);

        await user1PassportCampaign.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('6'),
        );
        expect(await collabToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('20'),
        );

        await setTimestampTo(2);

        await user1PassportCampaign.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('12'),
        );
        expect(await collabToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('40'),
        );

        await setTimestampTo(3);

        await user1PassportCampaign.exit();

        expect(await arcToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('18'),
        );
        expect(await collabToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('60'),
        );

        await setTimestampTo(4);

        await user1PassportCampaign.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('18'),
        );
        expect(await collabToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('60'),
        );

        await setTimestampTo(5);

        await mintAndApprove(stakingToken, user1, STAKE_AMOUNT);
        await user1PassportCampaign.stake(STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(6);

        await user1PassportCampaign.getReward(user1.address);

        expect(await arcToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('24'),
        );
        expect(await collabToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('80'),
        );
      });
    });

    describe('#withdraw', () => {
      it('reverts if trying to withdraw more than the staked balance', async () => {
        await stake(user1, STAKE_AMOUNT, user1ScoreProof);
        await expect(
          user1PassportCampaign.withdraw(STAKE_AMOUNT.add(1)),
        ).to.be.revertedWith(
          'JointPassportCampaign: cannot withdraw more than the balance',
        );
      });

      it('withdraws the correct amount', async () => {
        await user1PassportCampaign.stake(STAKE_AMOUNT, user1ScoreProof);

        await user1PassportCampaign.withdraw(STAKE_AMOUNT);

        const balance = await stakingToken.balanceOf(user1.address);

        expect(balance).to.eq(STAKE_AMOUNT);
      });

      it('should withdraw the correct amount even if an empty proof was given', async () => {
        await user1PassportCampaign.stake(STAKE_AMOUNT, user1ScoreProof);

        await user1PassportCampaign.withdraw(STAKE_AMOUNT);

        const balance = await stakingToken.balanceOf(user1.address);

        expect(balance).to.eq(STAKE_AMOUNT);
      });
    });

    describe('#exit', () => {
      beforeEach(notifyRewards);

      it('reverts if no rewards are claimable', async () => {
        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(1);

        await expect(user1PassportCampaign.exit()).to.be.revertedWith(
          'JointPassportCampaign: at least one reward token must be claimable',
        );
      });

      it('exits with the right amount of staked tokens and rewards', async () => {
        await arcPassportCampaign.setTokensClaimable(true);
        await arcPassportCampaign.setCollabTokensClaimable(true);

        await user1PassportCampaign.stake(STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(1);

        await user1PassportCampaign.exit();

        const stakingBalance = await stakingToken.balanceOf(user1.address);
        const arcBalance = await arcToken.balanceOf(user1.address);
        const collabBalance = await collabToken.balanceOf(user1.address);

        expect(stakingBalance).to.eq(STAKE_AMOUNT);
        expect(arcBalance).to.eq(utils.parseEther('6'));
        expect(collabBalance).to.eq(utils.parseEther('20'));
      });

      it('withdraws the correct amount even if an empty proof was given', async () => {
        await arcPassportCampaign.setTokensClaimable(true);
        await user1PassportCampaign.stake(STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(1);

        await user1PassportCampaign.exit();

        const stakingBalance = await stakingToken.balanceOf(user1.address);
        const rewardBalance = await arcToken.balanceOf(user1.address);

        expect(stakingBalance).to.eq(STAKE_AMOUNT);
        expect(rewardBalance).to.eq(utils.parseEther('6'));
      });
    });
  });

  describe('Restricted functions', () => {
    describe('#setCollabRewardsDistributor', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          user1PassportCampaign.setCollabRewardsDistributor(user1.address),
        ).to.be.revertedWith(
          'JointPassportCampaign: caller is not the collab rewards distributor',
        );
      });

      it('sets the rewards distributor if called by the current collabRewardsDistributor', async () => {
        await collabPassportCampaign.setCollabRewardsDistributor(admin.address);

        expect(await arcPassportCampaign.collabRewardsDistributor()).to.eq(
          admin.address,
        );
      });
    });

    describe('#setRewardsDistributor', () => {
      it('reverts if called by non-owner', async () => {
        await expect(
          user1PassportCampaign.setRewardsDistributor(user1.address),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('sets the rewards distributor if called by owner', async () => {
        await arcPassportCampaign.setRewardsDistributor(user1.address);

        expect(await arcPassportCampaign.rewardsDistributor()).to.eq(
          user1.address,
        );
      });
    });

    describe('#setRewardsDuration', () => {
      it('reverts if called by non-owner', async () => {
        await expect(
          user1PassportCampaign.setRewardsDuration(
            BigNumber.from(REWARD_DURATION),
          ),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('sets the right duration if called by owner', async () => {
        const duration = BigNumber.from(REWARD_DURATION);

        await arcPassportCampaign.setRewardsDuration(duration);

        expect(await arcPassportCampaign.rewardsDuration()).to.eq(duration);
      });
    });

    describe('#notifyRewardAmount', () => {
      beforeEach(async () => {
        await arcToken.mintShare(
          arcPassportCampaign.address,
          ARC_REWARD_AMOUNT,
        );
        await collabToken.mintShare(
          arcPassportCampaign.address,
          COLLAB_REWARD_AMOUNT,
        );
      });

      it('reverts if called by non-reward distributors', async () => {
        await expect(
          user1PassportCampaign.notifyRewardAmount(
            ARC_REWARD_AMOUNT,
            arcToken.address,
          ),
        ).to.be.revertedWith(
          'JointPassportCampaign: caller is not a reward distributor',
        );
        await expect(
          user1PassportCampaign.notifyRewardAmount(
            COLLAB_REWARD_AMOUNT,
            collabToken.address,
          ),
        ).to.be.revertedWith(
          'JointPassportCampaign: caller is not a reward distributor',
        );
      });

      it('is callable by the arc distributor', async () => {
        await arcPassportCampaign.notifyRewardAmount(
          ARC_REWARD_AMOUNT,
          arcToken.address,
        );

        expect(await arcPassportCampaign.rewardRate()).to.eq(
          utils.parseEther('10'),
        );
      });

      it('is callable by the collab distributor', async () => {
        await collabPassportCampaign.notifyRewardAmount(
          COLLAB_REWARD_AMOUNT,
          collabToken.address,
        );

        expect(await arcPassportCampaign.collabRewardRate()).to.eq(
          utils.parseEther('20'),
        );
      });

      it('reverts if the arcx rewards amount are less than the amount of arcx on the contract', async () => {
        await expect(
          arcPassportCampaign.notifyRewardAmount(
            ARC_REWARD_AMOUNT.add(utils.parseEther('1')),
            arcToken.address,
          ),
        ).to.be.revertedWith(
          'JointPassportCampaign: not enough ARCx balance on the contract',
        );
      });

      it('reverts if collab reward amount is less than the amount of collab on the contract', async () => {
        await expect(
          collabPassportCampaign.notifyRewardAmount(
            COLLAB_REWARD_AMOUNT.add(utils.parseEther('1')),
            collabToken.address,
          ),
        ).to.be.revertedWith(
          'JointPassportCampaign: not enough collab token balance on the contract',
        );
      });

      it('reverts if arcx distributor tries to notify the collab rewards', async () => {
        await expect(
          arcPassportCampaign.notifyRewardAmount(
            COLLAB_REWARD_AMOUNT.add(1),
            collabToken.address,
          ),
        ).to.be.revertedWith(
          'JointPassportCampaign: only the collab distributor can notify collab rewards',
        );
      });

      it('reverts if collab distributor tries to notify the arcx rewards', async () => {
        await expect(
          collabPassportCampaign.notifyRewardAmount(
            ARC_REWARD_AMOUNT.add(1),
            arcToken.address,
          ),
        ).to.be.revertedWith(
          'JointPassportCampaign: only ARCx distributor can notify ARCx rewards',
        );
      });

      it('updates arc rewards correctly after a new reward update', async () => {
        await arcPassportCampaign.notifyRewardAmount(
          ARC_REWARD_AMOUNT,
          arcToken.address,
        );

        expect(await arcPassportCampaign.rewardRate()).to.eq(
          utils.parseEther('10'),
        );

        await setTimestampTo(1);

        await arcToken.mintShare(
          arcPassportCampaign.address,
          ARC_REWARD_AMOUNT,
        );
        await arcPassportCampaign.notifyRewardAmount(
          ARC_REWARD_AMOUNT,
          arcToken.address,
        );

        expect(await arcPassportCampaign.rewardRate()).to.eq(
          utils.parseEther('19'),
        ); // 90 remaining + 100 = 190 / 10 = 19
      });

      it('updates collab rewards correctly after a new reward update', async () => {
        await collabPassportCampaign.notifyRewardAmount(
          COLLAB_REWARD_AMOUNT,
          collabToken.address,
        );

        expect(await arcPassportCampaign.collabRewardRate()).to.eq(
          utils.parseEther('20'),
        );

        await setTimestampTo(1);

        await collabToken.mintShare(
          arcPassportCampaign.address,
          COLLAB_REWARD_AMOUNT,
        );
        await collabPassportCampaign.notifyRewardAmount(
          COLLAB_REWARD_AMOUNT,
          collabToken.address,
        );

        expect(await arcPassportCampaign.collabRewardRate()).to.eq(
          utils.parseEther('38'),
        ); // 180 remaining + 200 = 380 / 10 = 38
      });
    });

    describe('#recoverERC20', () => {
      const erc20Amt = utils.parseEther('21');
      let testToken: TestToken;

      beforeEach(async () => {
        testToken = await new TestTokenFactory(admin).deploy('a', 'b', 18);
        await testToken.mintShare(arcPassportCampaign.address, erc20Amt);
      });

      it('reverts if called by non-owner', async () => {
        await expect(
          user1PassportCampaign.recoverERC20(testToken.address, erc20Amt),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('reverts if trying to recover staking or collab tokens', async () => {
        await stakingToken.mintShare(arcPassportCampaign.address, erc20Amt);
        await collabToken.mintShare(arcPassportCampaign.address, erc20Amt);

        await expect(
          arcPassportCampaign.recoverERC20(stakingToken.address, erc20Amt),
        ).to.be.revertedWith(
          'JointPassportCampaign: cannot withdraw the staking or collab reward tokens',
        );
        await expect(
          arcPassportCampaign.recoverERC20(collabToken.address, erc20Amt),
        ).to.be.revertedWith(
          'JointPassportCampaign: cannot withdraw the staking or collab reward tokens',
        );
      });

      it('reverts if owner tries to recover a greater amount of arc than the surplus reward amount', async () => {
        await notifyRewards();
        await arcToken.mintShare(arcPassportCampaign.address, erc20Amt);

        await expect(
          arcPassportCampaign.recoverERC20(arcToken.address, erc20Amt.add(1)),
        ).to.be.revertedWith(
          'JointPassportCampaign: only the surplus of the reward can be recovered',
        );
      });

      it('lets the owner recover the erc20 on this contract', async () => {
        const balance0 = await testToken.balanceOf(admin.address);

        await arcPassportCampaign.recoverERC20(testToken.address, erc20Amt);

        const balance1 = await testToken.balanceOf(admin.address);

        expect(balance1).to.eq(balance0.add(erc20Amt));
      });

      it('lets the owner recover the surplus of arc on this contract', async () => {
        await arcToken.mintShare(arcPassportCampaign.address, erc20Amt);

        const arcBalance = await arcToken.balanceOf(admin.address);

        await arcPassportCampaign.recoverERC20(arcToken.address, erc20Amt);

        expect(await arcToken.balanceOf(admin.address)).to.eq(
          arcBalance.add(erc20Amt),
        );
      });
    });

    describe('#recoverCollab', () => {
      it('reverts if called by non-owner', async () => {
        await expect(
          user1PassportCampaign.recoverCollab(utils.parseEther('10')),
        ).to.be.revertedWith(
          'JointPassportCampaign: caller is not the collab rewards distributor',
        );
      });

      it('reverts if collab tries to recover a greater amount of collab token than the surplus reward amount', async () => {
        await notifyRewards();

        await collabToken.mintShare(
          collabPassportCampaign.address,
          utils.parseEther('10'),
        );

        await expect(
          collabPassportCampaign.recoverCollab(utils.parseEther('11')),
        ).to.be.revertedWith(
          'JointPassportCampaign: only the surplus of the reward can be recovered',
        );
      });

      it('lets the collab reward distributor recover the surplus of collab token on the contract', async () => {
        await notifyRewards();

        await collabToken.mintShare(
          collabPassportCampaign.address,
          utils.parseEther('10'),
        );

        await expect(
          collabPassportCampaign.recoverCollab(utils.parseEther('11')),
        ).to.be.revertedWith(
          'JointPassportCampaign: only the surplus of the reward can be recovered',
        );
      });
    });

    describe('#setTokensClaimable', () => {
      it('reverts if called by non-owner', async () => {
        await expect(
          user1PassportCampaign.setTokensClaimable(true),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('lets the owner make the arc tokens claimable', async () => {
        await arcPassportCampaign.setTokensClaimable(true);

        expect(await arcPassportCampaign.tokensClaimable()).to.be.eq(true);
      });
    });

    describe('#setCollabTokensClaimable', () => {
      it('reverts if called by non-owner', async () => {
        await expect(
          user1PassportCampaign.setCollabTokensClaimable(true),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('lets the collab make the collab tokens claimable', async () => {
        await arcPassportCampaign.setCollabTokensClaimable(true);

        expect(await arcPassportCampaign.collabTokensClaimable()).to.be.eq(
          true,
        );
      });
    });

    describe('#setProofProtocol', () => {
      it('reverts if called by non-owner', async () => {
        await expect(
          user1PassportCampaign.setProofProtocol('test'),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('sets the proof protocol', async () => {
        expect(await arcPassportCampaign.proofProtocol()).to.eq(
          DEFAULT_PROOF_PROTOCOL,
        );

        await arcPassportCampaign.setProofProtocol('test');

        expect(await arcPassportCampaign.proofProtocol()).to.eq('test');
      });
    });
  });

  describe('Scenarios', () => {
    let users: Record<string, SignerWithAddress>;
    let creditScoreProofs: Record<string, PassportScoreProof>;

    beforeEach(async () => {
      const signers = await ethers.getSigners();

      users = {
        userA: signers[1],
        userB: signers[2],
        userC: signers[3],
        userD: signers[4],
        userE: signers[5],
      };

      // Set up credit scores for the users of this scenario
      const creditScores: Record<string, PassportScore> = {};
      Object.keys(users).forEach((userKey) => {
        creditScores[userKey] = {
          account: users[userKey].address,
          protocol: DEFAULT_PROOF_PROTOCOL,
          score: CREDIT_SCORE_THRESHOLD,
        };
      });

      const newCreditScoreTree = new PassportScoreTree(
        Object.values(creditScores),
      );

      creditScoreProofs = {};
      Object.keys(users).forEach((userKey) => {
        creditScoreProofs[userKey] = getScoreProof(
          creditScores[userKey],
          newCreditScoreTree,
        );
      });

      await arcToken.mintShare(arcPassportCampaign.address, ARC_REWARD_AMOUNT);

      await immediatelyUpdateMerkleRoot(
        creditScoreContract.connect(ctx.signers.interestSetter),
        newCreditScoreTree.getHexRoot(),
      );
    });

    it('distributes both rewards to 3 users correctly', async () => {
      await arcPassportCampaign.setRewardsDuration(20);

      const arcRewardAmount = utils.parseEther('150');
      const lidoRewardAmount = utils.parseEther('300');

      const jointCampaignUserA = arcPassportCampaign.connect(users.userA);
      const jointCampaignUserB = arcPassportCampaign.connect(users.userB);
      const jointCampaignUserC = arcPassportCampaign.connect(users.userC);

      await stake(users.userA, STAKE_AMOUNT, creditScoreProofs.userA);

      await setTimestampTo(1);

      await stake(users.userB, STAKE_AMOUNT, creditScoreProofs.userB);

      await setTimestampTo(3);

      await arcToken.mintShare(arcPassportCampaign.address, arcRewardAmount);
      await arcPassportCampaign.notifyRewardAmount(
        arcRewardAmount,
        arcToken.address,
      );

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(user2, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(user2, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(user2, collabToken)).to.eq(utils.parseEther('0'));

      await setTimestampTo(4);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('3.75'),
      );
      expect(await earned(users.userA, collabToken)).to.eq(
        utils.parseEther('0'),
      );
      expect(await earned(user2, arcToken)).to.eq(utils.parseEther('3.75'));
      expect(await earned(user2, collabToken)).to.eq(utils.parseEther('0'));

      await setTimestampTo(5);

      await collabToken.mintShare(
        arcPassportCampaign.address,
        lidoRewardAmount,
      );
      await collabPassportCampaign.notifyRewardAmount(
        lidoRewardAmount,
        collabToken.address,
      );

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('7.5'),
      );
      expect(await earned(users.userA, collabToken)).to.eq(
        utils.parseEther('0'),
      );
      expect(await earned(user2, arcToken)).to.eq(utils.parseEther('7.5'));
      expect(await earned(user2, collabToken)).to.eq(utils.parseEther('0'));

      await setTimestampTo(6);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('11.25'),
      );
      expect(await earned(users.userA, collabToken)).to.eq(
        utils.parseEther('7.5'),
      );
      expect(await earned(user2, arcToken)).to.eq(utils.parseEther('11.25'));
      expect(await earned(user2, collabToken)).to.eq(utils.parseEther('7.5'));

      await setTimestampTo(7);

      // no rewards are claimable -> revert
      await expect(
        jointCampaignUserA.getReward(users.userA.address),
      ).to.be.revertedWith(
        'JointPassportCampaign: at least one reward token must be claimable',
      );

      await setTimestampTo(9);

      await arcPassportCampaign.setCollabTokensClaimable(true);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('22.5'),
      );
      expect(await earned(users.userA, collabToken)).to.eq(
        utils.parseEther('30'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(
        utils.parseEther('22.5'),
      );
      expect(await earned(users.userB, collabToken)).to.eq(
        utils.parseEther('30'),
      );

      await setTimestampTo(10);

      await stake(users.userC, STAKE_AMOUNT, creditScoreProofs.userC);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('26.25'),
      );
      expect(await earned(users.userA, collabToken)).to.eq(
        utils.parseEther('37.5'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(
        utils.parseEther('26.25'),
      );
      expect(await earned(users.userB, collabToken)).to.eq(
        utils.parseEther('37.5'),
      );
      expect(await earned(users.userC, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userC, collabToken)).to.eq(
        utils.parseEther('0'),
      );

      await setTimestampTo(11);

      await jointCampaignUserB.getReward(users.userB.address);

      expect(await arcToken.balanceOf(users.userB.address)).to.eq(
        BigNumber.from(0),
      ); // ARC tokens not yet claimable
      expect(await collabToken.balanceOf(users.userB.address)).to.eq(
        utils.parseEther('42.5'),
      );

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('28.75'),
      );
      expect(await earned(users.userA, collabToken)).to.eq(
        utils.parseEther('42.5'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(
        utils.parseEther('28.75'),
      );
      expect(await earned(users.userB, collabToken)).to.eq(
        utils.parseEther('42.5'),
      );
      expect(await earned(users.userC, arcToken)).to.eq(
        utils.parseEther('2.5'),
      );
      expect(await earned(users.userC, collabToken)).to.eq(
        utils.parseEther('5'),
      );

      await setTimestampTo(12);

      await arcToken.mintShare(arcPassportCampaign.address, arcRewardAmount);
      await arcPassportCampaign.notifyRewardAmount(
        arcRewardAmount,
        arcToken.address,
      );

      await setTimestampTo(13);

      await arcPassportCampaign.setCollabTokensClaimable(false);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('35.125'),
      );
      expect(await earned(users.userA, collabToken)).to.eq(
        utils.parseEther('52.5'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(
        utils.parseEther('35.125'),
      );
      expect(await earned(users.userB, collabToken)).to.eq(
        utils.parseEther('52.5'),
      );
      expect(await earned(users.userC, arcToken)).to.eq(
        utils.parseEther('8.875'),
      );
      expect(await earned(users.userC, collabToken)).to.eq(
        utils.parseEther('15'),
      );

      await setTimestampTo(15);

      // reverts because no rewards are claimable
      await expect(
        jointCampaignUserA.getReward(users.userA.address),
      ).to.be.revertedWith(
        'JointPassportCampaign: at least one reward token must be claimable',
      );

      await setTimestampTo(19);

      await arcPassportCampaign.setTokensClaimable(true);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('58.375'),
      );
      expect(await earned(users.userA, collabToken)).to.eq(
        utils.parseEther('82.5'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(
        utils.parseEther('58.375'),
      );
      expect(await earned(users.userB, collabToken)).to.eq(
        utils.parseEther('82.5'),
      );
      expect(await earned(users.userC, arcToken)).to.eq(
        utils.parseEther('32.125'),
      );
      expect(await earned(users.userC, collabToken)).to.eq(
        utils.parseEther('45'),
      );

      await setTimestampTo(21);

      await arcPassportCampaign.setCollabTokensClaimable(true);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('66.125'),
      );
      expect(await earned(users.userA, collabToken)).to.eq(
        utils.parseEther('92.5'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(
        utils.parseEther('66.125'),
      );
      expect(await earned(users.userB, collabToken)).to.eq(
        utils.parseEther('92.5'),
      );
      expect(await earned(users.userC, arcToken)).to.eq(
        utils.parseEther('39.875'),
      );
      expect(await earned(users.userC, collabToken)).to.eq(
        utils.parseEther('55'),
      );

      await setTimestampTo(22);

      await jointCampaignUserB.exit();

      expect(await stakingToken.balanceOf(users.userB.address)).to.eq(
        STAKE_AMOUNT,
      );
      expect(await arcToken.balanceOf(users.userB.address)).to.eq(
        utils.parseEther('42'),
      ); // 70 * 0.6
      expect(await collabToken.balanceOf(users.userB.address)).to.eq(
        utils.parseEther('97.5'),
      );

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('70'));
      expect(await earned(users.userA, collabToken)).to.eq(
        utils.parseEther('97.5'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('70'));
      expect(await earned(users.userB, collabToken)).to.eq(
        utils.parseEther('97.5'),
      );
      expect(await earned(users.userC, arcToken)).to.eq(
        utils.parseEther('43.75'),
      );
      expect(await earned(users.userC, collabToken)).to.eq(
        utils.parseEther('60'),
      );

      await setTimestampTo(24);

      await jointCampaignUserC.exit();

      expect(await stakingToken.balanceOf(users.userC.address)).to.eq(
        STAKE_AMOUNT,
      );
      expect(await arcToken.balanceOf(users.userC.address)).to.eq(
        utils.parseEther('33.225'),
      ); // 55.375 * 0.6
      expect(await collabToken.balanceOf(users.userC.address)).to.eq(
        utils.parseEther('75'),
      );

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('81.625'),
      );
      expect(await earned(users.userA, collabToken)).to.eq(
        utils.parseEther('112.5'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('70'));
      expect(await earned(users.userB, collabToken)).to.eq(
        utils.parseEther('97.5'),
      );
      expect(await earned(users.userC, arcToken)).to.eq(
        utils.parseEther('55.375'),
      );
      expect(await earned(users.userC, collabToken)).to.eq(
        utils.parseEther('75'),
      );

      await setTimestampTo(25);

      const userCStakingToken = TestTokenFactory.connect(
        stakingToken.address,
        users.userC,
      );
      await userCStakingToken.approve(jointCampaignUserC.address, STAKE_AMOUNT);
      await jointCampaignUserC.stake(STAKE_AMOUNT, creditScoreProofs.userC);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('93.25'),
      );
      expect(await earned(users.userA, collabToken)).to.eq(
        utils.parseEther('127.5'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('70'));
      expect(await earned(users.userB, collabToken)).to.eq(
        utils.parseEther('97.5'),
      );
      expect(await earned(users.userC, arcToken)).to.eq(
        utils.parseEther('55.375'),
      );
      expect(await earned(users.userC, collabToken)).to.eq(
        utils.parseEther('75'),
      );

      await setTimestampTo(32);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('133.9375'),
      );
      expect(await earned(users.userA, collabToken)).to.eq(
        utils.parseEther('127.5'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('70'));
      expect(await earned(users.userB, collabToken)).to.eq(
        utils.parseEther('97.5'),
      );
      expect(await earned(users.userC, arcToken)).to.eq(
        utils.parseEther('96.0625'),
      );
      expect(await earned(users.userC, collabToken)).to.eq(
        utils.parseEther('75'),
      );

      await setTimestampTo(40);

      await jointCampaignUserC.exit();
      await jointCampaignUserA.exit();

      expect(await stakingToken.balanceOf(users.userA.address)).to.eq(
        STAKE_AMOUNT,
      );
      expect(await arcToken.balanceOf(users.userA.address)).to.eq(
        utils.parseEther('80.3625'),
      ); // 133.9375 * 0.6
      expect(await collabToken.balanceOf(users.userA.address)).to.eq(
        utils.parseEther('127.5'),
      );

      expect(await stakingToken.balanceOf(users.userB.address)).to.eq(
        STAKE_AMOUNT,
      );
      expect(await arcToken.balanceOf(users.userB.address)).to.eq(
        utils.parseEther('42'),
      ); // 70 * 0.6
      expect(await collabToken.balanceOf(users.userB.address)).to.eq(
        utils.parseEther('97.5'),
      );

      expect(await stakingToken.balanceOf(users.userC.address)).to.eq(
        STAKE_AMOUNT,
      );
      expect(await arcToken.balanceOf(users.userC.address)).to.eq(
        utils.parseEther('57.6375'),
      ); // 96.0625 * 0.6
      expect(await collabToken.balanceOf(users.userC.address)).to.eq(
        utils.parseEther('75'),
      );
    });

    it('should not get any rewards if user stakes before the reward is notified', async () => {
      await arcPassportCampaign.setRewardsDuration(REWARD_DURATION);
      await setTimestampTo(0);

      await stake(users.userA, STAKE_AMOUNT, creditScoreProofs.userA);

      await setTimestampTo(4);

      expect(await earned(users.userA, arcToken)).to.eq(BigNumber.from(0));

      await arcPassportCampaign.notifyRewardAmount(
        ARC_REWARD_AMOUNT,
        arcToken.address,
      );

      await setTimestampTo(6);

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('20'));
    });

    it('should distribute rewards to users correctly', async () => {
      await arcPassportCampaign.setRewardsDuration(20);
      await setTimestampTo(0);

      await stake(users.userA, STAKE_AMOUNT, creditScoreProofs.userA);
      await stake(users.userB, STAKE_AMOUNT, creditScoreProofs.userB);

      await arcToken.mintShare(
        arcPassportCampaign.address,
        utils.parseEther('200'),
      );

      await arcPassportCampaign.notifyRewardAmount(
        utils.parseEther('300'),
        arcToken.address,
      ); // 0

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userC, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userD, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userE, arcToken)).to.eq(utils.parseEther('0'));

      await setTimestampTo(1);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('7.5'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(
        utils.parseEther('7.5'),
      );
      expect(await earned(users.userC, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userD, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userE, arcToken)).to.eq(utils.parseEther('0'));

      await setTimestampTo(2);

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('15'));
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('15'));
      expect(await earned(users.userC, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userD, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userE, arcToken)).to.eq(utils.parseEther('0'));

      await setTimestampTo(4);

      await stake(users.userC, STAKE_AMOUNT, creditScoreProofs.userC);

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('30'));
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('30'));
      expect(await earned(users.userC, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userD, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userE, arcToken)).to.eq(utils.parseEther('0'));

      await setTimestampTo(5);

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('35'));
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('35'));
      expect(await earned(users.userC, arcToken)).to.eq(utils.parseEther('5'));
      expect(await earned(users.userD, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userE, arcToken)).to.eq(utils.parseEther('0'));

      await setTimestampTo(8);

      await stake(users.userD, STAKE_AMOUNT, creditScoreProofs.userD);

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('50'));
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('50'));
      expect(await earned(users.userC, arcToken)).to.eq(utils.parseEther('20'));
      expect(await earned(users.userD, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userE, arcToken)).to.eq(utils.parseEther('0'));

      await setTimestampTo(9);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('53.75'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(
        utils.parseEther('53.75'),
      );
      expect(await earned(users.userC, arcToken)).to.eq(
        utils.parseEther('23.75'),
      );
      expect(await earned(users.userD, arcToken)).to.eq(
        utils.parseEther('3.75'),
      );
      expect(await earned(users.userE, arcToken)).to.eq(utils.parseEther('0'));

      await setTimestampTo(10);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('57.5'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(
        utils.parseEther('57.5'),
      );
      expect(await earned(users.userC, arcToken)).to.eq(
        utils.parseEther('27.5'),
      );
      expect(await earned(users.userD, arcToken)).to.eq(
        utils.parseEther('7.5'),
      );
      expect(await earned(users.userE, arcToken)).to.eq(utils.parseEther('0'));

      await setTimestampTo(13);

      await stake(users.userE, STAKE_AMOUNT, creditScoreProofs.userE);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('68.75'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(
        utils.parseEther('68.75'),
      );
      expect(await earned(users.userC, arcToken)).to.eq(
        utils.parseEther('38.75'),
      );
      expect(await earned(users.userD, arcToken)).to.eq(
        utils.parseEther('18.75'),
      );
      expect(await earned(users.userE, arcToken)).to.eq(utils.parseEther('0'));

      await arcPassportCampaign.setTokensClaimable(true);

      await setTimestampTo(16);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('77.75'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(
        utils.parseEther('77.75'),
      );
      expect(await earned(users.userC, arcToken)).to.eq(
        utils.parseEther('47.75'),
      );
      expect(await earned(users.userD, arcToken)).to.eq(
        utils.parseEther('27.75'),
      );
      expect(await earned(users.userE, arcToken)).to.eq(utils.parseEther('9'));

      await setTimestampTo(17);

      await withdraw(users.userC);

      await setTimestampTo(19);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('88.25'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(
        utils.parseEther('88.25'),
      );
      expect(await earned(users.userC, arcToken)).to.eq(
        utils.parseEther('50.75'),
      );
      expect(await earned(users.userD, arcToken)).to.eq(
        utils.parseEther('38.25'),
      );
      expect(await earned(users.userE, arcToken)).to.eq(
        utils.parseEther('19.5'),
      );

      await setTimestampTo(20);

      await exitCampaign(users.userA);
      await exitCampaign(users.userB);
      await claimReward(users.userC);
      await exitCampaign(users.userD);
      await exitCampaign(users.userE);

      expect(await rewardBalanceOf(users.userA, arcToken)).to.be.eq(
        utils.parseEther('55.2'),
      );
      expect(await rewardBalanceOf(users.userB, arcToken)).to.be.eq(
        utils.parseEther('55.2'),
      );
      expect(await rewardBalanceOf(users.userC, arcToken)).to.be.eq(
        utils.parseEther('30.45'),
      );
      expect(await rewardBalanceOf(users.userD, arcToken)).to.be.eq(
        utils.parseEther('25.2'),
      );
      expect(await rewardBalanceOf(users.userE, arcToken)).to.be.eq(
        utils.parseEther('13.95'),
      );
    });

    it('should distribute rewards correctly for 2 users', async () => {
      await arcPassportCampaign.setRewardsDuration(20);
      await arcPassportCampaign.setCurrentTimestamp(0);

      await stake(users.userA, STAKE_AMOUNT, creditScoreProofs.userA);

      await arcToken.mintShare(
        arcPassportCampaign.address,
        utils.parseEther('200'),
      );

      await arcPassportCampaign.notifyRewardAmount(
        utils.parseEther('300'),
        arcToken.address,
      ); // 0

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('0'));

      await setTimestampTo(1);

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('15'));
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('0'));

      await setTimestampTo(10);

      await stake(users.userB, STAKE_AMOUNT, creditScoreProofs.userB);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('150'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('0'));

      await setTimestampTo(11);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('157.5'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(
        utils.parseEther('7.5'),
      );

      await setTimestampTo(20);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('225'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('75'));
    });

    it('should distribute rewards to 3 users correctly', async () => {
      await arcPassportCampaign.setRewardsDuration(20);
      await arcPassportCampaign.setCurrentTimestamp(0);

      await stake(users.userA, STAKE_AMOUNT, creditScoreProofs.userA);

      await arcPassportCampaign.notifyRewardAmount(
        utils.parseEther('100'),
        arcToken.address,
      ); // 0

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userC, arcToken)).to.eq(utils.parseEther('0'));

      await arcPassportCampaign.setCurrentTimestamp(1);

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('5'));
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userC, arcToken)).to.eq(utils.parseEther('0'));

      await arcPassportCampaign.setCurrentTimestamp(3);

      await stake(users.userB, STAKE_AMOUNT, creditScoreProofs.userB);

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('15'));
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userC, arcToken)).to.eq(utils.parseEther('0'));

      await arcPassportCampaign.setCurrentTimestamp(8);

      await stake(users.userC, STAKE_AMOUNT.mul(2), creditScoreProofs.userC);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('27.5'),
      );
      expect(await earned(users.userB, arcToken)).to.eq(
        utils.parseEther('12.5'),
      );
      expect(await earned(users.userC, arcToken)).to.eq(utils.parseEther('0'));

      await arcPassportCampaign.setCurrentTimestamp(10);

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('30'));
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('15'));
      expect(await earned(users.userC, arcToken)).to.eq(utils.parseEther('5'));

      await arcPassportCampaign.setCurrentTimestamp(13);

      await arcPassportCampaign.setTokensClaimable(true);

      await exitCampaign(users.userB);
      await withdraw(users.userC, STAKE_AMOUNT);

      await arcPassportCampaign.setCurrentTimestamp(20);

      expect(await earned(users.userA, arcToken)).to.eq(
        utils.parseEther('51.25'),
      );

      expect(await earned(users.userB, arcToken)).to.eq(
        utils.parseEther('18.75'),
      );
      expect(
        (await arcPassportCampaign.stakers(users.userB.address))
          .arcRewardsReleased,
      ).to.eq(utils.parseEther('18.75'));

      expect(await earned(users.userC, arcToken)).to.eq(utils.parseEther('30'));
    });

    it('should distribute rewards correctly if new rewards are notified before the end of the period', async () => {
      await arcPassportCampaign.setRewardsDuration(10);
      await setTimestampTo(0);

      await arcToken.mintShare(
        arcPassportCampaign.address,
        utils.parseEther('100'),
      );
      await arcPassportCampaign.notifyRewardAmount(
        utils.parseEther('100'),
        arcToken.address,
      );

      await setTimestampTo(1);

      await stake(users.userA, STAKE_AMOUNT, creditScoreProofs.userA);

      await setTimestampTo(2);

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('10'));

      await setTimestampTo(3);

      await stake(users.userB, STAKE_AMOUNT, creditScoreProofs.userB);

      await setTimestampTo(4);

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('25'));
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('5'));

      await arcToken.mintShare(
        arcPassportCampaign.address,
        utils.parseEther('100'),
      );
      await arcPassportCampaign.notifyRewardAmount(
        utils.parseEther('100'),
        arcToken.address,
      );

      // New rewards: 60 + 100 = 160 distributed over 10 epochs

      await setTimestampTo(5);

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('33'));
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('13'));

      await withdraw(users.userA, STAKE_AMOUNT);

      await setTimestampTo(6);

      expect(await earned(users.userA, arcToken)).to.eq(utils.parseEther('33'));
      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('29'));

      await arcPassportCampaign.setTokensClaimable(true);

      await claimReward(users.userA);

      expect(await arcToken.balanceOf(users.userA.address)).to.eq(
        utils.parseEther('19.8'),
      );

      await setTimestampTo(7);

      expect(await earned(users.userB, arcToken)).to.eq(utils.parseEther('45'));

      await claimReward(users.userB);

      expect(await arcToken.balanceOf(users.userB.address)).to.eq(
        utils.parseEther('27'),
      );
    });

    it('should allow user to stake, then credit score threshold is raised and user should not be able to stake more', async () => {
      const { userA } = users;
      const scoreProof = creditScoreProofs.userA;

      // User stakes
      let userBalance = await arcPassportCampaign.balanceOf(userA.address);

      expect(userBalance).to.eq(0);
      await stake(userA, STAKE_AMOUNT, scoreProof);

      userBalance = await arcPassportCampaign.balanceOf(userA.address);
      expect(userBalance).to.eq(STAKE_AMOUNT);

      // Credit score threshold is raised
      await arcPassportCampaign.setCreditScoreThreshold(
        CREDIT_SCORE_THRESHOLD.add(CREDIT_SCORE_THRESHOLD.div(2)),
      );

      // User tries to stake more but tx reverts
      await expect(stake(userA, STAKE_AMOUNT, scoreProof)).to.be.revertedWith(
        'PassportCampaign: user does not meet the credit score requirement',
      );

      // Credit score threshold is lowerd back
      await arcPassportCampaign.setCreditScoreThreshold(CREDIT_SCORE_THRESHOLD);

      // User can stake more
      await stake(userA, STAKE_AMOUNT, scoreProof);

      userBalance = await arcPassportCampaign.balanceOf(userA.address);
      expect(userBalance).to.eq(STAKE_AMOUNT.mul(2));
    });
  });
});
