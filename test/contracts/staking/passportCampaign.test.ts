import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
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
import { expectRevert } from '@test/helpers/expectRevert';
import { EVM } from '@test/helpers/EVM';
import { solidity } from 'ethereum-waffle';
import { MockPassportCampaign } from '@src/typings/MockPassportCampaign';
import { MockPassportCampaignFactory } from '@src/typings/MockPassportCampaignFactory';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';

chai.use(solidity);
const expect = chai.expect;

let passportCampaignAdmin: MockPassportCampaign;
let passportCampaignUser1: MockPassportCampaign;
let passportCampaignUser2: MockPassportCampaign;

const REWARD_AMOUNT = utils.parseEther('100');
const STAKE_AMOUNT = utils.parseEther('10');
const REWARD_DURATION = 10;

const DAO_ALLOCATION = utils.parseEther('0.4');
const USER_ALLOCATION = BASE.sub(DAO_ALLOCATION);

const CREDIT_SCORE_THRESHOLD = BigNumber.from(500);

let stakingToken: TestToken;
let rewardToken: TestToken;
let otherErc20: TestToken;

let admin: SignerWithAddress;
let user1: SignerWithAddress;
let user2: SignerWithAddress;

let evm: EVM;

describe('PassportCampaign', () => {
  async function increaseTime(duration: number) {
    await evm.increaseTime(duration);
    await evm.mineBlock();
  }

  async function setTimestampTo(timestamp: number) {
    await passportCampaignAdmin.setCurrentTimestamp(timestamp);
  }

  async function stake(user: SignerWithAddress, amount: BigNumber) {
    await mintAndApprove(stakingToken, user, amount);

    const timestampAtStake = await getCurrentTimestamp();
    const contract = MockPassportCampaignFactory.connect(
      passportCampaignAdmin.address,
      user,
    );
    await contract.stake(amount);

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
    await tokenContract.approve(passportCampaignAdmin.address, amount);
  }

  async function withdraw(user: SignerWithAddress, amount?: BigNumber) {
    const contract = MockPassportCampaignFactory.connect(
      passportCampaignAdmin.address,
      user,
    );

    await contract.withdraw(amount ?? STAKE_AMOUNT);
  }

  async function exitCampaign(user: SignerWithAddress) {
    const contract = MockPassportCampaignFactory.connect(
      passportCampaignAdmin.address,
      user,
    );

    await contract.exit();
  }

  async function claimReward(user: SignerWithAddress) {
    const contract = MockPassportCampaignFactory.connect(
      passportCampaignAdmin.address,
      user,
    );

    await contract.getReward(user.address);
  }

  async function rewardBalanceOf(user: SignerWithAddress) {
    return await rewardToken.balanceOf(user.address);
  }

  async function earned(user: SignerWithAddress) {
    return await passportCampaignAdmin.actualEarned(user.address);
  }

  async function getCurrentTimestamp() {
    return passportCampaignAdmin.currentTimestamp();
  }

  async function setup() {
    if (!passportCampaignAdmin || !admin) {
      throw 'Liquidity campaign or admin cannot be null';
    }

    await passportCampaignAdmin.setRewardsDistributor(admin.address);

    await passportCampaignAdmin.setRewardsDuration(REWARD_DURATION);

    await passportCampaignAdmin.init(
      admin.address,
      admin.address,
      rewardToken.address,
      stakingToken.address,
      DAO_ALLOCATION,
      CREDIT_SCORE_THRESHOLD,
    );

    await setTimestampTo(0);
    await passportCampaignAdmin.notifyRewardAmount(REWARD_AMOUNT);
  }

  before(async () => {
    const signers = await ethers.getSigners();
    evm = new EVM(hre.ethers.provider);
    admin = signers[0];
    user1 = signers[1];
    user2 = signers[2];

    stakingToken = await deployTestToken(admin, '3Pool', 'CRV');
    rewardToken = await deployTestToken(admin, 'Arc Token', 'ARC');
    otherErc20 = await deployTestToken(admin, 'Another ERC20 token', 'AERC20');

    passportCampaignAdmin = await new MockPassportCampaignFactory(
      admin,
    ).deploy();

    const proxy = await new ArcProxyFactory(admin).deploy(
      passportCampaignAdmin.address,
      await admin.getAddress(),
      [],
    );

    passportCampaignAdmin = await new MockPassportCampaignFactory(admin).attach(
      proxy.address,
    );
    passportCampaignUser1 = await new MockPassportCampaignFactory(user1).attach(
      proxy.address,
    );
    passportCampaignUser2 = await new MockPassportCampaignFactory(user2).attach(
      proxy.address,
    );

    await rewardToken.mintShare(passportCampaignAdmin.address, REWARD_AMOUNT);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('View functions', () => {
    describe('#lastTimeRewardApplicable', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should return the block timestamp if called before the reward period finished', async () => {
        const currentTime = await getCurrentTimestamp();

        expect(await passportCampaignAdmin.lastTimeRewardApplicable()).to.eq(
          currentTime,
        );
      });

      it('should return the period finish if called after reward period has finished', async () => {
        await setTimestampTo(REWARD_DURATION);

        const periodFinish = await passportCampaignAdmin.periodFinish();
        expect(await passportCampaignAdmin.lastTimeRewardApplicable()).to.eq(
          periodFinish,
        );
      });
    });

    describe('#balanceOf', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should return the correct balance', async () => {
        const stakingAmount = utils.parseEther('10');

        await stakingToken.mintShare(admin.address, stakingAmount);
        await stakingToken.approve(
          passportCampaignAdmin.address,
          stakingAmount,
        );

        await passportCampaignAdmin.stake(stakingAmount);

        expect(await passportCampaignAdmin.balanceOf(admin.address)).to.eq(
          stakingAmount,
        );
      });
    });

    describe('#rewardPerToken', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should return the reward per token stored if the supply is 0', async () => {
        const rewardPerTokenStored = await passportCampaignAdmin.rewardPerTokenStored();

        expect(await passportCampaignAdmin.rewardPerToken()).to.eq(
          rewardPerTokenStored,
        );
      });

      it('should return a valid reward per token after someone staked', async () => {
        const stakingAmount = utils.parseEther('10');
        await mintAndApprove(stakingToken, user1, stakingAmount);

        await passportCampaignUser1.stake(stakingAmount.div(2));
        await passportCampaignUser1.stake(stakingAmount.div(2));

        await setTimestampTo(1);

        console.log({
          daoAllocation: (
            await passportCampaignAdmin.daoAllocation()
          ).toString(),
        });

        const rewardPerToken = await passportCampaignUser1.rewardPerToken();
        const rewardPerTokenStored = await passportCampaignAdmin.rewardPerTokenStored();

        expect(rewardPerToken).to.be.gt(BigNumber.from(0));
        expect(rewardPerToken).to.not.eq(rewardPerTokenStored);
      });
    });

    describe('#userAllocation', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should return the correct user allocation', async () => {
        const userAllocation = await passportCampaignUser1.userAllocation();

        expect(userAllocation).to.eq(BASE.sub(DAO_ALLOCATION));
      });
    });

    describe('#earned', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should return the correct amount earned over time', async () => {
        await stake(user1, STAKE_AMOUNT);
        // Check amount earned (should be 0)
        const amountEarned0 = await passportCampaignUser1.earned(user1.address);
        expect(amountEarned0).to.eq(BigNumber.from(0));

        // Advance time
        await setTimestampTo(1);

        expect(await earned(user1)).to.eq(utils.parseEther('10'));

        await setTimestampTo(2);

        expect(await earned(user1)).to.eq(utils.parseEther('20'));
      });

      it('should return the correct amount earned over time while another user stakes in between', async () => {
        await setTimestampTo(1);

        // User A stakes
        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(2);

        // User B stakes
        await stake(user2, STAKE_AMOUNT); // adds 3 epochs

        await setTimestampTo(3);

        // Check amount earned
        expect(await earned(user1)).to.eq(utils.parseEther('15'));
        expect(await earned(user2)).to.eq(utils.parseEther('5'));
      });
    });

    describe('#getRewardForDuration', () => {
      beforeEach(async () => {
        await setup();
      });

      it('returns the correct reward for duration', async () => {
        const rewardForDuration = await passportCampaignAdmin.getRewardForDuration();

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
        const amount = utils.parseEther('10');
        await mintAndApprove(stakingToken, user1, amount.mul(2));

        await expect(passportCampaignUser1.stake(amount)).to.be.revertedWith(
          'SapphireAssessor: proof should be provided for credit score',
        );
      });

      it(
        'reverts if called by a user with a credit score that is lower than required',
      );

      it('should not be able to stake more than balance', async () => {
        await mintAndApprove(stakingToken, user1, utils.parseEther('10'));

        const balance = await stakingToken.balanceOf(user1.address);

        await expectRevert(passportCampaignUser1.stake(balance.add(1)));
      });

      it('should be able to stake', async () => {
        const amount = utils.parseEther('10');
        await mintAndApprove(stakingToken, user1, amount.mul(2));

        await passportCampaignUser1.stake(amount);

        let supply = await passportCampaignUser1.totalSupply();

        expect(supply).to.eq(amount);

        await passportCampaignUser1.stake(amount);

        supply = await passportCampaignUser1.totalSupply();

        expect(supply).to.eq(amount.mul(2));
        expect(
          await stakingToken.balanceOf(passportCampaignAdmin.address),
        ).to.eq(amount.mul(2));
      });

      it('should update reward correctly after staking', async () => {
        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        let earned = await passportCampaignUser1.earned(user1.address);

        expect(earned).to.eq(utils.parseEther('6'));

        await setTimestampTo(2);

        earned = await passportCampaignUser1.earned(user1.address);

        expect(earned).to.eq(utils.parseEther('12'));
      });
    });

    describe('#getReward', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should not be able to get the reward if the tokens are not claimable', async () => {
        await stake(user1, STAKE_AMOUNT);

        await increaseTime(REWARD_DURATION / 2);

        await expectRevert(passportCampaignUser1.getReward(user1.address));
      });

      it('should be able to claim rewards gradually over time', async () => {
        await passportCampaignAdmin.setTokensClaimable(true);

        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        const currentBalance = await rewardToken.balanceOf(user1.address);

        await passportCampaignUser1.getReward(user1.address);

        expect(await rewardToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('6'),
        );

        await setTimestampTo(2);

        await passportCampaignUser1.getReward(user1.address);

        expect(await rewardToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('12'),
        );
      });

      it('should be able to claim the right amount of rewards given the number of participants', async () => {
        await passportCampaignAdmin.setTokensClaimable(true);

        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        await passportCampaignUser1.getReward(user1.address);

        expect(await rewardToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('6'),
        );

        await stake(user2, STAKE_AMOUNT);

        await setTimestampTo(2);

        await passportCampaignUser1.getReward(user1.address);
        await passportCampaignUser2.getReward(user2.address);

        expect(await rewardToken.balanceOf(user1.address)).to.eq(
          utils.parseEther('9'),
        );
        expect(await rewardToken.balanceOf(user2.address)).to.eq(
          utils.parseEther('3'),
        );
      });
    });

    describe('#withdraw', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should not be able to withdraw more than the balance', async () => {
        await stake(user1, STAKE_AMOUNT);

        await expectRevert(passportCampaignUser1.withdraw(STAKE_AMOUNT.add(1)));
      });

      it('should withdraw the correct amount', async () => {
        await stake(user1, STAKE_AMOUNT);

        await passportCampaignUser1.withdraw(STAKE_AMOUNT);

        const balance = await stakingToken.balanceOf(user1.address);

        expect(balance).to.eq(STAKE_AMOUNT);
      });
    });

    describe('#exit', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should be able to exit and get the right amount of staked tokens and rewards', async () => {
        await passportCampaignAdmin.setTokensClaimable(true);

        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        await passportCampaignUser1.exit();

        const stakingBalance = await stakingToken.balanceOf(user1.address);
        const rewardBalance = await rewardToken.balanceOf(user1.address);

        expect(stakingBalance).to.eq(STAKE_AMOUNT);
        expect(rewardBalance).to.eq(utils.parseEther('6'));
      });
    });
  });

  describe('Admin functions', () => {
    describe('#init', () => {
      it('should not be callable by anyone', async () => {
        await expectRevert(
          passportCampaignUser1.init(
            user1.address,
            user1.address,
            rewardToken.address,
            stakingToken.address,
            DAO_ALLOCATION,
            CREDIT_SCORE_THRESHOLD,
          ),
        );
      });

      it('should only be callable by the contract owner', async () => {
        await passportCampaignAdmin.init(
          admin.address,
          admin.address,
          rewardToken.address,
          stakingToken.address,
          DAO_ALLOCATION,
          CREDIT_SCORE_THRESHOLD,
        );

        const arcDao = await passportCampaignAdmin.arcDAO();
        const rewardsDistributor = await passportCampaignAdmin.rewardsDistributor();
        const rewardsToken = await passportCampaignAdmin.rewardsToken();
        const stakingTokenAddress = await passportCampaignAdmin.stakingToken();
        const daoAllocation = await passportCampaignAdmin.daoAllocation();
        const scoreThreshold = await passportCampaignAdmin.creditScoreThreshold();

        expect(arcDao).to.eq(admin.address);
        expect(rewardsDistributor).to.eq(admin.address);
        expect(rewardsToken).to.eq(rewardToken.address);
        expect(stakingTokenAddress).to.eq(stakingToken.address);
        expect(daoAllocation).to.eq(DAO_ALLOCATION);
        expect(scoreThreshold).to.eq(CREDIT_SCORE_THRESHOLD);
      });

      it('should not be called twice by the contract owner', async () => {
        await passportCampaignAdmin.init(
          admin.address,
          admin.address,
          rewardToken.address,
          stakingToken.address,
          DAO_ALLOCATION,
          CREDIT_SCORE_THRESHOLD,
        );

        await expectRevert(
          passportCampaignAdmin.init(
            admin.address,
            admin.address,
            rewardToken.address,
            stakingToken.address,
            DAO_ALLOCATION,
            CREDIT_SCORE_THRESHOLD,
          ),
        );
      });
    });

    describe('#notifyRewardAmount', () => {
      it('should not be callable by anyone', async () => {
        await expectRevert(
          passportCampaignUser1.notifyRewardAmount(REWARD_AMOUNT),
        );
      });

      it('should only be callable by the rewards distributor', async () => {
        await passportCampaignAdmin.init(
          admin.address,
          admin.address,
          rewardToken.address,
          stakingToken.address,
          DAO_ALLOCATION,
          CREDIT_SCORE_THRESHOLD,
        );

        await passportCampaignAdmin.setRewardsDuration(REWARD_DURATION);

        await passportCampaignAdmin.notifyRewardAmount(REWARD_AMOUNT);

        const rewardrate = await passportCampaignAdmin.rewardRate();

        expect(rewardrate).to.be.eq(utils.parseEther('10'));
      });

      it('should update rewards correctly after a new reward update', async () => {
        await passportCampaignAdmin.init(
          admin.address,
          admin.address,
          rewardToken.address,
          stakingToken.address,
          DAO_ALLOCATION,
          CREDIT_SCORE_THRESHOLD,
        );

        await passportCampaignAdmin.setRewardsDuration(REWARD_DURATION);

        await passportCampaignAdmin.notifyRewardAmount(REWARD_AMOUNT.div(2));

        const rewardRate0 = await passportCampaignAdmin.rewardRate();

        expect(rewardRate0).to.eq(utils.parseEther('5'));

        await setTimestampTo(1);

        await passportCampaignAdmin.notifyRewardAmount(REWARD_AMOUNT.div(2));

        const rewardrate1 = await passportCampaignAdmin.rewardRate();

        expect(rewardrate1).to.eq(utils.parseEther('9.5'));
      });
    });

    describe('#setRewardsDistributor', () => {
      it('should not be callable by non-admin', async () => {
        await expectRevert(
          passportCampaignUser1.setRewardsDistributor(user1.address),
        );
      });

      it('should set rewardsDistributor if called by admin', async () => {
        await passportCampaignAdmin.setRewardsDistributor(user2.address);

        expect(await passportCampaignAdmin.rewardsDistributor()).to.eq(
          user2.address,
        );
      });
    });

    describe('#setRewardsDuration', () => {
      it('should not be claimable by anyone', async () => {
        await expectRevert(
          passportCampaignUser1.setRewardsDuration(
            BigNumber.from(REWARD_DURATION),
          ),
        );
      });

      it('should only be callable by the contract owner and set the right duration', async () => {
        const duration = BigNumber.from(REWARD_DURATION);

        await passportCampaignAdmin.setRewardsDuration(duration);

        expect(await passportCampaignAdmin.rewardsDuration()).to.eq(duration);
      });
    });

    describe('#recoverERC20', () => {
      const erc20Share = utils.parseEther('10');

      beforeEach(async () => {
        await otherErc20.mintShare(passportCampaignAdmin.address, erc20Share);
      });

      it('should not be callable by anyone', async () => {
        await expectRevert(
          passportCampaignUser1.recoverERC20(otherErc20.address, erc20Share),
        );
      });

      it('should not recover staking or reward token', async () => {
        await setup();
        await stakingToken.mintShare(passportCampaignAdmin.address, erc20Share);
        await rewardToken.mintShare(passportCampaignAdmin.address, erc20Share);

        await expectRevert(
          passportCampaignAdmin.recoverERC20(stakingToken.address, erc20Share),
        );
        await expectRevert(
          passportCampaignAdmin.recoverERC20(rewardToken.address, erc20Share),
        );
      });

      it('should let admin recover the erc20 on this contract', async () => {
        const balance0 = await otherErc20.balanceOf(admin.address);

        await passportCampaignAdmin.recoverERC20(
          otherErc20.address,
          erc20Share,
        );

        const balance1 = await otherErc20.balanceOf(admin.address);

        expect(balance1).to.eq(balance0.add(erc20Share));
      });
    });

    describe('#setTokensClaimable', () => {
      it('should not be claimable by anyone', async () => {
        await expectRevert(passportCampaignUser1.setTokensClaimable(true));
      });

      it('should only be callable by the contract owner', async () => {
        await passportCampaignAdmin.setTokensClaimable(true);

        expect(await passportCampaignAdmin.tokensClaimable()).to.be.eq(true);
      });
    });

    describe('#setCreditScoreThreshold', () => {
      it('reverts if called by non-owner');

      it('sets the credit score threshold');
    });
  });

  xdescribe('Scenarios', () => {
    beforeEach(async () => {
      await passportCampaignAdmin.setRewardsDistributor(admin.address);

      await passportCampaignAdmin.init(
        admin.address,
        admin.address,
        rewardToken.address,
        stakingToken.address,
        DAO_ALLOCATION,
        CREDIT_SCORE_THRESHOLD,
      );
    });

    it('should not get any rewards if user stakes before the reward is notified', async () => {
      await passportCampaignAdmin.setRewardsDuration(REWARD_DURATION);
      await setTimestampTo(0);

      await stake(user1, STAKE_AMOUNT);

      await setTimestampTo(4);

      expect(await earned(user1)).to.eq(BigNumber.from(0));

      await passportCampaignAdmin.notifyRewardAmount(REWARD_AMOUNT);

      await setTimestampTo(6);

      expect(await earned(user1)).to.eq(utils.parseEther('20'));
    });

    it('should distribute rewards to users correctly', async () => {
      await passportCampaignAdmin.setRewardsDuration(20);
      await setTimestampTo(0);
      const users = await ethers.getSigners();

      const userA = users[1];
      const userB = users[2];
      const userC = users[3];
      const userD = users[4];
      const userE = users[5];

      await stake(userA, STAKE_AMOUNT);
      await stake(userB, STAKE_AMOUNT);

      await rewardToken.mintShare(
        passportCampaignAdmin.address,
        utils.parseEther('200'),
      );

      await passportCampaignAdmin.notifyRewardAmount(utils.parseEther('300')); // 0

      expect(await earned(userA)).to.eq(utils.parseEther('0'));
      expect(await earned(userB)).to.eq(utils.parseEther('0'));
      expect(await earned(userC)).to.eq(utils.parseEther('0'));
      expect(await earned(userD)).to.eq(utils.parseEther('0'));
      expect(await earned(userE)).to.eq(utils.parseEther('0'));

      await setTimestampTo(1);

      expect(await earned(userA)).to.eq(utils.parseEther('7.5'));
      expect(await earned(userB)).to.eq(utils.parseEther('7.5'));
      expect(await earned(userC)).to.eq(utils.parseEther('0'));
      expect(await earned(userD)).to.eq(utils.parseEther('0'));
      expect(await earned(userE)).to.eq(utils.parseEther('0'));

      await setTimestampTo(2);

      expect(await earned(userA)).to.eq(utils.parseEther('15'));
      expect(await earned(userB)).to.eq(utils.parseEther('15'));
      expect(await earned(userC)).to.eq(utils.parseEther('0'));
      expect(await earned(userD)).to.eq(utils.parseEther('0'));
      expect(await earned(userE)).to.eq(utils.parseEther('0'));

      await setTimestampTo(4);

      await stake(userC, STAKE_AMOUNT);

      expect(await earned(userA)).to.eq(utils.parseEther('30'));
      expect(await earned(userB)).to.eq(utils.parseEther('30'));
      expect(await earned(userC)).to.eq(utils.parseEther('0'));
      expect(await earned(userD)).to.eq(utils.parseEther('0'));
      expect(await earned(userE)).to.eq(utils.parseEther('0'));

      await setTimestampTo(5);

      expect(await earned(userA)).to.eq(utils.parseEther('35'));
      expect(await earned(userB)).to.eq(utils.parseEther('35'));
      expect(await earned(userC)).to.eq(utils.parseEther('5'));
      expect(await earned(userD)).to.eq(utils.parseEther('0'));
      expect(await earned(userE)).to.eq(utils.parseEther('0'));

      await setTimestampTo(8);

      await stake(userD, STAKE_AMOUNT);

      expect(await earned(userA)).to.eq(utils.parseEther('50'));
      expect(await earned(userB)).to.eq(utils.parseEther('50'));
      expect(await earned(userC)).to.eq(utils.parseEther('20'));
      expect(await earned(userD)).to.eq(utils.parseEther('0'));
      expect(await earned(userE)).to.eq(utils.parseEther('0'));

      await setTimestampTo(9);

      expect(await earned(userA)).to.eq(utils.parseEther('53.75'));
      expect(await earned(userB)).to.eq(utils.parseEther('53.75'));
      expect(await earned(userC)).to.eq(utils.parseEther('23.75'));
      expect(await earned(userD)).to.eq(utils.parseEther('3.75'));
      expect(await earned(userE)).to.eq(utils.parseEther('0'));

      await setTimestampTo(10);

      expect(await earned(userA)).to.eq(utils.parseEther('57.5'));
      expect(await earned(userB)).to.eq(utils.parseEther('57.5'));
      expect(await earned(userC)).to.eq(utils.parseEther('27.5'));
      expect(await earned(userD)).to.eq(utils.parseEther('7.5'));
      expect(await earned(userE)).to.eq(utils.parseEther('0'));

      await setTimestampTo(13);

      await stake(userE, STAKE_AMOUNT);

      expect(await earned(userA)).to.eq(utils.parseEther('68.75'));
      expect(await earned(userB)).to.eq(utils.parseEther('68.75'));
      expect(await earned(userC)).to.eq(utils.parseEther('38.75'));
      expect(await earned(userD)).to.eq(utils.parseEther('18.75'));
      expect(await earned(userE)).to.eq(utils.parseEther('0'));

      await passportCampaignAdmin.setTokensClaimable(true);

      await setTimestampTo(16);

      expect(await earned(userA)).to.eq(utils.parseEther('77.75'));
      expect(await earned(userB)).to.eq(utils.parseEther('77.75'));
      expect(await earned(userC)).to.eq(utils.parseEther('47.75'));
      expect(await earned(userD)).to.eq(utils.parseEther('27.75'));
      expect(await earned(userE)).to.eq(utils.parseEther('9'));

      await setTimestampTo(17);

      await withdraw(userC);

      await setTimestampTo(19);

      expect(await earned(userA)).to.eq(utils.parseEther('88.25'));
      expect(await earned(userB)).to.eq(utils.parseEther('88.25'));
      expect(await earned(userC)).to.eq(utils.parseEther('50.75'));
      expect(await earned(userD)).to.eq(utils.parseEther('38.25'));
      expect(await earned(userE)).to.eq(utils.parseEther('19.5'));

      await setTimestampTo(20);

      await exitCampaign(userA);
      await exitCampaign(userB);
      await claimReward(userC);
      await exitCampaign(userD);
      await exitCampaign(userE);

      expect(await rewardBalanceOf(userA)).to.be.eq(utils.parseEther('55.2'));
      expect(await rewardBalanceOf(userB)).to.be.eq(utils.parseEther('55.2'));
      expect(await rewardBalanceOf(userC)).to.be.eq(utils.parseEther('30.45'));
      expect(await rewardBalanceOf(userD)).to.be.eq(utils.parseEther('25.2'));
      expect(await rewardBalanceOf(userE)).to.be.eq(utils.parseEther('13.95'));
    });

    it('should distribute rewards correctly for 2 users', async () => {
      await passportCampaignAdmin.setRewardsDuration(20);
      await passportCampaignAdmin.setCurrentTimestamp(0);

      const users = await ethers.getSigners();

      const userA = users[1];
      const userB = users[2];

      await stake(userA, STAKE_AMOUNT);

      await rewardToken.mintShare(
        passportCampaignAdmin.address,
        utils.parseEther('200'),
      );

      await passportCampaignAdmin.notifyRewardAmount(utils.parseEther('300')); // 0

      expect(await earned(userA)).to.eq(utils.parseEther('0'));
      expect(await earned(userB)).to.eq(utils.parseEther('0'));

      await setTimestampTo(1);

      expect(await earned(userA)).to.eq(utils.parseEther('15'));
      expect(await earned(userB)).to.eq(utils.parseEther('0'));

      await setTimestampTo(10);

      await stake(userB, STAKE_AMOUNT);

      expect(await earned(userA)).to.eq(utils.parseEther('150'));
      expect(await earned(userB)).to.eq(utils.parseEther('0'));

      await setTimestampTo(11);

      expect(await earned(userA)).to.eq(utils.parseEther('157.5'));
      expect(await earned(userB)).to.eq(utils.parseEther('7.5'));

      await setTimestampTo(20);

      expect(await earned(userA)).to.eq(utils.parseEther('225'));
      expect(await earned(userB)).to.eq(utils.parseEther('75'));
    });

    it('should distribute rewards to 3 users correctly', async () => {
      await passportCampaignAdmin.setRewardsDuration(20);
      await passportCampaignAdmin.setCurrentTimestamp(0);

      const users = await ethers.getSigners();

      const userA = users[1];
      const userB = users[2];
      const userC = users[3];

      await stake(userA, STAKE_AMOUNT);

      await passportCampaignAdmin.notifyRewardAmount(utils.parseEther('100')); // 0

      expect(await earned(userA)).to.eq(utils.parseEther('0'));
      expect(await earned(userB)).to.eq(utils.parseEther('0'));
      expect(await earned(userC)).to.eq(utils.parseEther('0'));

      await passportCampaignAdmin.setCurrentTimestamp(1);

      expect(await earned(userA)).to.eq(utils.parseEther('5'));
      expect(await earned(userB)).to.eq(utils.parseEther('0'));
      expect(await earned(userC)).to.eq(utils.parseEther('0'));

      await passportCampaignAdmin.setCurrentTimestamp(3);

      await stake(userB, STAKE_AMOUNT);

      expect(await earned(userA)).to.eq(utils.parseEther('15'));
      expect(await earned(userB)).to.eq(utils.parseEther('0'));
      expect(await earned(userC)).to.eq(utils.parseEther('0'));

      await passportCampaignAdmin.setCurrentTimestamp(8);

      await stake(userC, STAKE_AMOUNT.mul(2));

      expect(await earned(userA)).to.eq(utils.parseEther('27.5'));
      expect(await earned(userB)).to.eq(utils.parseEther('12.5'));
      expect(await earned(userC)).to.eq(utils.parseEther('0'));

      await passportCampaignAdmin.setCurrentTimestamp(10);

      expect(await earned(userA)).to.eq(utils.parseEther('30'));
      expect(await earned(userB)).to.eq(utils.parseEther('15'));
      expect(await earned(userC)).to.eq(utils.parseEther('5'));

      await passportCampaignAdmin.setCurrentTimestamp(13);

      await passportCampaignAdmin.setTokensClaimable(true);

      await exitCampaign(userB);
      await withdraw(userC, STAKE_AMOUNT);

      await passportCampaignAdmin.setCurrentTimestamp(20);

      expect(await earned(userA)).to.eq(utils.parseEther('51.25'));

      expect(await earned(userB)).to.eq(utils.parseEther('18.75'));
      expect(
        (await passportCampaignAdmin.stakers(userB.address)).rewardsReleased,
      ).to.eq(utils.parseEther('18.75'));

      expect(await earned(userC)).to.eq(utils.parseEther('30'));
    });

    it('should distribute rewards correctly if new rewards are notified before the end of the period', async () => {
      await passportCampaignAdmin.setRewardsDuration(10);
      await setTimestampTo(0);

      await passportCampaignAdmin.notifyRewardAmount(utils.parseEther('100'));

      await setTimestampTo(1);

      await stake(user1, STAKE_AMOUNT);

      await setTimestampTo(2);

      expect(await earned(user1)).to.eq(utils.parseEther('10'));

      await setTimestampTo(3);

      await stake(user2, STAKE_AMOUNT);

      await setTimestampTo(4);

      expect(await earned(user1)).to.eq(utils.parseEther('25'));
      expect(await earned(user2)).to.eq(utils.parseEther('5'));

      await rewardToken.mintShare(
        passportCampaignAdmin.address,
        utils.parseEther('100'),
      );
      await passportCampaignAdmin.notifyRewardAmount(utils.parseEther('100'));

      // New rewards: 60 + 100 = 160 distributed over 10 epochs

      await setTimestampTo(5);

      expect(await earned(user1)).to.eq(utils.parseEther('33'));
      expect(await earned(user2)).to.eq(utils.parseEther('13'));

      await withdraw(user1, STAKE_AMOUNT);

      await setTimestampTo(6);

      expect(await earned(user1)).to.eq(utils.parseEther('33'));
      expect(await earned(user2)).to.eq(utils.parseEther('29'));

      await passportCampaignAdmin.setTokensClaimable(true);

      await passportCampaignUser1.getReward(user1.address);

      expect(await rewardToken.balanceOf(user1.address)).to.eq(
        utils.parseEther('19.8'),
      );

      await setTimestampTo(7);

      expect(await earned(user2)).to.eq(utils.parseEther('45'));

      await passportCampaignUser1.getReward(user2.address);

      expect(await rewardToken.balanceOf(user2.address)).to.eq(
        utils.parseEther('27'),
      );
    });

    it(
      'should allow user to stake, then credit score threshold is lowered and user should not be able to stake more',
    );
  });
});
