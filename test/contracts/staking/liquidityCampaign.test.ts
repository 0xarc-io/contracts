import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
  LiquidityCampaign,
  LiquidityCampaignFactory,
  MockLiquidityCampaign,
  MockLiquidityCampaignFactory,
  TestToken,
  TestTokenFactory,
} from '@src/typings';

import hre from 'hardhat';
import ArcNumber from '@src/utils/ArcNumber';
import { ethers } from 'hardhat';
import { deployTestToken } from '../deployers';
import ArcDecimal from '@src/utils/ArcDecimal';
import { BigNumber } from 'ethers';
import chai from 'chai';
import { BASE } from '@src/constants';
import { expectRevert } from '@test/helpers/expectRevert';
import { EVM } from '@test/helpers/EVM';
import { solidity } from 'ethereum-waffle';

chai.use(solidity);
const expect = chai.expect;

let liquidityCampaignAdmin: MockLiquidityCampaign;
let liquidityCampaignUser1: MockLiquidityCampaign;
let liquidityCampaignUser2: MockLiquidityCampaign;

const REWARD_AMOUNT = ArcNumber.new(100);
const STAKE_AMOUNT = ArcNumber.new(10);
const REWARD_DURATION = 10;

let stakingToken: TestToken;
let rewardToken: TestToken;
let otherErc20: TestToken;

let admin: SignerWithAddress;
let user1: SignerWithAddress;
let user2: SignerWithAddress;

let evm: EVM;

