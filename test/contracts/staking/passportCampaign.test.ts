import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
  MockSapphireCreditScore,
  SapphireAssessor,
  SapphireCreditScore,
  // PassportCampaignFactory,
  TestToken,
  TestTokenFactory,
} from '@src/typings';
import hre from 'hardhat';
import { ethers } from 'hardhat';
import { deployTestToken } from '../deployers';
import { BigNumber, utils } from 'ethers';
import chai from 'chai';
import { BASE } from '@src/constants';
import { EVM } from '@test/helpers/EVM';
import { solidity } from 'ethereum-waffle';
import { MockPassportCampaign } from '@src/typings/MockPassportCampaign';
import { MockPassportCampaignFactory } from '@src/typings/MockPassportCampaignFactory';
import {
  addSnapshotBeforeRestoreAfterEach,
  immediatelyUpdateMerkleRoot,
} from '@test/helpers/testingUtils';
import { getEmptyScoreProof, getScoreProof } from '@src/utils/getScoreProof';
import { CreditScore, CreditScoreProof } from '@arc-types/sapphireCore';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';
import _ from 'lodash';

chai.use(solidity);
const expect = chai.expect;

const REWARD_AMOUNT = utils.parseEther('100');
const STAKE_AMOUNT = utils.parseEther('10');
const REWARD_DURATION = 10;

const DAO_ALLOCATION = utils.parseEther('0.4');

const CREDIT_SCORE_THRESHOLD = BigNumber.from(500);

