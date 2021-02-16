import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { TestToken, TestTokenFactory } from '@src/typings';
import hre from 'hardhat';
import ArcNumber from '@src/utils/ArcNumber';
import { ethers } from 'hardhat';
import { deployTestToken } from '../deployers';
import ArcDecimal from '@src/utils/ArcDecimal';
import { BigNumber, BigNumberish } from 'ethers';
import chai from 'chai';
import { BASE, TEN_PERCENT } from '@src/constants';
import { expectRevert } from '@test/helpers/expectRevert';
import { EVM } from '@test/helpers/EVM';
import { solidity } from 'ethereum-waffle';
import { fail } from 'assert';
import { JointCampaign } from '@src/typings/JointCampaign';
import { JointCampaignFactory } from '@src/typings/JointCampaignFactory';
import { generateContext, ITestContext } from '../context';
import { mozartFixture } from '../fixtures';
import { setupMozart } from '../setup';
import { MozartTestArc } from '@src/MozartTestArc';

chai.use(solidity);
const expect = chai.expect;

let jointCampaignOwner: JointCampaign;
let jointCampaignLido: JointCampaign;
let jointCampaignUser1: JointCampaign;
let jointCampaignUser2: JointCampaign;

let arc: MozartTestArc;

let stakingToken: TestToken;
let arcToken: TestToken;
let stEthToken: TestToken;
let otherErc20: TestToken;

let owner: SignerWithAddress;
let lido: SignerWithAddress;
let user1: SignerWithAddress;
let user2: SignerWithAddress;

const ARC_REWARD_AMOUNT = ArcNumber.new(100);
const STETH_REWARD_AMOUNT = ArcNumber.new(200);
const STAKE_AMOUNT = ArcNumber.new(10);
const REWARD_DURATION = 10;

const DAO_ALLOCATION = ArcDecimal.new(0.4);
const SLASHER_CUT = ArcDecimal.new(0.3);
const STAKE_TO_DEBT_RATIO = 2;
const USER_ALLOCATION = ArcNumber.new(1).sub(DAO_ALLOCATION.value);

const COLLATERAL_AMOUNT = STAKE_AMOUNT.mul(2);
const BORROW_AMOUNT = STAKE_AMOUNT;

let evm: EVM;

