import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
  LiquidityCampaign,
  LiquidityCampaignFactory,
  TestToken,
  TestTokenFactory,
} from '@src/typings';
import { time } from '@openzeppelin/test-helpers';
import ArcNumber from '@src/utils/ArcNumber';
import { ethers } from 'hardhat';
import { deployTestToken } from '../contracts/deployers';
import ArcDecimal from '@src/utils/ArcDecimal';
import { BigNumber } from 'ethers';
import { expect } from 'chai';
import { BASE } from '@src/constants';
import { expectRevert } from '@test/helpers/expectRevert';

let liquidityCampaignAdmin: LiquidityCampaign;
let liquidityCampaignUser1: LiquidityCampaign;
let liquidityCampaignUser2: LiquidityCampaign;

const REWARD_AMOUNT = ArcNumber.new(100);
const STAKE_AMOUNT = ArcNumber.new(10);
const REWARD_DURATION_MINUTES = 10;

let stakingToken: TestToken;
let rewardToken: TestToken;
let otherErc20: TestToken;

let admin: SignerWithAddress;
let user1: SignerWithAddress;
let user2: SignerWithAddress;

describe('LiquidityCampaign', () => {
  const DAO_ALLOCATION = ArcDecimal.new(0.4);
  const USER_ALLOCATION = ArcNumber.new(1).sub(DAO_ALLOCATION.value);

  function bnToEthNumberRounded(amount: BigNumber) {
    return Math.round(parseFloat(ethers.utils.formatEther(amount)));
  }

  async function stake(contract: LiquidityCampaign, user: SignerWithAddress, amount: BigNumber) {
    await mintAndApprove(stakingToken, user, amount);
    await contract.stake(amount);
  }

  async function mintAndApprove(
    token: TestToken,
    tokenReceiver: SignerWithAddress,
    amount: BigNumber,
  ) {
    const tokenContract = TestTokenFactory.connect(token.address, tokenReceiver);
    await tokenContract.mintShare(tokenReceiver.address, amount);
    await tokenContract.approve(liquidityCampaignAdmin.address, amount);
  }

  async function getCurrentTimestamp() {
    const currentBlockNumber = await ethers.provider.getBlockNumber();
    const currentBlock = await ethers.provider.getBlock(currentBlockNumber);

    return BigNumber.from(currentBlock.timestamp);
  }

  async function setup() {
    if (!liquidityCampaignAdmin || !admin) {
      throw 'Liquidity campaign or admin cannot be null';
    }

    await liquidityCampaignAdmin.setRewardsDistributor(admin.address);

    const rewardsDuration = time.duration.minutes(REWARD_DURATION_MINUTES).toString();
    await liquidityCampaignAdmin.setRewardsDuration(rewardsDuration);

    await liquidityCampaignAdmin.init(
      admin.address,
      admin.address,
      rewardToken.address,
      stakingToken.address,
      DAO_ALLOCATION,
    );

    await liquidityCampaignAdmin.notifyRewardAmount(REWARD_AMOUNT);
  }

  before(async () => {
    const signers = await ethers.getSigners();
    admin = signers[0];
    user1 = signers[1];
    user2 = signers[2];
  });

  beforeEach(async () => {
    stakingToken = await deployTestToken(admin, '3Pool', 'CRV');
    rewardToken = await deployTestToken(admin, 'Arc Token', 'ARC');
    otherErc20 = await deployTestToken(admin, 'Another ERC20 token', 'AERC20');

    liquidityCampaignAdmin = await new LiquidityCampaignFactory(admin).deploy();

    const proxy = await new ArcProxyFactory(admin).deploy(
      liquidityCampaignAdmin.address,
      await admin.getAddress(),
      [],
    );

    liquidityCampaignAdmin = await new LiquidityCampaignFactory(admin).attach(proxy.address);
    liquidityCampaignUser1 = await new LiquidityCampaignFactory(user1).attach(proxy.address);
    liquidityCampaignUser2 = await new LiquidityCampaignFactory(user2).attach(proxy.address);

    await rewardToken.mintShare(liquidityCampaignAdmin.address, REWARD_AMOUNT);
  });

  describe('View functions', () => {
    describe('#lastTimeRewardApplicable', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should return the block timestamp if called before the reward period finished', async () => {
        const currentTime = await getCurrentTimestamp();

        expect(await liquidityCampaignAdmin.lastTimeRewardApplicable()).to.eq(currentTime);
      });

      it('should return the period finish if called after reward period has finished', async () => {
        await time.increase(time.duration.minutes(REWARD_DURATION_MINUTES));

        const periodFinish = await liquidityCampaignAdmin.periodFinish();
        expect(await liquidityCampaignAdmin.lastTimeRewardApplicable()).to.eq(periodFinish);
      });
    });

    describe('#balanceOfStaker', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should return the correct balance', async () => {
        const stakingAmount = ArcNumber.new(10);

        await stakingToken.mintShare(admin.address, stakingAmount);
        await stakingToken.approve(liquidityCampaignAdmin.address, stakingAmount);

        await liquidityCampaignAdmin.stake(stakingAmount);

        expect(await liquidityCampaignAdmin.balanceOfStaker(admin.address)).to.eq(stakingAmount);
      });
    });

    describe('#rewardPerToken', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should return the reward per token stored if the supply is 0', async () => {
        const rewardPerTokenStored = await liquidityCampaignAdmin.rewardPerTokenStored();

        expect(await liquidityCampaignAdmin.rewardPerToken()).to.eq(rewardPerTokenStored);
      });

      it('should return a valid reward per token after someone staked', async () => {
        const stakingAmount = ArcNumber.new(10);
        await mintAndApprove(stakingToken, user1, stakingAmount);

        await liquidityCampaignUser1.stake(stakingAmount.div(2));
        await liquidityCampaignUser1.stake(stakingAmount.div(2));
        await time.advanceBlock();

        const rewardPerToken = await liquidityCampaignUser1.rewardPerToken();
        const rewardPerTokenStored = await liquidityCampaignAdmin.rewardPerTokenStored();

        // const currentRewardRate = (await liquidityCampaignUser1.lastTimeRewardApplicable())
        //   .sub(await liquidityCampaignUser1.lastUpdateTime())
        //   .mul(await liquidityCampaignUser1.rewardRate())
        //   .mul(BASE)
        //   .div(await liquidityCampaignUser1.totalSupply());

        // console.log({
        //   totalSupply: await(await liquidityCampaignUser1.totalSupply()).toString(),
        //   rewardPerTokenStored: rewardPerTokenStored.toString(),
        //   rewardPerToken: rewardPerToken.toString(),
        //   daoAllocation: await(await liquidityCampaignUser1.daoAllocation()).toString(),
        //   userAllocation: await(await liquidityCampaignUser1.userAllocation()).toString(),
        //   lastUpdateTime: await(await liquidityCampaignUser1.lastUpdateTime()).toString(),
        //   rewardRate: await(await liquidityCampaignUser1.rewardRate()).toString(),
        //   currentRewardRate: currentRewardRate.toString(),
        //   lastTimeRewardApplicable: await(
        //     await liquidityCampaignUser1.lastTimeRewardApplicable(),
        //   ).toString(),
        // });

        expect(rewardPerToken).to.be.gt(BigNumber.from(0));
        expect(rewardPerToken).to.not.eq(rewardPerTokenStored);
      });
    });

    describe('#userAllocation', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should return the correct user allocation', async () => {
        const userAllocation = await liquidityCampaignUser1.userAllocation();

        expect(userAllocation.value).to.eq(BASE.sub(DAO_ALLOCATION.value));
      });
    });

    describe('#earned', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should return the correct amount earned over time', async () => {
        await stake(liquidityCampaignUser1, user1, ArcNumber.new(10));
        // Check amount earned (should be 0)
        const amountEarned0 = await liquidityCampaignUser1.earned(user1.address);
        expect(amountEarned0).to.eq(BigNumber.from(0));

        // Advance time
        await time.increase(time.duration.minutes(1));
        // Check amount earned
        const amountEarned1 = await liquidityCampaignUser1.earned(user1.address);

        expect(amountEarned1).to.be.gt(amountEarned0);
      });

      it('should return the correct amount earned over time while another user stakes in between', async () => {
        const amount = ArcNumber.new(10);
        // User A stakes
        await stake(liquidityCampaignUser1, user1, amount);
        // Advance time half the period
        await time.increase(time.duration.minutes(REWARD_DURATION_MINUTES / 2));

        // User B stakes
        await stake(liquidityCampaignUser2, user2, amount);

        // Advance time to the end of the period
        await time.increase(time.duration.minutes(REWARD_DURATION_MINUTES / 2));

        // Check amount earned
        const user1Earned = await liquidityCampaignUser1.earned(user1.address);
        const user2Earned = await liquidityCampaignUser2.earned(user2.address);

        expect(Math.round(parseFloat(ethers.utils.formatEther(user1Earned)))).to.eq(45);
        expect(Math.round(parseFloat(ethers.utils.formatEther(user2Earned)))).to.eq(15);

        // console.log({
        //   user1: ethers.utils.formatEther(user1Earned),
        //   user2: ethers.utils.formatEther(user2Earned),
        //   reward: ethers.utils.formatEther(REWARD_AMOUNT),
        //   daoAllocation: ethers.utils.formatEther(daoAllocation),
        // });
      });
    });

    describe('#getRewardForDuration', () => {
      beforeEach(async () => {
        await setup();
      });

      it('returns the correct reward for duration', async () => {
        const rewardForDuration = await liquidityCampaignAdmin.getRewardForDuration();

        expect(Math.round(parseFloat(ethers.utils.formatEther(rewardForDuration)))).to.eq(
          parseFloat(ethers.utils.formatEther(REWARD_AMOUNT)),
        );
      });
    });
  });

  describe('Mutative functions', () => {
    describe('#stake', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should not be able to stake more than balance', async () => {
        await mintAndApprove(stakingToken, user1, ArcNumber.new(10));

        const balance = await stakingToken.balanceOf(user1.address);

        await expectRevert(liquidityCampaignUser1.stake(balance.add(1)));
      });

      it('should be able to stake', async () => {
        const amount = ArcNumber.new(10);
        await mintAndApprove(stakingToken, user1, amount);

        await liquidityCampaignUser1.stake(amount);

        const supply = await liquidityCampaignUser1.totalSupply();

        expect(supply).to.eq(amount);
      });

      it('should update reward correctly after staking', async () => {
        const earned0 = await liquidityCampaignUser1.earned(user1.address);

        await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);

        await time.increase(time.duration.minutes(REWARD_DURATION_MINUTES / 2));

        const earned1 = await liquidityCampaignUser1.earned(user1.address);

        expect(earned0).to.not.be.eq(earned1);
      });
    });

    describe('#getReward', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should not be able to get the reward if the tokens are not claimable', async () => {
        await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);

        await time.increase(time.duration.minutes(REWARD_DURATION_MINUTES / 2));

        await expectRevert(liquidityCampaignUser1.getReward(user1.address));
      });

      it('should be able to claim rewards gradually over time', async () => {
        await liquidityCampaignAdmin.setTokensClaimable(true);

        await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);
        await time.increase(time.duration.minutes(REWARD_DURATION_MINUTES / 3));

        await liquidityCampaignUser1.getReward(user1.address);
        const reward0 = await rewardToken.balanceOf(user1.address);

        await time.increase(time.duration.minutes(REWARD_DURATION_MINUTES / 3));

        await liquidityCampaignUser1.getReward(user1.address);
        const reward1 = await rewardToken.balanceOf(user1.address);

        expect(reward0).to.be.lt(reward1);
      });

      it('should be able to claim the right amount of rewards given the number of participants', async () => {
        await liquidityCampaignAdmin.setTokensClaimable(true);

        await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);
        await time.increase(time.duration.minutes(REWARD_DURATION_MINUTES / 2));

        await liquidityCampaignUser1.getReward(user1.address);
        let reward0 = await rewardToken.balanceOf(user1.address);

        expect(bnToEthNumberRounded(reward0)).to.eq(
          bnToEthNumberRounded(REWARD_AMOUNT.div(2).mul(USER_ALLOCATION).div(BASE)),
        );

        await stake(liquidityCampaignUser2, user2, STAKE_AMOUNT);
        await time.increase(time.duration.minutes(REWARD_DURATION_MINUTES / 2));

        await liquidityCampaignUser1.getReward(user1.address);
        const reward1 = await rewardToken.balanceOf(user1.address);

        expect(bnToEthNumberRounded(reward1)).to.eq(
          bnToEthNumberRounded(reward0.add(REWARD_AMOUNT.div(4).mul(USER_ALLOCATION).div(BASE))),
        );
      });

      it('should update reward after claiming reward', async () => {
        await liquidityCampaignAdmin.setTokensClaimable(true);

        await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);

        const rewardPerTokenStored0 = await liquidityCampaignUser1.rewardPerTokenStored();

        await time.increase(time.duration.minutes(REWARD_DURATION_MINUTES / 2));

        await liquidityCampaignUser1.getReward(user1.address);

        const rewardPerTokenStored1 = await liquidityCampaignUser1.rewardPerTokenStored();

        expect(rewardPerTokenStored0).to.be.lt(rewardPerTokenStored1);
      });
    });

    describe('#withdraw', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should not be able to withdraw more than the balance', async () => {
        await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);

        await expectRevert(liquidityCampaignUser1.withdraw(STAKE_AMOUNT.add(1)));
      });

      it('should withdraw the correct amount', async () => {
        await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);

        await liquidityCampaignUser1.withdraw(STAKE_AMOUNT);

        const balance = await stakingToken.balanceOf(user1.address);

        expect(balance).to.eq(STAKE_AMOUNT);
      });

      it('should update reward correctly after withdrawing', async () => {
        await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);

        const rewardPerTokenStored0 = await liquidityCampaignUser1.rewardPerTokenStored();

        await liquidityCampaignUser1.withdraw(STAKE_AMOUNT);

        const rewardPerTokenStored1 = await liquidityCampaignUser1.rewardPerTokenStored();

        expect(rewardPerTokenStored0).to.not.eq(rewardPerTokenStored1);
      });
    });

    describe('#exit', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should be able to exit and get the right amount of staked tokens and rewards', async () => {
        await liquidityCampaignAdmin.setTokensClaimable(true);

        await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);

        await time.increase(time.duration.minutes(REWARD_DURATION_MINUTES / 2));

        await liquidityCampaignUser1.exit();

        const stakingBalance = await stakingToken.balanceOf(user1.address);
        const rewardBalance = await rewardToken.balanceOf(user1.address);

        expect(stakingBalance).to.eq(STAKE_AMOUNT);
        expect(bnToEthNumberRounded(rewardBalance)).to.eq(
          bnToEthNumberRounded(REWARD_AMOUNT.div(2).mul(USER_ALLOCATION).div(BASE)),
        );
      });
    });
  });

  describe('Admin functions', () => {
    describe('#init', () => {
      it('should not be callable by anyone', async () => {
        await expectRevert(
          liquidityCampaignUser1.init(
            user1.address,
            user1.address,
            rewardToken.address,
            stakingToken.address,
            DAO_ALLOCATION,
          ),
        );
      });

      it('should only be callable by the contract owner', async () => {
        await liquidityCampaignAdmin.init(
          admin.address,
          admin.address,
          rewardToken.address,
          stakingToken.address,
          DAO_ALLOCATION,
        );

        const arcDao = await liquidityCampaignAdmin.arcDAO();
        const rewardsDistributor = await liquidityCampaignAdmin.rewardsDistributor();
        const rewardsToken = await liquidityCampaignAdmin.rewardsToken();
        const stakingTokenAddress = await liquidityCampaignAdmin.stakingToken();
        const daoAllocation = await liquidityCampaignAdmin.daoAllocation();

        expect(arcDao).to.eq(admin.address);
        expect(rewardsDistributor).to.eq(admin.address);
        expect(rewardsToken).to.eq(rewardToken.address);
        expect(stakingTokenAddress).to.eq(stakingToken.address);
        expect(daoAllocation).to.eq(DAO_ALLOCATION.value);
      });
    });

    describe('#notifyRewardAmount', () => {
      it('should not be callable by anyone', async () => {
        await expectRevert(liquidityCampaignUser1.notifyRewardAmount(REWARD_AMOUNT));
      });

      it('should only be callable by the rewards distributor', async () => {
        await liquidityCampaignAdmin.init(
          admin.address,
          admin.address,
          rewardToken.address,
          stakingToken.address,
          DAO_ALLOCATION,
        );

        const rewardRate0 = await liquidityCampaignAdmin.rewardRate();

        const rewardsDuration = time.duration.minutes(REWARD_DURATION_MINUTES).toString();
        await liquidityCampaignAdmin.setRewardsDuration(rewardsDuration);

        await liquidityCampaignAdmin.notifyRewardAmount(REWARD_AMOUNT.div(2));

        const rewardrate1 = await liquidityCampaignAdmin.rewardRate();

        expect(rewardRate0).to.be.lt(rewardrate1);
      });

      it('should update rewards correctly after a new reward update', async () => {
        await liquidityCampaignAdmin.init(
          admin.address,
          admin.address,
          rewardToken.address,
          stakingToken.address,
          DAO_ALLOCATION,
        );

        const rewardsDuration = time.duration.minutes(REWARD_DURATION_MINUTES).toString();
        await liquidityCampaignAdmin.setRewardsDuration(rewardsDuration);

        await liquidityCampaignAdmin.notifyRewardAmount(REWARD_AMOUNT.div(2));
        const rewardRate0 = await liquidityCampaignAdmin.rewardRate();

        await liquidityCampaignAdmin.notifyRewardAmount(REWARD_AMOUNT.div(2));

        const rewardrate1 = await liquidityCampaignAdmin.rewardRate();

        expect(rewardRate0).to.be.lt(rewardrate1);
      });
    });

    describe('#setRewardsDistributor', () => {
      it('should not be callable by non-admin', async () => {
        await expectRevert(liquidityCampaignUser1.setRewardsDistributor(user1.address));
      });

      it('should set rewardsDistributor if called by admin', async () => {
        await liquidityCampaignAdmin.setRewardsDistributor(user2.address);

        expect(await liquidityCampaignAdmin.rewardsDistributor()).to.eq(user2.address);
      });
    });

    describe('#setRewardsDuration', () => {
      it('should not be claimable by anyone', async () => {
        await expectRevert(
          liquidityCampaignUser1.setRewardsDuration(
            BigNumber.from(time.duration.minutes(REWARD_DURATION_MINUTES)),
          ),
        );
      });

      it('should only be callable by the contract owner and set the right duration', async () => {
        const duration = BigNumber.from(time.duration.minutes(REWARD_DURATION_MINUTES));

        await liquidityCampaignAdmin.setRewardsDuration(duration);

        expect(await liquidityCampaignAdmin.rewardsDuration()).to.eq(duration);
      });
    });

    describe('#recoverERC20', () => {
      const erc20Share = ArcNumber.new(10);

      beforeEach(async () => {
        await otherErc20.mintShare(liquidityCampaignAdmin.address, erc20Share);
      });

      it('should not be callable by anyone', async () => {
        await expectRevert(liquidityCampaignUser1.recoverERC20(otherErc20.address, erc20Share));
      });

      it('should not recover staking or reward token', async () => {
        await setup();
        await stakingToken.mintShare(liquidityCampaignAdmin.address, erc20Share);
        await rewardToken.mintShare(liquidityCampaignAdmin.address, erc20Share);

        await expectRevert(liquidityCampaignAdmin.recoverERC20(stakingToken.address, erc20Share));
        await expectRevert(liquidityCampaignAdmin.recoverERC20(rewardToken.address, erc20Share));
      });

      it('should let admin recover the erc20 on this contract', async () => {
        const balance0 = await otherErc20.balanceOf(admin.address);

        await liquidityCampaignAdmin.recoverERC20(otherErc20.address, erc20Share);

        const balance1 = await otherErc20.balanceOf(admin.address);

        expect(balance1).to.eq(balance0.add(erc20Share));
      });
    });

    describe('#setTokensClaimable', () => {
      it('should not be claimable by anyone', async () => {
        await expectRevert(liquidityCampaignUser1.setTokensClaimable(true));
      });

      it('should only be callable by the contract owner', async () => {
        await liquidityCampaignAdmin.setTokensClaimable(true);

        expect(await liquidityCampaignAdmin.tokensClaimable()).to.be.eq(true);
      });
    });
  });
});
