import 'jest';

import { StakingRewards } from '@src/typings/StakingRewards';
import { TestToken } from '@src/typings';
import simpleDescribe from '../helpers/simpleDescribe';
import { ITestContext } from '../helpers/simpleDescribe';
import { Wallet } from 'ethers';
import Token from '../../dist/src/utils/Token';
import { BigNumber, BigNumberish } from 'ethers/utils';
import ArcNumber from '../../dist/src/utils/ArcNumber';

let ownerWallet: Wallet;
let userWallet: Wallet;
let arcWallet: Wallet;
let distributionWallet: Wallet;

jest.setTimeout(30000);

let ownerRewards: StakingRewards;
let stakingToken: TestToken;
let rewardToken: TestToken;

const BASE = new BigNumber(10).pow(18);

async function init(ctx: ITestContext): Promise<void> {
  ownerWallet = ctx.wallets[0];
  userWallet = ctx.wallets[1];
  arcWallet = ctx.wallets[2];
  distributionWallet = ctx.wallets[3];
}

simpleDescribe('StakingRewards', init, (ctx: ITestContext) => {
  beforeEach(async () => {
    stakingToken = await TestToken.deploy(ownerWallet, 'LINKUSD/USDC 50/50', 'BPT');
    rewardToken = await TestToken.deploy(ownerWallet, 'Arc Token', 'ARC');

    ownerRewards = await StakingRewards.deploy(
      ownerWallet,
      ownerWallet.address,
      ownerWallet.address,
      distributionWallet.address,
      rewardToken.address,
      stakingToken.address,
    );

    await ownerRewards.setRewardsDistribution(ownerWallet.address);
    await ownerRewards.setRewardsDuration(100);
  });

  async function getStakingContractAs(caller: Wallet) {
    return await StakingRewards.at(caller, ownerRewards.address);
  }

  async function stakeTokens(contract: StakingRewards, tokens: BigNumberish) {
    await stakingToken.mintShare(userWallet.address, tokens);
    await Token.approve(stakingToken.address, userWallet, contract.address, tokens);
    await contract.stake(tokens);
  }

  it('should be able to stake tokens', async () => {
    const rewardContract = await getStakingContractAs(userWallet);
    await stakeTokens(rewardContract, 100);
    expect(await rewardContract.balanceOf(userWallet.address)).toEqual(new BigNumber(100));
  });

  it('should be able to withdraw tokens', async () => {
    const rewardContract = await getStakingContractAs(userWallet);
    await stakeTokens(rewardContract, 100);
    await rewardContract.withdraw(100);
    expect(await rewardContract.balanceOf(userWallet.address)).toEqual(new BigNumber(0));
  });

  it('should be able to add reward amount', async () => {
    const DEPOSIT_AMOUNT = ArcNumber.new(100);

    const rewardContract = await getStakingContractAs(userWallet);
    await stakeTokens(rewardContract, DEPOSIT_AMOUNT);

    await rewardToken.mintShare(rewardContract.address, DEPOSIT_AMOUNT);
    await ownerRewards.notifyRewardAmount(DEPOSIT_AMOUNT);

    await ctx.evm.increaseTime(10);
    await ctx.evm.mineBlock();

    expect(await rewardContract.rewardPerToken()).toEqual(ArcNumber.new(1).mul(2).div(3).div(10));
  });

  it('should be able to claim fees', async () => {
    const DEPOSIT_AMOUNT = ArcNumber.new(100);

    const rewardContract = await getStakingContractAs(userWallet);
    await stakeTokens(rewardContract, DEPOSIT_AMOUNT);

    await rewardToken.mintShare(rewardContract.address, DEPOSIT_AMOUNT);
    await ownerRewards.notifyRewardAmount(DEPOSIT_AMOUNT);

    await ctx.evm.increaseTime(10);
    await ctx.evm.mineBlock();

    await rewardContract.getReward();

    const rewardPerToken = await rewardContract.rewardPerToken();

    expect((await rewardToken.balanceOf(userWallet.address)).toString()).toEqual(
      rewardPerToken.mul(DEPOSIT_AMOUNT).mul(2).div(3).div(BASE).toString(),
    );

    expect((await rewardToken.balanceOf(ownerWallet.address)).toString()).toEqual(
      rewardPerToken.mul(DEPOSIT_AMOUNT).div(3).div(BASE).toString(),
    );
  });

  it('should be able to exit', async () => {
    const DEPOSIT_AMOUNT = ArcNumber.new(100);

    const rewardContract = await getStakingContractAs(userWallet);

    const preBalance = await stakingToken.balanceOf(userWallet.address);

    await stakeTokens(rewardContract, DEPOSIT_AMOUNT);
    await rewardContract.withdraw(DEPOSIT_AMOUNT);

    expect(await stakingToken.balanceOf(userWallet.address)).toEqual(
      DEPOSIT_AMOUNT.add(preBalance),
    );
  });
});