describe('LiquidityCampaign', () => {
  const DAO_ALLOCATION = ArcDecimal.new(0.4);
  const USER_ALLOCATION = ArcNumber.new(1).sub(DAO_ALLOCATION.value);

  async function increaseTime(duration: number) {
    await evm.increaseTime(duration);
    await evm.mineBlock();
  }

  async function setTimestampTo(timestamp: number) {
    await liquidityCampaignAdmin.setCurrentTimestamp(timestamp);
  }

  async function stake(user: SignerWithAddress, amount: BigNumber) {
    await mintAndApprove(stakingToken, user, amount);

    const timestampAtStake = await getCurrentTimestamp();
    const contract = LiquidityCampaignFactory.connect(liquidityCampaignAdmin.address, user);
    await contract.stake(amount);

    return timestampAtStake;
  }

  // async function logTimeDiff(timeReference: BigNumber, prefix?: string) {
  //   console.log(
  //     `${prefix ? prefix + ' ' : ''}t${(await getCurrentTimestamp())
  //       .sub(timeReference)
  //       .toString()}`,
  //   );
  // }

  async function mintAndApprove(
    token: TestToken,
    tokenReceiver: SignerWithAddress,
    amount: BigNumber,
  ) {
    const tokenContract = TestTokenFactory.connect(token.address, tokenReceiver);
    await tokenContract.mintShare(tokenReceiver.address, amount);
    await tokenContract.approve(liquidityCampaignAdmin.address, amount);
  }

  async function withdraw(user: SignerWithAddress, amount?: BigNumber) {
    const contract = LiquidityCampaignFactory.connect(liquidityCampaignAdmin.address, user);

    await contract.withdraw(amount ?? STAKE_AMOUNT);
  }

  async function exitCampaign(user: SignerWithAddress) {
    const contract = LiquidityCampaignFactory.connect(liquidityCampaignAdmin.address, user);

    await contract.exit();
  }

  async function claimReward(user: SignerWithAddress) {
    const contract = LiquidityCampaignFactory.connect(liquidityCampaignAdmin.address, user);

    await contract.getReward(user.address);
  }

  async function rewardBalanceOf(user: SignerWithAddress) {
    return await rewardToken.balanceOf(user.address);
  }

  async function earned(user: SignerWithAddress) {
    return await liquidityCampaignAdmin.actualEarned(user.address);
  }

  async function getCurrentTimestamp() {
    return liquidityCampaignAdmin.getCurrentTimestamp();
  }

  async function setup() {
    if (!liquidityCampaignAdmin || !admin) {
      throw 'Liquidity campaign or admin cannot be null';
    }

    await liquidityCampaignAdmin.setRewardsDistributor(admin.address);

    await liquidityCampaignAdmin.setRewardsDuration(REWARD_DURATION);

    await liquidityCampaignAdmin.init(
      admin.address,
      admin.address,
      rewardToken.address,
      stakingToken.address,
      DAO_ALLOCATION,
    );

    await liquidityCampaignAdmin.notifyRewardAmount(REWARD_AMOUNT);
    await setTimestampTo(0);
  }

  before(async () => {
    const signers = await ethers.getSigners();
    evm = new EVM(hre.ethers.provider);
    admin = signers[0];
    user1 = signers[1];
    user2 = signers[2];
  });

  beforeEach(async () => {
    stakingToken = await deployTestToken(admin, '3Pool', 'CRV');
    rewardToken = await deployTestToken(admin, 'Arc Token', 'ARC');
    otherErc20 = await deployTestToken(admin, 'Another ERC20 token', 'AERC20');

    liquidityCampaignAdmin = await new MockLiquidityCampaignFactory(admin).deploy();

    const proxy = await new ArcProxyFactory(admin).deploy(
      liquidityCampaignAdmin.address,
      await admin.getAddress(),
      [],
    );

    liquidityCampaignAdmin = await new MockLiquidityCampaignFactory(admin).attach(proxy.address);
    liquidityCampaignUser1 = await new MockLiquidityCampaignFactory(user1).attach(proxy.address);
    liquidityCampaignUser2 = await new MockLiquidityCampaignFactory(user2).attach(proxy.address);

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
        await setTimestampTo(REWARD_DURATION);

        const periodFinish = await liquidityCampaignAdmin.periodFinish();
        expect(await liquidityCampaignAdmin.lastTimeRewardApplicable()).to.eq(periodFinish);
      });
    });

    describe('#balanceOf', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should return the correct balance', async () => {
        const stakingAmount = ArcNumber.new(10);

        await stakingToken.mintShare(admin.address, stakingAmount);
        await stakingToken.approve(liquidityCampaignAdmin.address, stakingAmount);

        await liquidityCampaignAdmin.stake(stakingAmount);

        expect(await liquidityCampaignAdmin.balanceOf(admin.address)).to.eq(stakingAmount);
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

        await setTimestampTo(1);

        const rewardPerToken = await liquidityCampaignUser1.rewardPerToken();
        const rewardPerTokenStored = await liquidityCampaignAdmin.rewardPerTokenStored();

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
        await stake(user1, STAKE_AMOUNT);
        // Check amount earned (should be 0)
        const amountEarned0 = await liquidityCampaignUser1.earned(user1.address);
        expect(amountEarned0).to.eq(BigNumber.from(0));

        // Advance time
        await setTimestampTo(1);

        expect(await earned(user1)).to.eq(ArcNumber.new(10));

        await setTimestampTo(2);

        expect(await earned(user1)).to.eq(ArcNumber.new(20));
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
        expect(await earned(user1)).to.eq(ArcNumber.new(15));
        expect(await earned(user2)).to.eq(ArcNumber.new(5));
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
        await mintAndApprove(stakingToken, user1, amount.mul(2));

        await liquidityCampaignUser1.stake(amount);

        let supply = await liquidityCampaignUser1.totalSupply();

        expect(supply).to.eq(amount);

        await liquidityCampaignUser1.stake(amount);

        supply = await liquidityCampaignUser1.totalSupply();

        expect(supply).to.eq(amount.mul(2));
        expect(await stakingToken.balanceOf(liquidityCampaignAdmin.address)).to.eq(amount.mul(2));
      });

      it('should update reward correctly after staking', async () => {
        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        let earned = await liquidityCampaignUser1.earned(user1.address);

        expect(earned).to.eq(ArcNumber.new(6));

        await setTimestampTo(2);

        earned = await liquidityCampaignUser1.earned(user1.address);

        expect(earned).to.eq(ArcNumber.new(12));
      });
    });

    describe('#getReward', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should not be able to get the reward if the tokens are not claimable', async () => {
        await stake(user1, STAKE_AMOUNT);

        await increaseTime(REWARD_DURATION / 2);

        await expectRevert(liquidityCampaignUser1.getReward(user1.address));
      });

      it('should be able to claim rewards gradually over time', async () => {
        await liquidityCampaignAdmin.setTokensClaimable(true);

        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        const currentBalance = await rewardToken.balanceOf(user1.address);

        await liquidityCampaignUser1.getReward(user1.address);

        expect(await rewardToken.balanceOf(user1.address)).to.eq(ArcNumber.new(6));

        await setTimestampTo(2);

        await liquidityCampaignUser1.getReward(user1.address);

        expect(await rewardToken.balanceOf(user1.address)).to.eq(ArcNumber.new(12));
      });

      it('should be able to claim the right amount of rewards given the number of participants', async () => {
        await liquidityCampaignAdmin.setTokensClaimable(true);
        const initialBalance = await rewardToken.balanceOf(user1.address);

        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        await liquidityCampaignUser1.getReward(user1.address);

        expect(await rewardToken.balanceOf(user1.address)).to.eq(ArcNumber.new(6));

        await stake(user2, STAKE_AMOUNT);

        await setTimestampTo(2);

        await liquidityCampaignUser1.getReward(user1.address);
        await liquidityCampaignUser2.getReward(user2.address);

        expect(await rewardToken.balanceOf(user1.address)).to.eq(ArcNumber.new(9));
        expect(await rewardToken.balanceOf(user2.address)).to.eq(ArcNumber.new(3));
      });
    });

    describe('#withdraw', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should not be able to withdraw more than the balance', async () => {
        await stake(user1, STAKE_AMOUNT);

        await expectRevert(liquidityCampaignUser1.withdraw(STAKE_AMOUNT.add(1)));
      });

      it('should withdraw the correct amount', async () => {
        await stake(user1, STAKE_AMOUNT);

        await liquidityCampaignUser1.withdraw(STAKE_AMOUNT);

        const balance = await stakingToken.balanceOf(user1.address);

        expect(balance).to.eq(STAKE_AMOUNT);
      });
    });

    describe('#exit', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should be able to exit and get the right amount of staked tokens and rewards', async () => {
        await liquidityCampaignAdmin.setTokensClaimable(true);

        await stake(user1, STAKE_AMOUNT);

        await setTimestampTo(1);

        await liquidityCampaignUser1.exit();

        const stakingBalance = await stakingToken.balanceOf(user1.address);
        const rewardBalance = await rewardToken.balanceOf(user1.address);

        expect(stakingBalance).to.eq(STAKE_AMOUNT);
        expect(rewardBalance).to.eq(ArcNumber.new(6));
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

        await liquidityCampaignAdmin.setRewardsDuration(REWARD_DURATION);

        await liquidityCampaignAdmin.notifyRewardAmount(REWARD_AMOUNT);

        const rewardrate = await liquidityCampaignAdmin.rewardRate();

        expect(rewardrate).to.be.eq(ArcNumber.new(10));
      });

      it('should update rewards correctly after a new reward update', async () => {
        await liquidityCampaignAdmin.init(
          admin.address,
          admin.address,
          rewardToken.address,
          stakingToken.address,
          DAO_ALLOCATION,
        );

        await liquidityCampaignAdmin.setRewardsDuration(REWARD_DURATION);

        await liquidityCampaignAdmin.notifyRewardAmount(REWARD_AMOUNT.div(2));

        const rewardRate0 = await liquidityCampaignAdmin.rewardRate();

        expect(rewardRate0).to.eq(ArcNumber.new(5));

        await setTimestampTo(1);

        await liquidityCampaignAdmin.notifyRewardAmount(REWARD_AMOUNT.div(2));

        const rewardrate1 = await liquidityCampaignAdmin.rewardRate();

        expect(rewardrate1).to.eq(ArcDecimal.new(9.5).value);
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
          liquidityCampaignUser1.setRewardsDuration(BigNumber.from(REWARD_DURATION)),
        );
      });

      it('should only be callable by the contract owner and set the right duration', async () => {
        const duration = BigNumber.from(REWARD_DURATION);

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

  describe('Scenarios', () => {
    beforeEach(async () => {
      await liquidityCampaignAdmin.setRewardsDistributor(admin.address);

      await liquidityCampaignAdmin.init(
        admin.address,
        admin.address,
        rewardToken.address,
        stakingToken.address,
        DAO_ALLOCATION,
      );
    });

    it('should not get any rewards if user stakes before the reward is notified', async () => {
      await liquidityCampaignAdmin.setRewardsDuration(REWARD_DURATION);
      await setTimestampTo(0);

      await stake(user1, STAKE_AMOUNT);

      await setTimestampTo(4);

      expect(await earned(user1)).to.eq(BigNumber.from(0));

      await liquidityCampaignAdmin.notifyRewardAmount(REWARD_AMOUNT);

      await setTimestampTo(6);

      expect(await earned(user1)).to.eq(ArcNumber.new(20));
    });

    it('should distribute rewards to users correctly', async () => {
      await liquidityCampaignAdmin.setRewardsDuration(20);
      await setTimestampTo(0);
      const users = await ethers.getSigners();

      const userA = users[1];
      const userB = users[2];
      const userC = users[3];
      const userD = users[4];
      const userE = users[5];

      await stake(userA, STAKE_AMOUNT);
      await stake(userB, STAKE_AMOUNT);

      await rewardToken.mintShare(liquidityCampaignAdmin.address, ArcNumber.new(200));

      await liquidityCampaignAdmin.notifyRewardAmount(ArcNumber.new(300)); // 0

      expect(await earned(userA)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userC)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userD)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userE)).to.eq(ArcDecimal.new(0).value);

      await setTimestampTo(1);

      expect(await earned(userA)).to.eq(ArcDecimal.new(7.5).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(7.5).value);
      expect(await earned(userC)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userD)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userE)).to.eq(ArcDecimal.new(0).value);

      await setTimestampTo(2);

      expect(await earned(userA)).to.eq(ArcDecimal.new(15).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(15).value);
      expect(await earned(userC)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userD)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userE)).to.eq(ArcDecimal.new(0).value);

      await setTimestampTo(4);

      await stake(userC, STAKE_AMOUNT);

      expect(await earned(userA)).to.eq(ArcDecimal.new(30).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(30).value);
      expect(await earned(userC)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userD)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userE)).to.eq(ArcDecimal.new(0).value);

      await setTimestampTo(5);

      expect(await earned(userA)).to.eq(ArcDecimal.new(35).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(35).value);
      expect(await earned(userC)).to.eq(ArcDecimal.new(5).value);
      expect(await earned(userD)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userE)).to.eq(ArcDecimal.new(0).value);

      await setTimestampTo(8);

      await stake(userD, STAKE_AMOUNT);

      expect(await earned(userA)).to.eq(ArcDecimal.new(50).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(50).value);
      expect(await earned(userC)).to.eq(ArcDecimal.new(20).value);
      expect(await earned(userD)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userE)).to.eq(ArcDecimal.new(0).value);

      await setTimestampTo(9);

      expect(await earned(userA)).to.eq(ArcDecimal.new(53.75).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(53.75).value);
      expect(await earned(userC)).to.eq(ArcDecimal.new(23.75).value);
      expect(await earned(userD)).to.eq(ArcDecimal.new(3.75).value);
      expect(await earned(userE)).to.eq(ArcDecimal.new(0).value);

      await setTimestampTo(10);

      expect(await earned(userA)).to.eq(ArcDecimal.new(57.5).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(57.5).value);
      expect(await earned(userC)).to.eq(ArcDecimal.new(27.5).value);
      expect(await earned(userD)).to.eq(ArcDecimal.new(7.5).value);
      expect(await earned(userE)).to.eq(ArcDecimal.new(0).value);

      await setTimestampTo(13);

      await stake(userE, STAKE_AMOUNT);

      expect(await earned(userA)).to.eq(ArcDecimal.new(68.75).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(68.75).value);
      expect(await earned(userC)).to.eq(ArcDecimal.new(38.75).value);
      expect(await earned(userD)).to.eq(ArcDecimal.new(18.75).value);
      expect(await earned(userE)).to.eq(ArcDecimal.new(0).value);

      await liquidityCampaignAdmin.setTokensClaimable(true);

      await setTimestampTo(16);

      expect(await earned(userA)).to.eq(ArcDecimal.new(77.75).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(77.75).value);
      expect(await earned(userC)).to.eq(ArcDecimal.new(47.75).value);
      expect(await earned(userD)).to.eq(ArcDecimal.new(27.75).value);
      expect(await earned(userE)).to.eq(ArcDecimal.new(9).value);

      await setTimestampTo(17);

      await withdraw(userC);

      await setTimestampTo(19);

      expect(await earned(userA)).to.eq(ArcDecimal.new(88.25).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(88.25).value);
      expect(await earned(userC)).to.eq(ArcDecimal.new(50.75).value);
      expect(await earned(userD)).to.eq(ArcDecimal.new(38.25).value);
      expect(await earned(userE)).to.eq(ArcDecimal.new(19.5).value);

      await setTimestampTo(20);

      await exitCampaign(userA);
      await exitCampaign(userB);
      await claimReward(userC);
      await exitCampaign(userD);
      await exitCampaign(userE);

      expect(await rewardBalanceOf(userA)).to.be.eq(ArcDecimal.new(55.2).value);
      expect(await rewardBalanceOf(userB)).to.be.eq(ArcDecimal.new(55.2).value);
      expect(await rewardBalanceOf(userC)).to.be.eq(ArcDecimal.new(30.45).value);
      expect(await rewardBalanceOf(userD)).to.be.eq(ArcDecimal.new(25.2).value);
      expect(await rewardBalanceOf(userE)).to.be.eq(ArcDecimal.new(13.95).value);
    });

    it('should distribute rewards correctly for 2 users', async () => {
      await liquidityCampaignAdmin.setRewardsDuration(20);
      await liquidityCampaignAdmin.setCurrentTimestamp(0);

      const users = await ethers.getSigners();

      const userA = users[1];
      const userB = users[2];

      await stake(userA, STAKE_AMOUNT);

      await rewardToken.mintShare(liquidityCampaignAdmin.address, ArcNumber.new(200));

      await liquidityCampaignAdmin.notifyRewardAmount(ArcNumber.new(300)); // 0

      expect(await earned(userA)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(0).value);

      await setTimestampTo(1);

      expect(await earned(userA)).to.eq(ArcDecimal.new(15).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(0).value);

      await setTimestampTo(10);

      await stake(userB, STAKE_AMOUNT);

      expect(await earned(userA)).to.eq(ArcDecimal.new(150).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(0).value);

      await setTimestampTo(11);

      expect(await earned(userA)).to.eq(ArcDecimal.new(157.5).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(7.5).value);

      await setTimestampTo(20);

      expect(await earned(userA)).to.eq(ArcDecimal.new(225).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(75).value);
    });

    it('should distribute rewards to 3 users correctly', async () => {
      await liquidityCampaignAdmin.setRewardsDuration(20);
      await liquidityCampaignAdmin.setCurrentTimestamp(0);

      const users = await ethers.getSigners();

      const userA = users[1];
      const userB = users[2];
      const userC = users[3];

      await stake(userA, STAKE_AMOUNT);

      await liquidityCampaignAdmin.notifyRewardAmount(ArcNumber.new(100)); // 0

      expect(await earned(userA)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userC)).to.eq(ArcDecimal.new(0).value);

      await liquidityCampaignAdmin.setCurrentTimestamp(1);

      expect(await earned(userA)).to.eq(ArcDecimal.new(5).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userC)).to.eq(ArcDecimal.new(0).value);

      await liquidityCampaignAdmin.setCurrentTimestamp(3);

      await stake(userB, STAKE_AMOUNT);

      expect(await earned(userA)).to.eq(ArcDecimal.new(15).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(0).value);
      expect(await earned(userC)).to.eq(ArcDecimal.new(0).value);

      await liquidityCampaignAdmin.setCurrentTimestamp(8);

      await stake(userC, STAKE_AMOUNT.mul(2));

      expect(await earned(userA)).to.eq(ArcDecimal.new(27.5).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(12.5).value);
      expect(await earned(userC)).to.eq(ArcDecimal.new(0).value);

      await liquidityCampaignAdmin.setCurrentTimestamp(10);

      expect(await earned(userA)).to.eq(ArcDecimal.new(30).value);
      expect(await earned(userB)).to.eq(ArcDecimal.new(15).value);
      expect(await earned(userC)).to.eq(ArcDecimal.new(5).value);

      await liquidityCampaignAdmin.setCurrentTimestamp(13);

      await liquidityCampaignAdmin.setTokensClaimable(true);

      await exitCampaign(userB);
      await withdraw(userC, STAKE_AMOUNT);

      await liquidityCampaignAdmin.setCurrentTimestamp(20);

      expect(await earned(userA)).to.eq(ArcDecimal.new(51.25).value);

      expect(await earned(userB)).to.eq(ArcDecimal.new(18.75).value);
      expect((await liquidityCampaignAdmin.stakers(userB.address)).rewardsReleased).to.eq(
        ArcDecimal.new(18.75).value,
      );

      expect(await earned(userC)).to.eq(ArcDecimal.new(30).value);
    });

    it('should distribute rewards correctly if new rewards are notified before the end of the period', async () => {
      await liquidityCampaignAdmin.setRewardsDuration(10);
      await setTimestampTo(0);

      await liquidityCampaignAdmin.notifyRewardAmount(ArcNumber.new(100));

      await setTimestampTo(1);

      await stake(user1, STAKE_AMOUNT);

      await setTimestampTo(2);

      expect(await earned(user1)).to.eq(ArcNumber.new(10));

      await setTimestampTo(3);

      await stake(user2, STAKE_AMOUNT);

      await setTimestampTo(4);

      expect(await earned(user1)).to.eq(ArcNumber.new(25));
      expect(await earned(user2)).to.eq(ArcNumber.new(5));

      await rewardToken.mintShare(liquidityCampaignAdmin.address, ArcNumber.new(100));
      await liquidityCampaignAdmin.notifyRewardAmount(ArcNumber.new(100));

      // New rewards: 60 + 100 = 160 distributed over 10 epochs

      await setTimestampTo(5);

      expect(await earned(user1)).to.eq(ArcDecimal.new(33).value);
      expect(await earned(user2)).to.eq(ArcDecimal.new(13).value);

      await withdraw(user1, STAKE_AMOUNT);

      await setTimestampTo(6);

      expect(await earned(user1)).to.eq(ArcDecimal.new(33).value);
      expect(await earned(user2)).to.eq(ArcDecimal.new(29).value);

      await liquidityCampaignAdmin.setTokensClaimable(true);

      await liquidityCampaignUser1.getReward(user1.address);

      expect(await rewardToken.balanceOf(user1.address)).to.eq(ArcDecimal.new(19.8).value);

      await setTimestampTo(7);

      expect(await earned(user2)).to.eq(ArcDecimal.new(45).value);

      await liquidityCampaignUser1.getReward(user2.address);

      expect(await rewardToken.balanceOf(user2.address)).to.eq(ArcDecimal.new(27).value);
    });
  });
});
