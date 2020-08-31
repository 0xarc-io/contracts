import 'jest';

import { TestToken } from '@src/typings/TestToken';
import simpleDescribe from '@test/helpers/simpleDescribe';
import { ITestContext } from '@test/helpers/simpleDescribe';
import { Wallet } from 'ethers';
import Token from '@src/utils/Token';
import { BigNumber, BigNumberish } from 'ethers/utils';
import ArcNumber from '@src/utils/ArcNumber';
import { TokenStakingAccrual } from '@src/typings/TokenStakingAccrual';
import { expectRevert } from '@src/utils/expectRevert';

let ownerWallet: Wallet;
let userWallet: Wallet;
let arcWallet: Wallet;
let distributionWallet: Wallet;

jest.setTimeout(30000);

let rewardContract: TokenStakingAccrual;
let stakingToken: TestToken;
let rewardToken: TestToken;

const BASE = new BigNumber(10).pow(18);

async function init(ctx: ITestContext): Promise<void> {
  ownerWallet = ctx.wallets[0];
  userWallet = ctx.wallets[1];
  arcWallet = ctx.wallets[2];
  distributionWallet = ctx.wallets[3];
}

simpleDescribe('TokenAccrual', init, (ctx: ITestContext) => {
  beforeEach(async () => {
    stakingToken = await TestToken.deploy(ownerWallet, 'LINKUSD/USDC 50/50', 'BPT');
    rewardToken = await TestToken.deploy(ownerWallet, 'Arc Token', 'ARC');

    rewardContract = await TokenStakingAccrual.deploy(
      ownerWallet,
      stakingToken.address,
      rewardToken.address,
    );

    expect(await rewardContract.stakingToken()).toEqual(stakingToken.address);
    expect(await rewardContract.accrualToken()).toEqual(rewardToken.address);
  });

  async function getStakingContractAs(caller: Wallet) {
    return await TokenStakingAccrual.at(caller, rewardContract.address);
  }

  async function stakeTokens(contract: TokenStakingAccrual, tokens: BigNumberish, caller: Wallet) {
    await stakingToken.mintShare(caller.address, tokens);
    await Token.approve(stakingToken.address, caller, contract.address, tokens);
    await contract.stake(tokens);
  }

  it('should be able to stake tokens', async () => {
    const rewardContract = await getStakingContractAs(userWallet);
    await stakeTokens(rewardContract, 100, userWallet);
    expect(await rewardContract.getUserBalance(userWallet.address)).toEqual(new BigNumber(100));
    expect(await rewardContract.getTotalBalance()).toEqual(new BigNumber(100));
  });

  it('should be able to withdraw tokens', async () => {
    const rewardContract = await getStakingContractAs(userWallet);
    await stakeTokens(rewardContract, 100, userWallet);
    await rewardContract.unstake(100);
    expect(await rewardContract.getUserBalance(userWallet.address)).toEqual(new BigNumber(0));
    expect(await rewardContract.getTotalBalance()).toEqual(new BigNumber(0));
  });

  it('should be able to claim fees', async () => {
    const DEPOSIT_AMOUNT = ArcNumber.new(100);

    const userRewardContract = await getStakingContractAs(userWallet);
    await stakeTokens(userRewardContract, DEPOSIT_AMOUNT, userWallet);

    const adminRewardContract = await getStakingContractAs(ownerWallet);
    await stakeTokens(adminRewardContract, DEPOSIT_AMOUNT, ownerWallet);

    await rewardToken.mintShare(rewardContract.address, DEPOSIT_AMOUNT);

    await rewardContract.claimFor(userWallet.address);
    await rewardContract.claimFor(ownerWallet.address);

    expect((await rewardToken.balanceOf(userWallet.address)).toString()).toEqual(
      ArcNumber.new(50).toString(),
    );

    expect((await rewardToken.balanceOf(ownerWallet.address)).toString()).toEqual(
      ArcNumber.new(50).toString(),
    );

    await expectRevert(rewardContract.claimFor(userWallet.address));
    await expectRevert(rewardContract.claimFor(ownerWallet.address));

    await rewardToken.mintShare(rewardContract.address, DEPOSIT_AMOUNT);

    await rewardContract.claimFor(userWallet.address);
    await rewardContract.claimFor(ownerWallet.address);

    expect((await rewardToken.balanceOf(userWallet.address)).toString()).toEqual(
      ArcNumber.new(100).toString(),
    );

    expect((await rewardToken.balanceOf(ownerWallet.address)).toString()).toEqual(
      ArcNumber.new(100).toString(),
    );
  });

  it('should be able to exit', async () => {
    const DEPOSIT_AMOUNT = ArcNumber.new(100);

    const rewardContract = await getStakingContractAs(userWallet);

    const preBalance = await stakingToken.balanceOf(userWallet.address);

    await stakeTokens(rewardContract, DEPOSIT_AMOUNT, userWallet);
    await rewardContract.unstake(DEPOSIT_AMOUNT);

    expect(await stakingToken.balanceOf(userWallet.address)).toEqual(
      DEPOSIT_AMOUNT.add(preBalance),
    );
  });
});
