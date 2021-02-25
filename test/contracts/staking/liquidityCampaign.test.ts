import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
  LiquidityCampaign,
  LiquidityCampaignFactory,
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

let liquidityCampaignAdmin: LiquidityCampaign;
let liquidityCampaignUser1: LiquidityCampaign;
let liquidityCampaignUser2: LiquidityCampaign;

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

  async function stake(contract: LiquidityCampaign, user: SignerWithAddress, amount: BigNumber) {
    await mintAndApprove(stakingToken, user, amount);

    const timestampAtStake = await getCurrentTimestamp();
    await contract.stake(amount);

    return timestampAtStake;
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

    await liquidityCampaignAdmin.setRewardsDuration(REWARD_DURATION);

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
    evm = new EVM(hre.ethers.provider);
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
        await increaseTime(REWARD_DURATION);

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

        await evm.mineBlock();

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
        await increaseTime(60);
        // Check amount earned
        const amountEarned1 = await liquidityCampaignUser1.earned(user1.address);

        expect(amountEarned1).to.be.gt(amountEarned0);
      });

      it('should return the correct amount earned over time while another user stakes in between', async () => {
        // User A stakes
        await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);

        // User B stakes
        await stake(liquidityCampaignUser2, user2, STAKE_AMOUNT); // adds 3 epochs

        await increaseTime(1);

        // Check amount earned
        const user1Earned = await liquidityCampaignUser1.earned(user1.address);
        const user2Earned = await liquidityCampaignUser2.earned(user2.address);

        expect(user1Earned).to.eq(ArcNumber.new(21));
        expect(user2Earned).to.eq(ArcNumber.new(3));
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
        expect(await stakingToken.balanceOf(liquidityCampaignAdmin.address)).to.eq(amount.mul(2))
      });

      it('should update reward correctly after staking', async () => {
        await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);

        await increaseTime(1);

        let earned = await liquidityCampaignUser1.earned(user1.address);

        expect(earned).to.eq(ArcNumber.new(6));

        await increaseTime(1);

        earned = await liquidityCampaignUser1.earned(user1.address);

        expect(earned).to.eq(ArcNumber.new(12));
      });
    });

    describe('#getReward', () => {
      // beforeEach(async () => {
      //   await setup();
      // });

      it('should not be able to get the reward if the tokens are not claimable', async () => {
        await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);

        await increaseTime(REWARD_DURATION / 2);

        await expectRevert(liquidityCampaignUser1.getReward(user1.address));
      });

      it('should be able to claim rewards gradually over time', async () => {
        await liquidityCampaignAdmin.setTokensClaimable(true);

        await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);
        await increaseTime(1);

        const currentBalance = await rewardToken.balanceOf(user1.address);

        await expect(() => liquidityCampaignUser1.getReward(user1.address)).to.changeTokenBalance(
          rewardToken,
          user1,
          currentBalance.add(ArcNumber.new(12)),
        );

        await increaseTime(1);

        await expect(() => liquidityCampaignUser1.getReward(user1.address)).to.changeTokenBalance(
          rewardToken,
          user1,
          currentBalance.add(ArcNumber.new(12)),
        );
      });

      it.only('should not get any rewards if user stakes before the reward is notified', async () => {
        await liquidityCampaignAdmin.setRewardsDistributor(admin.address);

        await liquidityCampaignAdmin.setRewardsDuration(REWARD_DURATION);

        await liquidityCampaignAdmin.init(
          admin.address,
          admin.address,
          rewardToken.address,
          stakingToken.address,
          DAO_ALLOCATION,
        );
        
        await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);
        
        await evm.mineBlock()

        console.log('1',(await liquidityCampaignUser1.earned(user1.address)).toString())

        await evm.mineBlock()

        console.log('2',(await liquidityCampaignUser1.earned(user1.address)).toString())

        await evm.mineBlock()

        console.log('3',(await liquidityCampaignUser1.earned(user1.address)).toString())

        await evm.mineBlock()

        console.log('4',(await liquidityCampaignUser1.earned(user1.address)).toString())

        expect(await liquidityCampaignUser1.earned(user1.address)).to.eq(BigNumber.from(0))

        await liquidityCampaignAdmin.notifyRewardAmount(REWARD_AMOUNT);

        console.log('5',(await liquidityCampaignUser1.earned(user1.address)).toString())

        await evm.mineBlock()

        console.log('6',(await liquidityCampaignUser1.earned(user1.address)).toString())

        await evm.mineBlock()

        console.log('7',(await liquidityCampaignUser1.earned(user1.address)).toString())

        expect(await liquidityCampaignUser1.earned(user1.address)).to.eq(ArcNumber.new(12))
      })

      it('should be able to claim the right amount of rewards given the number of participants', async () => {
        await liquidityCampaignAdmin.setTokensClaimable(true);
        const initialBalance = await rewardToken.balanceOf(user1.address);

        await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);

        await expect(() => liquidityCampaignUser1.getReward(user1.address)).to.changeTokenBalance(
          rewardToken,
          user1,
          initialBalance.add(ArcNumber.new(6)),
        );

        const user2Balance = await rewardToken.balanceOf(user2.address);

        await stake(liquidityCampaignUser2, user2, STAKE_AMOUNT); // increases 3 epochs

        await expect(() => liquidityCampaignUser1.getReward(user1.address)).to.changeTokenBalance(
          rewardToken,
          user1,
          initialBalance.add(ArcNumber.new(21)), // 6 + 6+ 6 + (6/2)
        );

        await expect(() => liquidityCampaignUser2.getReward(user2.address)).to.changeTokenBalance(
          rewardToken,
          user2,
          user2Balance.add(ArcNumber.new(6)), // 3 + 3
        );
      });

      // it.only('should update reward after claiming reward', async () => {
      //   await liquidityCampaignAdmin.setTokensClaimable(true);

      //   await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);

      //   const rewardPerTokenStored0 = await liquidityCampaignUser1.rewardPerTokenStored();

      //   console.log('reward per token stored 0', rewardPerTokenStored0.toString());

      //   await increaseTime(1);

      //   await liquidityCampaignUser1.getReward(user1.address);

      //   console.log(
      //     'reward per token stored 1',
      //     (await liquidityCampaignUser1.rewardPerTokenStored()).toString(),
      //   );
      //   const rewardPerTokenStored1 = await liquidityCampaignUser1.rewardPerTokenStored();

      //   console.log(rewardPerTokenStored0.toString(), rewardPerTokenStored1.toString());

      //   await liquidityCampaignUser1.getReward(user1.address);

      //   expect(rewardPerTokenStored0).to.be.lt(rewardPerTokenStored1);
      // });
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

      // it('should update reward correctly after withdrawing', async () => {
      //   await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);

      //   const rewardPerTokenStored0 = await liquidityCampaignUser1.rewardPerTokenStored();

      //   await liquidityCampaignUser1.withdraw(STAKE_AMOUNT);

      //   const rewardPerTokenStored1 = await liquidityCampaignUser1.rewardPerTokenStored();

      //   expect(rewardPerTokenStored0).to.not.eq(rewardPerTokenStored1);
      // });
    });

    describe('#exit', () => {
      beforeEach(async () => {
        await setup();
      });

      it('should be able to exit and get the right amount of staked tokens and rewards', async () => {
        await liquidityCampaignAdmin.setTokensClaimable(true);

        await stake(liquidityCampaignUser1, user1, STAKE_AMOUNT);

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
});