describe('PassportCampaign', () => {
  let adminPassportCampaign: MockPassportCampaign;
  let stakerPassportCampaign: MockPassportCampaign;
  let user1PassportCampaign: MockPassportCampaign;
  let unauthorizedPassportCampaign: MockPassportCampaign;

  let assessor: SapphireAssessor;
  let creditScoreContract: MockSapphireCreditScore;

  let stakerCreditScore: CreditScore;
  let user1CreditScore: CreditScore;
  let unauthorizedCreditScore: CreditScore;

  let stakerScoreProof: CreditScoreProof;
  let user1ScoreProof: CreditScoreProof;
  let unauthorizedScoreProof: CreditScoreProof;

  let creditScoreTree: CreditScoreTree;

  let stakingToken: TestToken;
  let rewardToken: TestToken;
  let otherErc20: TestToken;

  let admin: SignerWithAddress;
  let staker: SignerWithAddress;
  let user1: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  let evm: EVM;

  async function increaseTime(duration: number) {
    await evm.increaseTime(duration);
    await evm.mineBlock();
  }

  async function setTimestampTo(timestamp: number) {
    await adminPassportCampaign.setCurrentTimestamp(timestamp);
  }

  async function stake(
    user: SignerWithAddress,
    amount: BigNumber,
    scoreProof: CreditScoreProof,
  ) {
    await mintAndApprove(stakingToken, user, amount);

    const timestampAtStake = await getCurrentTimestamp();
    await adminPassportCampaign.connect(user).stake(amount, scoreProof);

    return timestampAtStake;
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
    await tokenContract.approve(adminPassportCampaign.address, amount);
  }

  async function withdraw(user: SignerWithAddress, amount?: BigNumber) {
    const contract = MockPassportCampaignFactory.connect(
      adminPassportCampaign.address,
      user,
    );

    await contract.withdraw(amount ?? STAKE_AMOUNT);
  }

  async function exitCampaign(user: SignerWithAddress) {
    const contract = MockPassportCampaignFactory.connect(
      adminPassportCampaign.address,
      user,
    );

    await contract.exit();
  }

  async function claimReward(user: SignerWithAddress) {
    const contract = MockPassportCampaignFactory.connect(
      adminPassportCampaign.address,
      user,
    );

    await contract.getReward(user.address);
  }

  async function rewardBalanceOf(user: SignerWithAddress) {
    return await rewardToken.balanceOf(user.address);
  }

  async function earned(user: SignerWithAddress) {
    return await adminPassportCampaign.actualEarned(user.address);
  }

  async function getCurrentTimestamp() {
    return adminPassportCampaign.currentTimestamp();
  }

  async function setup() {
    if (!adminPassportCampaign || !admin) {
      throw 'Liquidity campaign or admin cannot be null';
    }

    await adminPassportCampaign.setRewardsDistributor(admin.address);

    await adminPassportCampaign.setRewardsDuration(REWARD_DURATION);

    await adminPassportCampaign.init(
      admin.address,
      admin.address,
      rewardToken.address,
      stakingToken.address,
      assessor.address,
      DAO_ALLOCATION,
      CREDIT_SCORE_THRESHOLD,
    );

    await setTimestampTo(0);
    await adminPassportCampaign.notifyRewardAmount(REWARD_AMOUNT);
  }

  async function init(ctx: ITestContext) {
    const signers = await ctx.signers;
    evm = new EVM(hre.ethers.provider);
    admin = signers.admin;
    staker = signers.staker;
    user1 = signers.scoredMinter;
    unauthorized = signers.unauthorised;

    stakerCreditScore = {
      account: staker.address,
      amount: CREDIT_SCORE_THRESHOLD,
    };

    user1CreditScore = {
      account: signers.scoredMinter.address,
      amount: CREDIT_SCORE_THRESHOLD.add(100),
    };

    unauthorizedCreditScore = {
      account: unauthorized.address,
      amount: CREDIT_SCORE_THRESHOLD.sub(10),
    };

    creditScoreTree = new CreditScoreTree([
      stakerCreditScore,
      unauthorizedCreditScore,
      user1CreditScore,
    ]);

    stakerScoreProof = getScoreProof(stakerCreditScore, creditScoreTree);
    user1ScoreProof = getScoreProof(user1CreditScore, creditScoreTree);
    unauthorizedScoreProof = getScoreProof(
      unauthorizedCreditScore,
      creditScoreTree,
    );
  }

  before(async () => {
    // Setup sapphire context
    const ctx = await generateContext(sapphireFixture, init);

    await setupSapphire(ctx, {
      merkleRoot: creditScoreTree.getHexRoot(),
    });

    assessor = ctx.contracts.sapphire.assessor;
    creditScoreContract = ctx.contracts.sapphire.creditScore;

    stakingToken = await deployTestToken(admin, '3Pool', 'CRV');
    rewardToken = await deployTestToken(admin, 'Arc Token', 'ARC');
    otherErc20 = await deployTestToken(admin, 'Another ERC20 token', 'AERC20');

    adminPassportCampaign = await new MockPassportCampaignFactory(
      admin,
    ).deploy();

    const proxy = await new ArcProxyFactory(admin).deploy(
      adminPassportCampaign.address,
      await admin.getAddress(),
      [],
    );

    adminPassportCampaign = await new MockPassportCampaignFactory(admin).attach(
      proxy.address,
    );
    stakerPassportCampaign = adminPassportCampaign.connect(staker);
    user1PassportCampaign = adminPassportCampaign.connect(user1);
    unauthorizedPassportCampaign = adminPassportCampaign.connect(unauthorized);

    await rewardToken.mintShare(adminPassportCampaign.address, REWARD_AMOUNT);
    await mintAndApprove(stakingToken, staker, STAKE_AMOUNT);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('View functions', () => {
    describe('#lastTimeRewardApplicable', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should return the block timestamp if called before the reward period finished', async () => {
        const currentTime = await getCurrentTimestamp();

        expect(await adminPassportCampaign.lastTimeRewardApplicable()).to.eq(
          currentTime,
        );
      });

      it('should return the period finish if called after reward period has finished', async () => {
        await setTimestampTo(REWARD_DURATION);

        const periodFinish = await adminPassportCampaign.periodFinish();
        expect(await adminPassportCampaign.lastTimeRewardApplicable()).to.eq(
          periodFinish,
        );
      });
    });

    describe('#balanceOf', () => {
      it('should return the correct balance', async () => {
        await setup();

        await stakerPassportCampaign.stake(STAKE_AMOUNT, stakerScoreProof);

        expect(await stakerPassportCampaign.balanceOf(staker.address)).to.eq(
          STAKE_AMOUNT,
        );
      });
    });

    describe('#rewardPerToken', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should return the reward per token stored if the supply is 0', async () => {
        const rewardPerTokenStored = await adminPassportCampaign.rewardPerTokenStored();

        expect(await adminPassportCampaign.rewardPerToken()).to.eq(
          rewardPerTokenStored,
        );
      });

      it('should return a valid reward per token after someone staked', async () => {
        await stakerPassportCampaign.stake(
          STAKE_AMOUNT.div(2),
          stakerScoreProof,
        );
        await stakerPassportCampaign.stake(
          STAKE_AMOUNT.div(2),
          stakerScoreProof,
        );

        await setTimestampTo(1);

        const rewardPerToken = await stakerPassportCampaign.rewardPerToken();
        const rewardPerTokenStored = await adminPassportCampaign.rewardPerTokenStored();

        expect(rewardPerToken).to.be.gt(BigNumber.from(0));
        expect(rewardPerToken).to.not.eq(rewardPerTokenStored);
      });
    });

    describe('#userAllocation', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should return the correct user allocation', async () => {
        const userAllocation = await stakerPassportCampaign.userAllocation();

        expect(userAllocation).to.eq(BASE.sub(DAO_ALLOCATION));
      });
    });

    describe('#earned', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should return the correct amount earned over time', async () => {
        await stakerPassportCampaign.stake(STAKE_AMOUNT, stakerScoreProof);
        // Check amount earned (should be 0)
        const amountEarned0 = await stakerPassportCampaign.earned(
          staker.address,
        );
        expect(amountEarned0).to.eq(BigNumber.from(0));

        // Advance time
        await setTimestampTo(1);

        expect(await earned(staker)).to.eq(utils.parseEther('10'));

        await setTimestampTo(2);

        expect(await earned(staker)).to.eq(utils.parseEther('20'));
      });

      it('should return the correct amount earned over time while another user stakes in between', async () => {
        await setTimestampTo(1);

        // User A stakes
        await stakerPassportCampaign.stake(STAKE_AMOUNT, stakerScoreProof);

        await setTimestampTo(2);

        // User B stakes
        await stake(unauthorized, STAKE_AMOUNT, unauthorizedScoreProof);

        await setTimestampTo(3);

        // Check amount earned
        expect(await earned(staker)).to.eq(utils.parseEther('15'));
        expect(await earned(unauthorized)).to.eq(utils.parseEther('5'));
      });
    });

    describe('#getRewardForDuration', () => {
      beforeEach(async () => {
        await setup();
      });

      it('returns the correct reward for duration', async () => {
        const rewardForDuration = await adminPassportCampaign.getRewardForDuration();

        expect(
          Math.round(parseFloat(ethers.utils.formatEther(rewardForDuration))),
        ).to.eq(parseFloat(ethers.utils.formatEther(REWARD_AMOUNT)));
      });
    });
  });

  describe('Mutative functions', () => {
    describe('#stake', () => {
      beforeEach(async () => {
        await setup();
      });

      it('reverts if called without a valid credit score proof', async () => {
        await expect(
          stakerPassportCampaign.stake(
            STAKE_AMOUNT,
            await getEmptyScoreProof(staker),
          ),
        ).to.be.revertedWith(
          'SapphireAssessor: proof should be provided for credit score',
        );
      });

      it('reverts if called by a user with a credit score that is lower than required', async () => {
        await expect(
          stake(unauthorized, STAKE_AMOUNT, unauthorizedScoreProof),
        ).to.be.revertedWith(
          'PassportCampaign: user does not meet the credit score requirement',
        );
      });

      it('should not be able to stake more than balance', async () => {
        await mintAndApprove(stakingToken, staker, utils.parseEther('10'));

        const balance = await stakingToken.balanceOf(staker.address);

        await expect(
          stakerPassportCampaign.stake(balance.add(1), stakerScoreProof),
        ).to.be.revertedWith('SafeERC20: TRANSFER_FROM_FAILED');
      });

      it('should be able to stake', async () => {
        await stakerPassportCampaign.stake(
          STAKE_AMOUNT.div(2),
          stakerScoreProof,
        );

        let supply = await stakerPassportCampaign.totalSupply();

        expect(supply).to.eq(STAKE_AMOUNT.div(2));

        await stakerPassportCampaign.stake(
          STAKE_AMOUNT.div(2),
          stakerScoreProof,
        );

        supply = await stakerPassportCampaign.totalSupply();
        const farmStakeBalance = await stakingToken.balanceOf(
          adminPassportCampaign.address,
        );

        expect(supply).to.eq(STAKE_AMOUNT);
        expect(farmStakeBalance).to.eq(STAKE_AMOUNT);
      });

      it('should update reward correctly after staking', async () => {
        await stakerPassportCampaign.stake(STAKE_AMOUNT, stakerScoreProof);

        await setTimestampTo(1);

        let earned = await stakerPassportCampaign.earned(staker.address);

        expect(earned).to.eq(utils.parseEther('6'));

        await setTimestampTo(2);

        earned = await stakerPassportCampaign.earned(staker.address);

        expect(earned).to.eq(utils.parseEther('12'));
      });
    });

    describe('#getReward', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should not be able to get the reward if the tokens are not claimable', async () => {
        await stakerPassportCampaign.stake(STAKE_AMOUNT, stakerScoreProof);

        await increaseTime(REWARD_DURATION / 2);

        await expect(
          stakerPassportCampaign.getReward(staker.address),
        ).to.be.revertedWith('PassportCampaign: tokens cannot be claimed yet');
      });

      it('should be able to claim rewards gradually over time', async () => {
        await adminPassportCampaign.setTokensClaimable(true);
        await stakerPassportCampaign.stake(STAKE_AMOUNT, stakerScoreProof);

        await setTimestampTo(1);

        await stakerPassportCampaign.getReward(staker.address);

        let currentBalance = await rewardToken.balanceOf(staker.address);

        expect(currentBalance).to.eq(utils.parseEther('6'));

        await setTimestampTo(2);

        await stakerPassportCampaign.getReward(staker.address);

        currentBalance = await rewardToken.balanceOf(staker.address);

        expect(currentBalance).to.eq(utils.parseEther('12'));
      });

      it('should be able to claim the right amount of rewards given the number of participants', async () => {
        await adminPassportCampaign.setTokensClaimable(true);

        await stakerPassportCampaign.stake(STAKE_AMOUNT, stakerScoreProof);

        await setTimestampTo(1);

        await stakerPassportCampaign.getReward(staker.address);

        expect(await rewardToken.balanceOf(staker.address)).to.eq(
          utils.parseEther('6'),
        );

        await stake(user1, STAKE_AMOUNT, user1ScoreProof);

        await setTimestampTo(2);

        await stakerPassportCampaign.getReward(staker.address);
        await user1PassportCampaign.getReward(user1.address);

        expect(await rewardToken.balanceOf(staker.address)).to.eq(
          utils.parseEther('9'),
        );
        expect(await rewardToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('3'),
        );
      });
    });

    describe('#withdraw', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should not be able to withdraw more than the balance', async () => {
        await stakerPassportCampaign.stake(STAKE_AMOUNT, stakerScoreProof);

        await expect(
          stakerPassportCampaign.withdraw(STAKE_AMOUNT.add(1)),
        ).to.be.revertedWith(
          'PassportCampaign: cannot withdraw more than the balance',
        );
      });

      it('should withdraw the correct amount', async () => {
        await stakerPassportCampaign.stake(STAKE_AMOUNT, stakerScoreProof);

        await stakerPassportCampaign.withdraw(STAKE_AMOUNT);

        const balance = await stakingToken.balanceOf(staker.address);

        expect(balance).to.eq(STAKE_AMOUNT);
      });
    });

    describe('#exit', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should be able to exit and get the right amount of staked tokens and rewards', async () => {
        await adminPassportCampaign.setTokensClaimable(true);

        await stakerPassportCampaign.stake(STAKE_AMOUNT, stakerScoreProof);

        await setTimestampTo(1);

        await stakerPassportCampaign.exit();

        const stakingBalance = await stakingToken.balanceOf(staker.address);
        const rewardBalance = await rewardToken.balanceOf(staker.address);

        expect(stakingBalance).to.eq(STAKE_AMOUNT);
        expect(rewardBalance).to.eq(utils.parseEther('6'));
      });
    });
  });

  describe('Admin functions', () => {
    describe('#init', () => {
      it('should not be callable by anyone', async () => {
        await expect(
          stakerPassportCampaign.init(
            staker.address,
            staker.address,
            rewardToken.address,
            stakingToken.address,
            assessor.address,
            DAO_ALLOCATION,
            CREDIT_SCORE_THRESHOLD,
          ),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('should only be callable by the contract owner', async () => {
        await adminPassportCampaign.init(
          admin.address,
          admin.address,
          rewardToken.address,
          stakingToken.address,
          assessor.address,
          DAO_ALLOCATION,
          CREDIT_SCORE_THRESHOLD,
        );

        const arcDao = await adminPassportCampaign.arcDAO();
        const rewardsDistributor = await adminPassportCampaign.rewardsDistributor();
        const rewardsToken = await adminPassportCampaign.rewardsToken();
        const stakingTokenAddress = await adminPassportCampaign.stakingToken();
        const daoAllocation = await adminPassportCampaign.daoAllocation();
        const scoreThreshold = await adminPassportCampaign.creditScoreThreshold();

        expect(arcDao).to.eq(admin.address);
        expect(rewardsDistributor).to.eq(admin.address);
        expect(rewardsToken).to.eq(rewardToken.address);
        expect(stakingTokenAddress).to.eq(stakingToken.address);
        expect(daoAllocation).to.eq(DAO_ALLOCATION);
        expect(scoreThreshold).to.eq(CREDIT_SCORE_THRESHOLD);
      });

      it('should not be called twice by the contract owner', async () => {
        await adminPassportCampaign.init(
          admin.address,
          admin.address,
          rewardToken.address,
          stakingToken.address,
          assessor.address,
          DAO_ALLOCATION,
          CREDIT_SCORE_THRESHOLD,
        );

        await expect(
          adminPassportCampaign.init(
            admin.address,
            admin.address,
            rewardToken.address,
            stakingToken.address,
            assessor.address,
            DAO_ALLOCATION,
            CREDIT_SCORE_THRESHOLD,
          ),
        ).to.be.revertedWith(
          'PassportCampaign: The init function cannot be called twice',
        );
      });
    });

    describe('#notifyRewardAmount', () => {
      it('should not be callable by anyone', async () => {
        await expect(
          stakerPassportCampaign.notifyRewardAmount(REWARD_AMOUNT),
        ).to.be.revertedWith(
          'PassportCampaign: caller is not a rewards distributor',
        );
      });

      it('should only be callable by the rewards distributor', async () => {
        await adminPassportCampaign.init(
          admin.address,
          admin.address,
          rewardToken.address,
          stakingToken.address,
          assessor.address,
          DAO_ALLOCATION,
          CREDIT_SCORE_THRESHOLD,
        );

        await adminPassportCampaign.setRewardsDuration(REWARD_DURATION);

        await adminPassportCampaign.notifyRewardAmount(REWARD_AMOUNT);

        const rewardrate = await adminPassportCampaign.rewardRate();

        expect(rewardrate).to.be.eq(utils.parseEther('10'));
      });

      it('should update rewards correctly after a new reward update', async () => {
        await adminPassportCampaign.init(
          admin.address,
          admin.address,
          rewardToken.address,
          stakingToken.address,
          assessor.address,
          DAO_ALLOCATION,
          CREDIT_SCORE_THRESHOLD,
        );

        await adminPassportCampaign.setRewardsDuration(REWARD_DURATION);

        await adminPassportCampaign.notifyRewardAmount(REWARD_AMOUNT.div(2));

        const rewardRate0 = await adminPassportCampaign.rewardRate();

        expect(rewardRate0).to.eq(utils.parseEther('5'));

        await setTimestampTo(1);

        await adminPassportCampaign.notifyRewardAmount(REWARD_AMOUNT.div(2));

        const rewardrate1 = await adminPassportCampaign.rewardRate();

        expect(rewardrate1).to.eq(utils.parseEther('9.5'));
      });
    });

    describe('#setRewardsDistributor', () => {
      it('should not be callable by non-admin', async () => {
        await expect(
          stakerPassportCampaign.setRewardsDistributor(staker.address),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('should set rewardsDistributor if called by admin', async () => {
        await adminPassportCampaign.setRewardsDistributor(unauthorized.address);

        expect(await adminPassportCampaign.rewardsDistributor()).to.eq(
          unauthorized.address,
        );
      });
    });

    describe('#setRewardsDuration', () => {
      it('should not be claimable by anyone', async () => {
        await expect(
          stakerPassportCampaign.setRewardsDuration(
            BigNumber.from(REWARD_DURATION),
          ),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('should only be callable by the contract owner and set the right duration', async () => {
        const duration = BigNumber.from(REWARD_DURATION);

        await adminPassportCampaign.setRewardsDuration(duration);

        expect(await adminPassportCampaign.rewardsDuration()).to.eq(duration);
      });
    });

    describe('#recoverERC20', () => {
      const erc20Share = utils.parseEther('10');

      beforeEach(async () => {
        await otherErc20.mintShare(adminPassportCampaign.address, erc20Share);
      });

      it('should not be callable by anyone', async () => {
        await expect(
          stakerPassportCampaign.recoverERC20(otherErc20.address, erc20Share),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('should not recover staking or reward token', async () => {
        await setup();
        await stakingToken.mintShare(adminPassportCampaign.address, erc20Share);
        await rewardToken.mintShare(adminPassportCampaign.address, erc20Share);

        await expect(
          adminPassportCampaign.recoverERC20(stakingToken.address, erc20Share),
        ).to.be.revertedWith(
          'PassportCampaign: cannot withdraw staking or rewards tokens',
        );
        await expect(
          adminPassportCampaign.recoverERC20(rewardToken.address, erc20Share),
        ).to.be.revertedWith(
          'PassportCampaign: cannot withdraw staking or rewards tokens',
        );
      });

      it('should let admin recover the erc20 on this contract', async () => {
        const balance0 = await otherErc20.balanceOf(admin.address);

        await adminPassportCampaign.recoverERC20(
          otherErc20.address,
          erc20Share,
        );

        const balance1 = await otherErc20.balanceOf(admin.address);

        expect(balance1).to.eq(balance0.add(erc20Share));
      });
    });

    describe('#setTokensClaimable', () => {
      it('should not be claimable by anyone', async () => {
        await expect(
          stakerPassportCampaign.setTokensClaimable(true),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('should only be callable by the contract owner', async () => {
        await adminPassportCampaign.setTokensClaimable(true);

        expect(await adminPassportCampaign.tokensClaimable()).to.be.eq(true);
      });
    });

    describe('#setCreditScoreThreshold', () => {
      it('reverts if called by non-owner', async () => {
        await expect(
          unauthorizedPassportCampaign.setCreditScoreThreshold(
            BigNumber.from(10),
          ),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('sets the credit score threshold', async () => {
        await setup();

        const newThreshold = BigNumber.from(CREDIT_SCORE_THRESHOLD.sub(100));

        expect(await adminPassportCampaign.creditScoreThreshold()).to.eq(
          CREDIT_SCORE_THRESHOLD,
        );

        await adminPassportCampaign.setCreditScoreThreshold(newThreshold);

        expect(await adminPassportCampaign.creditScoreThreshold()).to.eq(
          newThreshold,
        );
      });
    });
  });

  xdescribe('Scenarios', () => {
    let users: Record<string, SignerWithAddress>;
    let creditScoreProofs: Record<string, CreditScoreProof>;

    before(async () => {
      await adminPassportCampaign.setRewardsDistributor(admin.address);

      await adminPassportCampaign.init(
        admin.address,
        admin.address,
        rewardToken.address,
        stakingToken.address,
        assessor.address,
        DAO_ALLOCATION,
        CREDIT_SCORE_THRESHOLD,
      );

      const signers = await ethers.getSigners();

      const users = {
        userA: signers[1],
        userB: signers[2],
        userC: signers[3],
        userD: signers[4],
        userE: signers[5],
      };

      // Set up credit scores for the users of this scenario
      const creditScores: Record<string, CreditScore> = {};
      Object.keys(users).forEach((userKey) => {
        creditScoreTree[userKey] = {
          account: users[userKey].address,
          amount: CREDIT_SCORE_THRESHOLD,
        };
      });

      const newCreditScoreTree = new CreditScoreTree(
        Object.values(creditScores),
      );

      const creditScoreProofs: Record<string, CreditScoreProof> = {};
      Object.keys(users).forEach((userKey) => {
        creditScoreProofs[userKey] = getScoreProof(
          creditScores[userKey],
          newCreditScoreTree,
        );
      });

      await immediatelyUpdateMerkleRoot(
        creditScoreContract,
        newCreditScoreTree.getHexRoot(),
      );
    });

    it('should not get any rewards if user stakes before the reward is notified', async () => {
      await adminPassportCampaign.setRewardsDuration(REWARD_DURATION);
      await setTimestampTo(0);

      await stakerPassportCampaign.stake(STAKE_AMOUNT, stakerScoreProof);

      await setTimestampTo(4);

      expect(await earned(staker)).to.eq(BigNumber.from(0));

      await adminPassportCampaign.notifyRewardAmount(REWARD_AMOUNT);

      await setTimestampTo(6);

      expect(await earned(staker)).to.eq(utils.parseEther('20'));
    });

    it('should distribute rewards to users correctly', async () => {
      await adminPassportCampaign.setRewardsDuration(20);
      await setTimestampTo(0);

      await stake(users.userA, STAKE_AMOUNT, creditScoreProofs.userA);
      await stake(users.userB, STAKE_AMOUNT, creditScoreProofs.userB);

      await rewardToken.mintShare(
        adminPassportCampaign.address,
        utils.parseEther('200'),
      );

      await adminPassportCampaign.notifyRewardAmount(utils.parseEther('300')); // 0

      expect(await earned(users.userA)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userC)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userD)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userE)).to.eq(utils.parseEther('0'));

      await setTimestampTo(1);

      expect(await earned(users.userA)).to.eq(utils.parseEther('7.5'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('7.5'));
      expect(await earned(users.userC)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userD)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userE)).to.eq(utils.parseEther('0'));

      await setTimestampTo(2);

      expect(await earned(users.userA)).to.eq(utils.parseEther('15'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('15'));
      expect(await earned(users.userC)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userD)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userE)).to.eq(utils.parseEther('0'));

      await setTimestampTo(4);

      await stake(users.userC, STAKE_AMOUNT, creditScoreProofs.userC);

      expect(await earned(users.userA)).to.eq(utils.parseEther('30'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('30'));
      expect(await earned(users.userC)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userD)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userE)).to.eq(utils.parseEther('0'));

      await setTimestampTo(5);

      expect(await earned(users.userA)).to.eq(utils.parseEther('35'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('35'));
      expect(await earned(users.userC)).to.eq(utils.parseEther('5'));
      expect(await earned(users.userD)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userE)).to.eq(utils.parseEther('0'));

      await setTimestampTo(8);

      await stake(users.userD, STAKE_AMOUNT, creditScoreProofs.userD);

      expect(await earned(users.userA)).to.eq(utils.parseEther('50'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('50'));
      expect(await earned(users.userC)).to.eq(utils.parseEther('20'));
      expect(await earned(users.userD)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userE)).to.eq(utils.parseEther('0'));

      await setTimestampTo(9);

      expect(await earned(users.userA)).to.eq(utils.parseEther('53.75'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('53.75'));
      expect(await earned(users.userC)).to.eq(utils.parseEther('23.75'));
      expect(await earned(users.userD)).to.eq(utils.parseEther('3.75'));
      expect(await earned(users.userE)).to.eq(utils.parseEther('0'));

      await setTimestampTo(10);

      expect(await earned(users.userA)).to.eq(utils.parseEther('57.5'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('57.5'));
      expect(await earned(users.userC)).to.eq(utils.parseEther('27.5'));
      expect(await earned(users.userD)).to.eq(utils.parseEther('7.5'));
      expect(await earned(users.userE)).to.eq(utils.parseEther('0'));

      await setTimestampTo(13);

      await stake(users.userE, STAKE_AMOUNT, creditScoreProofs.userE);

      expect(await earned(users.userA)).to.eq(utils.parseEther('68.75'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('68.75'));
      expect(await earned(users.userC)).to.eq(utils.parseEther('38.75'));
      expect(await earned(users.userD)).to.eq(utils.parseEther('18.75'));
      expect(await earned(users.userE)).to.eq(utils.parseEther('0'));

      await adminPassportCampaign.setTokensClaimable(true);

      await setTimestampTo(16);

      expect(await earned(users.userA)).to.eq(utils.parseEther('77.75'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('77.75'));
      expect(await earned(users.userC)).to.eq(utils.parseEther('47.75'));
      expect(await earned(users.userD)).to.eq(utils.parseEther('27.75'));
      expect(await earned(users.userE)).to.eq(utils.parseEther('9'));

      await setTimestampTo(17);

      await withdraw(users.userC);

      await setTimestampTo(19);

      expect(await earned(users.userA)).to.eq(utils.parseEther('88.25'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('88.25'));
      expect(await earned(users.userC)).to.eq(utils.parseEther('50.75'));
      expect(await earned(users.userD)).to.eq(utils.parseEther('38.25'));
      expect(await earned(users.userE)).to.eq(utils.parseEther('19.5'));

      await setTimestampTo(20);

      await exitCampaign(users.userA);
      await exitCampaign(users.userB);
      await claimReward(users.userC);
      await exitCampaign(users.userD);
      await exitCampaign(users.userE);

      expect(await rewardBalanceOf(users.userA)).to.be.eq(
        utils.parseEther('55.2'),
      );
      expect(await rewardBalanceOf(users.userB)).to.be.eq(
        utils.parseEther('55.2'),
      );
      expect(await rewardBalanceOf(users.userC)).to.be.eq(
        utils.parseEther('30.45'),
      );
      expect(await rewardBalanceOf(users.userD)).to.be.eq(
        utils.parseEther('25.2'),
      );
      expect(await rewardBalanceOf(users.userE)).to.be.eq(
        utils.parseEther('13.95'),
      );
    });

    it('should distribute rewards correctly for 2 users', async () => {
      await adminPassportCampaign.setRewardsDuration(20);
      await adminPassportCampaign.setCurrentTimestamp(0);

      await stake(users.userA, STAKE_AMOUNT, creditScoreProofs.userA);

      await rewardToken.mintShare(
        adminPassportCampaign.address,
        utils.parseEther('200'),
      );

      await adminPassportCampaign.notifyRewardAmount(utils.parseEther('300')); // 0

      expect(await earned(users.userA)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('0'));

      await setTimestampTo(1);

      expect(await earned(users.userA)).to.eq(utils.parseEther('15'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('0'));

      await setTimestampTo(10);

      await stake(users.userB, STAKE_AMOUNT, creditScoreProofs.userB);

      expect(await earned(users.userA)).to.eq(utils.parseEther('150'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('0'));

      await setTimestampTo(11);

      expect(await earned(users.userA)).to.eq(utils.parseEther('157.5'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('7.5'));

      await setTimestampTo(20);

      expect(await earned(users.userA)).to.eq(utils.parseEther('225'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('75'));
    });

    it('should distribute rewards to 3 users correctly', async () => {
      await adminPassportCampaign.setRewardsDuration(20);
      await adminPassportCampaign.setCurrentTimestamp(0);

      await stake(users.userA, STAKE_AMOUNT, creditScoreProofs.userA);

      await adminPassportCampaign.notifyRewardAmount(utils.parseEther('100')); // 0

      expect(await earned(users.userA)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userC)).to.eq(utils.parseEther('0'));

      await adminPassportCampaign.setCurrentTimestamp(1);

      expect(await earned(users.userA)).to.eq(utils.parseEther('5'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userC)).to.eq(utils.parseEther('0'));

      await adminPassportCampaign.setCurrentTimestamp(3);

      await stake(users.userB, STAKE_AMOUNT, creditScoreProofs.userB);

      expect(await earned(users.userA)).to.eq(utils.parseEther('15'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('0'));
      expect(await earned(users.userC)).to.eq(utils.parseEther('0'));

      await adminPassportCampaign.setCurrentTimestamp(8);

      await stake(users.userC, STAKE_AMOUNT.mul(2), creditScoreProofs.userC);

      expect(await earned(users.userA)).to.eq(utils.parseEther('27.5'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('12.5'));
      expect(await earned(users.userC)).to.eq(utils.parseEther('0'));

      await adminPassportCampaign.setCurrentTimestamp(10);

      expect(await earned(users.userA)).to.eq(utils.parseEther('30'));
      expect(await earned(users.userB)).to.eq(utils.parseEther('15'));
      expect(await earned(users.userC)).to.eq(utils.parseEther('5'));

      await adminPassportCampaign.setCurrentTimestamp(13);

      await adminPassportCampaign.setTokensClaimable(true);

      await exitCampaign(users.userB);
      await withdraw(users.userC, STAKE_AMOUNT);

      await adminPassportCampaign.setCurrentTimestamp(20);

      expect(await earned(users.userA)).to.eq(utils.parseEther('51.25'));

      expect(await earned(users.userB)).to.eq(utils.parseEther('18.75'));
      expect(
        (await adminPassportCampaign.stakers(users.userB.address))
          .rewardsReleased,
      ).to.eq(utils.parseEther('18.75'));

      expect(await earned(users.userC)).to.eq(utils.parseEther('30'));
    });

    it('should distribute rewards correctly if new rewards are notified before the end of the period', async () => {
      await adminPassportCampaign.setRewardsDuration(10);
      await setTimestampTo(0);

      await adminPassportCampaign.notifyRewardAmount(utils.parseEther('100'));

      await setTimestampTo(1);

      await stake(staker, STAKE_AMOUNT, stakerScoreProof);

      await setTimestampTo(2);

      expect(await earned(staker)).to.eq(utils.parseEther('10'));

      await setTimestampTo(3);

      await stake(unauthorized, STAKE_AMOUNT, stakerScoreProof);

      await setTimestampTo(4);

      expect(await earned(staker)).to.eq(utils.parseEther('25'));
      expect(await earned(unauthorized)).to.eq(utils.parseEther('5'));

      await rewardToken.mintShare(
        adminPassportCampaign.address,
        utils.parseEther('100'),
      );
      await adminPassportCampaign.notifyRewardAmount(utils.parseEther('100'));

      // New rewards: 60 + 100 = 160 distributed over 10 epochs

      await setTimestampTo(5);

      expect(await earned(staker)).to.eq(utils.parseEther('33'));
      expect(await earned(unauthorized)).to.eq(utils.parseEther('13'));

      await withdraw(staker, STAKE_AMOUNT);

      await setTimestampTo(6);

      expect(await earned(staker)).to.eq(utils.parseEther('33'));
      expect(await earned(unauthorized)).to.eq(utils.parseEther('29'));

      await adminPassportCampaign.setTokensClaimable(true);

      await stakerPassportCampaign.getReward(staker.address);

      expect(await rewardToken.balanceOf(staker.address)).to.eq(
        utils.parseEther('19.8'),
      );

      await setTimestampTo(7);

      expect(await earned(unauthorized)).to.eq(utils.parseEther('45'));

      await stakerPassportCampaign.getReward(unauthorized.address);

      expect(await rewardToken.balanceOf(unauthorized.address)).to.eq(
        utils.parseEther('27'),
      );
    });

    it(
      'should allow user to stake, then credit score threshold is lowered and user should not be able to stake more',
    );
  });
});