describe('JointCampaign', () => {
  async function increaseTime(duration: number) {
    await evm.increaseTime(duration);
    await evm.mineBlock();
  }

  /**
   * Opens a position and stakes the amount
   * @param user staking user
   * @param amount the amount to stake
   */
  async function stake(user: SignerWithAddress, amount: BigNumber) {
    await mintAndApprove(stakingToken, user, amount);

    const newPosition = await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, user);

    const contract = JointCampaignFactory.connect(jointCampaignOwner.address, user);

    const timestampAtStake = await getCurrentTimestamp();
    await contract.stake(amount, newPosition.params.id);

    return timestampAtStake;
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

  async function getCurrentTimestamp() {
    const currentBlockNumber = await ethers.provider.getBlockNumber();
    const currentBlock = await ethers.provider.getBlock(currentBlockNumber);

    return BigNumber.from(currentBlock.timestamp);
  }

  /**
   * Only calls init() and sets the reward duration
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
      stEthToken.address,
      stakingToken.address,
      DAO_ALLOCATION,
      SLASHER_CUT,
      STAKE_TO_DEBT_RATIO,
      await arc.coreAddress(),
    );
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
    await jointCampaignLido.notifyRewardAmount(STETH_REWARD_AMOUNT, stEthToken.address);
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
    evm = new EVM(hre.ethers.provider);
    owner = signers[0];
    lido = signers[1];
    user1 = signers[2];
    user2 = signers[3];
  });

  beforeEach(async () => {
    stakingToken = await deployTestToken(owner, '3Pool', 'CRV');
    arcToken = await deployTestToken(owner, 'Arc Token', 'ARC');
    stEthToken = await deployTestToken(owner, 'stEthToken', 'stETH');
    otherErc20 = await deployTestToken(owner, 'Another ERC20 token', 'AERC20');

    jointCampaignOwner = await new JointCampaignFactory(owner).deploy();
    jointCampaignLido = JointCampaignFactory.connect(jointCampaignOwner.address, lido);
    jointCampaignUser1 = JointCampaignFactory.connect(jointCampaignOwner.address, user1);
    jointCampaignUser2 = JointCampaignFactory.connect(jointCampaignOwner.address, user2);

    await arcToken.mintShare(jointCampaignOwner.address, ARC_REWARD_AMOUNT);
    await stEthToken.mintShare(jointCampaignOwner.address, STETH_REWARD_AMOUNT);

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

        await stake(user2, STAKE_AMOUNT.mul(2));

        expect(await jointCampaignOwner.totalSupply()).to.eq(STAKE_AMOUNT.mul(3));
      });
    });

    describe('#balanceOfStaker', () => {
      beforeEach(setup);

      it('should return 0 if user did not stake', async () => {
        expect(await jointCampaignOwner.balanceOfStaker(user1.address)).to.eq(BigNumber.from(0));
      });

      it('should return the correct balance after staking', async () => {
        await stake(user1, STAKE_AMOUNT);

        expect(await jointCampaignOwner.balanceOfStaker(user1.address)).to.eq(STAKE_AMOUNT);
      });
    });

    describe('#lastTimeRewardApplicable', () => {
      beforeEach(setup);

      it('should return the block timestamp if called before the reward period finished', async () => {
        const currentTime = await getCurrentTimestamp();

        expect(await jointCampaignOwner.lastTimeRewardApplicable()).to.eq(currentTime);
      });

      it('should return the period finish if called after reward period has finished', async () => {
        await increaseTime(REWARD_DURATION);

        const periodFinish = await jointCampaignOwner.periodFinish();
        expect(await jointCampaignOwner.lastTimeRewardApplicable()).to.eq(periodFinish);
      });
    });

    describe('#arcRewardPerTokenUser', () => {
      beforeEach(setup);

      it('should return 0 if the supply is 0', async () => {
        expect(await jointCampaignOwner.arcRewardPerTokenUser()).to.eq(BigNumber.from(0));
      });

      it('should return a valid reward per token after someone staked', async () => {
        await stake(user1, STAKE_AMOUNT);
        await evm.mineBlock();

        expect(await jointCampaignOwner.arcRewardPerTokenUser()).to.eq(ArcDecimal.new(0.6).value);
      });

      it('should return correct reward per token with two users staked', async () => {
        await stake(user1, STAKE_AMOUNT);
        await stake(user2, STAKE_AMOUNT);

        await evm.mineBlock();

        expect(await jointCampaignOwner.arcRewardPerTokenUser()).to.eq(ArcDecimal.new(0.3).value);
      });
    });

    describe('#stEthRewardPerToken', () => {
      beforeEach(setup);

      it('should return the reward per token stored if the supply is 0', async () => {
        expect(await jointCampaignOwner.stEthRewardPerToken()).to.eq(BigNumber.from(0));
      });

      it('should return the correct reward per token after someone staked', async () => {
        await stake(user1, STAKE_AMOUNT);
        await evm.mineBlock();

        expect(await jointCampaignOwner.stEthRewardPerToken()).to.eq(ArcNumber.new(2));
      });

      it('should return correct reward per token with two tokens staked', async () => {
        await stake(user1, STAKE_AMOUNT);
        await stake(user2, STAKE_AMOUNT);

        await evm.mineBlock();

        expect(await jointCampaignOwner.stEthRewardPerToken()).to.eq(ArcNumber.new(1));
      });
    });

    describe.only('#arcEarned', () => {
      beforeEach(setup);

      it('should return the correct amount of arcx earned over time', async () => {
        await stake(user1, STAKE_AMOUNT);

        await evm.mineBlock();

        expect(await jointCampaignUser1.arcEarned(user1.address)).to.eq(ArcNumber.new(6));

        await evm.mineBlock();

        expect(await jointCampaignUser1.arcEarned(user1.address)).to.eq(ArcNumber.new(12));
      });

      it('should return the correct amount of arcx earned over time while another user stakes in between', async () => {
        await stake(user1, STAKE_AMOUNT);

        await evm.mineBlock();

        expect(await jointCampaignUser1.arcEarned(user1.address)).to.eq(ArcNumber.new(6));

        await stake(user2, STAKE_AMOUNT); // adds 4 epochs

        await evm.mineBlock();

        expect(await jointCampaignUser1.arcEarned(user1.address)).to.eq(ArcNumber.new(33)); // 6 + 6*4 + 6/2
        expect(await jointCampaignUser2.arcEarned(user2.address)).to.eq(ArcNumber.new(3));
      });
    });

    describe('#stETHEarned', () => {
      beforeEach(setup);

      xit('should return the correct amount of stETH earned over time', async () => {
        // await stake(jointCampaignUser1, user1, ArcNumber.new(10));
        // // Check amount earned (should be 0)
        // const amountEarned0 = await jointCampaignUser1.earned(user1.address);
        // expect(amountEarned0).to.eq(BigNumber.from(0));
        // // Advance time
        // await increaseTime(60);
        // // Check amount earned
        // const amountEarned1 = await jointCampaignUser1.earned(user1.address);
        // expect(amountEarned1).to.be.gt(amountEarned0);
      });

      xit('should return the correct amount of stETH earned over time while another user stakes in between', async () => {
        // // User A stakes
        // await stake(jointCampaignUser1, user1, STAKE_AMOUNT);
        // // User B stakes
        // await stake(jointCampaignUser2, user2, STAKE_AMOUNT); // adds 3 epochs
        // await increaseTime(1);
        // // Check amount earned
        // const user1Earned = await jointCampaignUser1.earned(user1.address);
        // const user2Earned = await jointCampaignUser2.earned(user2.address);
        // expect(user1Earned).to.eq(ArcNumber.new(21));
        // expect(user2Earned).to.eq(ArcNumber.new(3));
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

      xit('returns the correct ARC reward for duration', async () => {
        // const rewardForDuration = await jointCampaignOwner.getRewardForDuration();
        // expect(Math.round(parseFloat(ethers.utils.formatEther(rewardForDuration)))).to.eq(
        //   parseFloat(ethers.utils.formatEther(REWARD_AMOUNT)),
        // );
      });
    });

    describe('#getStETHRewardForDuration', () => {
      xit('returns the correct stEth reward for duration');
    });

    describe('#isMinter', () => {
      xit('should revert if the state contract is not registered');
      xit('should return false if user did not mint debt to the position');
      xit('should return fasle if user minted a smaller amount than the given _amount');
      xit(
        'should return true if user minted an equal or greater amount of debt for the given position',
      );
    });
  });

  describe('Mutative functions', () => {
    describe('#stake', () => {
      beforeEach(setup);

      xit('should not be able to stake the full amount with less debt');
      xit('should not be able to set a lower debt requirement by staking less before the deadline');
      xit('should not be able to stake to a different position ID');

      xit('should not be able to stake more than balance', async () => {
        // await mintAndApprove(stakingToken, user1, ArcNumber.new(10));
        // const balance = await stakingToken.balanceOf(user1.address);
        // await expectRevert(jointCampaignUser1.stake(balance.add(1)));
      });

      xit('should be able to stake', async () => {
        // const amount = ArcNumber.new(10);
        // await mintAndApprove(stakingToken, user1, amount.mul(2));
        // await jointCampaignUser1.stake(amount);
        // let supply = await jointCampaignUser1.totalSupply();
        // expect(supply).to.eq(amount);
        // await jointCampaignUser1.stake(amount);
        // supply = await jointCampaignUser1.totalSupply();
        // expect(supply).to.eq(amount.mul(2));
        // expect(await stakingToken.balanceOf(jointCampaignOwner.address)).to.eq(amount.mul(2));
      });

      xit('should update reward correctly after staking', async () => {
        // await stake(jointCampaignUser1, user1, STAKE_AMOUNT);
        // await increaseTime(1);
        // let earned = await jointCampaignUser1.earned(user1.address);
        // expect(earned).to.eq(ArcNumber.new(6));
        // await increaseTime(1);
        // earned = await jointCampaignUser1.earned(user1.address);
        // expect(earned).to.eq(ArcNumber.new(12));
      });
    });

    describe('#slash', () => {
      xit('should not be able to slash if user has the amount of their debt snapshot');
      xit('should not be able to slash past the vesting end date');
      xit('should not be able to slash if the tokens are unstaked but debt is there');
      xit('should be able to slash if the user does not have enough debt', async () => {
        // check for both rewards
      });
    });

    describe('#getReward', () => {
      beforeEach(setup);

      xit('should not be able to get the reward if the tokens are not claimable', async () => {
        // await stake(jointCampaignUser1, user1, STAKE_AMOUNT);
        // await increaseTime(REWARD_DURATION / 2);
        // await expectRevert(jointCampaignUser1.getReward(user1.address));
      });

      xit('should be able to claim rewards gradually over time', async () => {
        // await jointCampaignOwner.setTokensClaimable(true);
        // await stake(jointCampaignUser1, user1, STAKE_AMOUNT);
        // await increaseTime(1);
        // const currentBalance = await arcToken.balanceOf(user1.address);
        // await expect(() => jointCampaignUser1.getReward(user1.address)).to.changeTokenBalance(
        //   arcToken,
        //   user1,
        //   currentBalance.add(ArcNumber.new(12)),
        // );
        // await increaseTime(1);
        // await expect(() => jointCampaignUser1.getReward(user1.address)).to.changeTokenBalance(
        //   arcToken,
        //   user1,
        //   currentBalance.add(ArcNumber.new(12)),
        // );
      });

      xit('should be able to claim the right amount of rewards given the number of participants', async () => {
        // await jointCampaignOwner.setTokensClaimable(true);
        // const initialBalance = await arcToken.balanceOf(user1.address);
        // await stake(jointCampaignUser1, user1, STAKE_AMOUNT);
        // await expect(() => jointCampaignUser1.getReward(user1.address)).to.changeTokenBalance(
        //   arcToken,
        //   user1,
        //   initialBalance.add(ArcNumber.new(6)),
        // );
        // const user2Balance = await arcToken.balanceOf(user2.address);
        // await stake(jointCampaignUser2, user2, STAKE_AMOUNT); // increases 3 epochs
        // await expect(() => jointCampaignUser1.getReward(user1.address)).to.changeTokenBalance(
        //   arcToken,
        //   user1,
        //   initialBalance.add(ArcNumber.new(21)), // 6 + 6+ 6 + (6/2)
        // );
        // await expect(() => jointCampaignUser2.getReward(user2.address)).to.changeTokenBalance(
        //   arcToken,
        //   user2,
        //   user2Balance.add(ArcNumber.new(6)), // 3 + 3
        // );
      });

      xit('should claim the correct amount of rewards after calling #notifyRewardAmount a second time', async () => {
        // call #notifyArcRewardAmount
        // call #notifyStEthRewardAmount
        // wait some time
        // get rewards
        // call #notifyArcRewardAmount
        // call #notifyStEthRewardAmount
        // get rewards
      });

      // it.only('should update reward after claiming reward', async () => {
      //   await jointCampaignOwner.setTokensClaimable(true);

      //   await stake(jointCampaignUser1, user1, STAKE_AMOUNT);

      //   const rewardPerTokenStored0 = await jointCampaignUser1.rewardPerTokenStored();

      //   console.log('reward per token stored 0', rewardPerTokenStored0.toString());

      //   await increaseTime(1);

      //   await jointCampaignUser1.getReward(user1.address);

      //   console.log(
      //     'reward per token stored 1',
      //     (await jointCampaignUser1.rewardPerTokenStored()).toString(),
      //   );
      //   const rewardPerTokenStored1 = await jointCampaignUser1.rewardPerTokenStored();

      //   console.log(rewardPerTokenStored0.toString(), rewardPerTokenStored1.toString());

      //   await jointCampaignUser1.getReward(user1.address);

      //   expect(rewardPerTokenStored0).to.be.lt(rewardPerTokenStored1);
      // });
    });

    describe('#withdraw', () => {
      beforeEach(setup);

      xit('should not be able to withdraw more than the balance', async () => {
        // await stake(jointCampaignUser1, user1, STAKE_AMOUNT);
        // await expectRevert(jointCampaignUser1.withdraw(STAKE_AMOUNT.add(1)));
      });

      xit('should withdraw the correct amount', async () => {
        // await stake(jointCampaignUser1, user1, STAKE_AMOUNT);
        // await jointCampaignUser1.withdraw(STAKE_AMOUNT);
        // const balance = await stakingToken.balanceOf(user1.address);
        // expect(balance).to.eq(STAKE_AMOUNT);
      });

      // it('should update reward correctly after withdrawing', async () => {
      //   await stake(jointCampaignUser1, user1, STAKE_AMOUNT);

      //   const rewardPerTokenStored0 = await jointCampaignUser1.rewardPerTokenStored();

      //   await jointCampaignUser1.withdraw(STAKE_AMOUNT);

      //   const rewardPerTokenStored1 = await jointCampaignUser1.rewardPerTokenStored();

      //   expect(rewardPerTokenStored0).to.not.eq(rewardPerTokenStored1);
      // });
    });

    describe('#exit', () => {
      beforeEach(setup);

      xit('should be able to exit and get the right amount of staked tokens and rewards', async () => {
        // await jointCampaignOwner.setTokensClaimable(true);
        // await stake(jointCampaignUser1, user1, STAKE_AMOUNT);
        // await jointCampaignUser1.exit();
        // const stakingBalance = await stakingToken.balanceOf(user1.address);
        // const rewardBalance = await arcToken.balanceOf(user1.address);
        // expect(stakingBalance).to.eq(STAKE_AMOUNT);
        // expect(rewardBalance).to.eq(ArcNumber.new(6));
      });
    });
  });

  describe('Restricted functions', () => {
    describe('#init', () => {
      xit('should not be callable by anyone', async () => {
        // await expectRevert(
        //   jointCampaignUser1.init(
        //     user1.address,
        //     user1.address,
        //     arcToken.address,
        //     stakingToken.address,
        //     DAO_ALLOCATION,
        //   ),
        // );
      });

      xit('should only be callable by the contract owner', async () => {
        // await jointCampaignOwner.init(
        //   owner.address,
        //   owner.address,
        //   arcToken.address,
        //   stakingToken.address,
        //   DAO_ALLOCATION,
        // );
        // const arcDao = await jointCampaignOwner.arcDAO();
        // const rewardsDistributor = await jointCampaignOwner.rewardsDistributor();
        // const rewardsToken = await jointCampaignOwner.rewardsToken();
        // const stakingTokenAddress = await jointCampaignOwner.stakingToken();
        // const daoAllocation = await jointCampaignOwner.daoAllocation();
        // expect(arcDao).to.eq(owner.address);
        // expect(rewardsDistributor).to.eq(owner.address);
        // expect(rewardsToken).to.eq(arcToken.address);
        // expect(stakingTokenAddress).to.eq(stakingToken.address);
        // expect(daoAllocation).to.eq(DAO_ALLOCATION.value);
      });
    });

    describe('#setStEthRewardsDistributor', () => {
      it('should not be callable by anyone', async () => {
        await expectRevert(jointCampaignUser1.setRewardsDistributor(user1.address));
      });

      it('should set rewards distributor if called by current stEthRewardsDistributor', async () => {
        await jointCampaignOwner.setRewardsDistributor(user2.address, true);

        expect(await jointCampaignOwner.rewardsDistributor()).to.eq(user2.address);
        fail();
      });
    });

    describe('#setArcRewardsDistributor', () => {
      it('should not be callable by anyone', async () => {
        await expectRevert(jointCampaignUser1.setRewardsDistributor(user1.address));
      });

      it('should set rewards distributor if called by owner', async () => {
        await jointCampaignOwner.setRewardsDistributor(user2.address, true);

        expect(await jointCampaignOwner.rewardsDistributor()).to.eq(user2.address);
        fail();
      });
    });

    describe('#setRewardsDuration', () => {
      it('should not be called by anyone', async () => {
        await expectRevert(jointCampaignUser1.setRewardsDuration(BigNumber.from(REWARD_DURATION)));
      });

      it('should only be callable by the contract owner and set the right duration', async () => {
        const duration = BigNumber.from(REWARD_DURATION);

        await jointCampaignOwner.setRewardsDuration(duration);

        expect(await jointCampaignOwner.rewardsDuration()).to.eq(duration);
      });
    });

    describe('#notifyRewardAmount', () => {
      xit('should not be callable by anyone', async () => {
        // await expectRevert(jointCampaignUser1.notifyRewardAmount(REWARD_AMOUNT));
      });

      xit('should be callable by the arc distributor');
      xit('should be callable by the stETH distributor');
      xit('should revert if ARCx reward amount is less than the amount of ARCx on the contract');
      xit('should revert if stETH reward amount is less than the amount of stETH on the contract');
      xit('should revert if ARCx distributor tries to notify the stETH rewards');
      xit('should revert if stETH distributor tries to notify the ARCx rewards');

      xit('should update arc rewards correctly after a new reward update', async () => {
        // await jointCampaignOwner.init(
        //   owner.address,
        //   owner.address,
        //   arcToken.address,
        //   stakingToken.address,
        //   DAO_ALLOCATION,
        // );
        // await jointCampaignOwner.setRewardsDuration(REWARD_DURATION);
        // await jointCampaignOwner.notifyRewardAmount(REWARD_AMOUNT.div(2));
        // const rewardRate0 = await jointCampaignOwner.rewardRate();
        // expect(rewardRate0).to.eq(ArcNumber.new(5));
        // await jointCampaignOwner.notifyRewardAmount(REWARD_AMOUNT.div(2));
        // const rewardrate1 = await jointCampaignOwner.rewardRate();
        // expect(rewardrate1).to.eq(ArcDecimal.new(9.5).value);
      });

      xit('should update stETH rewards correctly after a new reward update');
    });

    describe('#recoverERC20', () => {
      const erc20Share = ArcNumber.new(10);

      beforeEach(async () => {
        await otherErc20.mintShare(jointCampaignOwner.address, erc20Share);
      });

      it('should not be callable by anyone', async () => {
        await expectRevert(jointCampaignUser1.recoverERC20(otherErc20.address, erc20Share));
      });

      it('should not recover staking or stEth', async () => {
        await setup();
        await stakingToken.mintShare(jointCampaignOwner.address, erc20Share);
        await arcToken.mintShare(jointCampaignOwner.address, erc20Share);

        await expectRevert(jointCampaignOwner.recoverERC20(stakingToken.address, erc20Share));
        await expectRevert(jointCampaignOwner.recoverERC20(arcToken.address, erc20Share));
        // todo add second reward token
        fail();
      });

      xit('should revert if owner tries to recover a greater amount of ARC than the reward amount');

      it('should let owner recover the erc20 on this contract', async () => {
        const balance0 = await otherErc20.balanceOf(owner.address);

        await jointCampaignOwner.recoverERC20(otherErc20.address, erc20Share);

        const balance1 = await otherErc20.balanceOf(owner.address);

        expect(balance1).to.eq(balance0.add(erc20Share));
      });

      xit('should let owner recover the surplus of ARC on the contract');
    });

    describe('#recoverStEth', () => {
      xit('should not be callable by anyone');
      xit('should let stEth reward distributor recover the surplus of stEth on the contract');
    });

    describe('#setTokensClaimable', () => {
      it('should not be claimable by anyone', async () => {
        await expectRevert(jointCampaignUser1.setTokensClaimable(true));
      });

      it('should only be callable by the contract owner', async () => {
        await jointCampaignOwner.setTokensClaimable(true);

        expect(await jointCampaignOwner.tokensClaimable()).to.be.eq(true);
      });
    });
  });
});
