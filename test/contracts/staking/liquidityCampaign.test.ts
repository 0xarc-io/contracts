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
import { deployTestToken } from '../deployers';
import ArcDecimal from '@src/utils/ArcDecimal';
import { BigNumber } from 'ethers';
import { expect } from 'chai';
import { BASE } from '@src/constants';

let liquidityCampaignAdmin: LiquidityCampaign;
let liquidityCampaignUser1: LiquidityCampaign;
let liquidityCampaignUser2: LiquidityCampaign;

const REWARD_AMOUNT = ArcNumber.new(100);
const REWARD_DURATION_MINUTES = 10;

let stakingToken: TestToken;
let rewardToken: TestToken;

let admin: SignerWithAddress;
let user1: SignerWithAddress;
let user2: SignerWithAddress;

describe('LiquidityCampaign', () => {
  const DAO_ALLOCATION = ArcDecimal.new(0.4);

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
    describe.skip('#lastTimeRewardApplicable', () => {
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

    describe.skip('#balanceOfStaker', () => {
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

    describe.skip('#rewardPerToken', () => {
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

    describe.skip('#userAllocation', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should return the correct user allocation', async () => {
        const userAllocation = await liquidityCampaignUser1.userAllocation();

        expect(userAllocation.value).to.eq(BASE.sub(DAO_ALLOCATION.value));
      });
    });

    describe('#earned', () => {
      xit('should return the correct amount earned over time', async () => {
        // Stake
        // Check amount earned (should be 0)
        // Advance time
        // Check amount earned
      });

      xit('should return the correct amount earned over time while another user stakes in between', async () => {
        // User A stakes
        // Check amount earned (should be 0)
        // Advance time
        // User B stakes
        // Advance time
        // Check amount earned
      });
    });

    describe('#getRewardForDuration', () => {
      xit('returns the correct reward for duration');
    });
  });

  describe('Mutative functions', () => {
    describe('#stake', () => {
      xit('should not be able to stake more than balance');

      xit('should be able to stake');

      xit('should update reward correctly after staking');
    });

    describe('#getReward', () => {
      xit('should not be able to get the reward if the tokens are not claimable');

      xit('should be able to claim rewards gradually over time');

      xit('should be able to claim the right amount of rewards given the number of participants');

      xit('should update reward correctly after staking');
    });

    describe('#withdraw', () => {
      xit('should not be able to withdraw more than the balance');

      xit('should withdraw the correct amount');

      xit('should update reward correctly after withdrawing');
    });

    describe('#exit', () => {
      xit('should be able to exit and get the right amount of staked tokens and rewards');
    });
  });

  describe('Admin functions', () => {
    describe('#init', () => {
      xit('should not be callable by anyone');

      xit('should only be callable by the contract owner');
    });

    describe('#notifyRewardAmount', () => {
      xit('should not be callable by anyone');

      xit('should only be callable by the rewards distributor');

      xit('should update rewards correctly after a new reward update');
    });

    describe('#setRewardsDistributor', () => {
      xit('should not be callable by non-admin');

      xit('should set rewardsDistributor if called by admin');
    });

    describe('#setRewardsDuration', () => {
      xit('should not be claimable by anyone');

      xit('should only be callable by the contract owner and set the right duration');
    });

    describe('#recoverERC20', () => {
      xit('should not be callable by anyone');

      xit('should not recover staking or reward token');

      xit('should let admin recover the erc20 on this contract');
    });

    describe('#setTokensClaimable', () => {
      xit('should not be claimable by anyone');

      xit('should only be callable by the contract owner');
    });
  });
});
