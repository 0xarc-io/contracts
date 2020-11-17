import 'module-alias/register';

import { TestToken } from '@src/typings/TestToken';
import simpleDescribe from '@test/helpers/simpleDescribe';
import { ITestContext } from '@test/helpers/simpleDescribe';
import Token from '@src/utils/Token';
import { BigNumber, BigNumberish } from 'ethers/utils';
import ArcNumber from '@src/utils/ArcNumber';
import { TokenStakingAccrual } from '@src/typings/TokenStakingAccrual';
import { expectRevert } from '@test/helpers/expectRevert';
import { Account, getWaffleExpect } from '../../helpers/testingUtils';

let ownerAccount: Account;
let userAccount: Account;
let arcAccount: Account;
let distributionAccount: Account;

const expect = getWaffleExpect();

let rewardContract: TokenStakingAccrual;
let stakingToken: TestToken;
let rewardToken: TestToken;

const BASE = new BigNumber(10).pow(18);

async function init(ctx: ITestContext): Promise<void> {
  ownerAccount = ctx.accounts[0];
  userAccount = ctx.accounts[1];
  arcAccount = ctx.accounts[2];
  distributionAccount = ctx.accounts[3];
}

simpleDescribe('TokenAccrual', init, (ctx: ITestContext) => {
  beforeEach(async () => {
    stakingToken = await TestToken.deploy(ownerAccount.signer, 'LINKUSD/USDC 50/50', 'BPT');
    rewardToken = await TestToken.deploy(ownerAccount.signer, 'Arc Token', 'ARC');

    rewardContract = await TokenStakingAccrual.deploy(
      ownerAccount.signer,
      stakingToken.address,
      rewardToken.address,
    );

    expect(await rewardContract.stakingToken()).to.equal(stakingToken.address);
    expect(await rewardContract.accrualToken()).to.equal(rewardToken.address);
  });

  async function getStakingContractAs(caller: Account) {
    return await TokenStakingAccrual.at(caller.signer, rewardContract.address);
  }

  async function stakeTokens(contract: TokenStakingAccrual, tokens: BigNumberish, caller: Account) {
    await stakingToken.mintShare(caller.address, tokens);
    await Token.approve(stakingToken.address, caller.signer, contract.address, tokens);
    await contract.stake(tokens);
  }

  it('should be able to stake tokens', async () => {
    const rewardContract = await getStakingContractAs(userAccount);
    await stakeTokens(rewardContract, 100, userAccount);
    expect(await rewardContract.getUserBalance(userAccount.address)).to.equal(new BigNumber(100));
    expect(await rewardContract.getTotalBalance()).to.equal(new BigNumber(100));
  });

  it('should be able to withdraw tokens', async () => {
    const rewardContract = await getStakingContractAs(userAccount);
    await stakeTokens(rewardContract, 100, userAccount);
    await rewardContract.unstake(100);
    expect(await rewardContract.getUserBalance(userAccount.address)).to.equal(new BigNumber(0));
    expect(await rewardContract.getTotalBalance()).to.equal(new BigNumber(0));
  });

  it('should be able to claim fees', async () => {
    const DEPOSIT_AMOUNT = ArcNumber.new(100);

    const userRewardContract = await getStakingContractAs(userAccount);
    await stakeTokens(userRewardContract, DEPOSIT_AMOUNT, userAccount);

    const adminRewardContract = await getStakingContractAs(ownerAccount);
    await stakeTokens(adminRewardContract, DEPOSIT_AMOUNT, ownerAccount);

    await rewardToken.mintShare(rewardContract.address, DEPOSIT_AMOUNT);

    await rewardContract.claimFor(userAccount.address);
    await rewardContract.claimFor(ownerAccount.address);

    expect((await rewardToken.balanceOf(userAccount.address)).toString()).to.equal(
      ArcNumber.new(50).toString(),
    );

    expect((await rewardToken.balanceOf(ownerAccount.address)).toString()).to.equal(
      ArcNumber.new(50).toString(),
    );

    await expectRevert(rewardContract.claimFor(userAccount.address));
    await expectRevert(rewardContract.claimFor(ownerAccount.address));

    await rewardToken.mintShare(rewardContract.address, DEPOSIT_AMOUNT);

    await rewardContract.claimFor(userAccount.address);
    await rewardContract.claimFor(ownerAccount.address);

    expect((await rewardToken.balanceOf(userAccount.address)).toString()).to.equal(
      ArcNumber.new(100).toString(),
    );

    expect((await rewardToken.balanceOf(ownerAccount.address)).toString()).to.equal(
      ArcNumber.new(100).toString(),
    );
  });

  it('should be able to exit', async () => {
    const DEPOSIT_AMOUNT = ArcNumber.new(100);

    const rewardContract = await getStakingContractAs(userAccount);

    const preBalance = await stakingToken.balanceOf(userAccount.address);

    await stakeTokens(rewardContract, DEPOSIT_AMOUNT, userAccount);
    await rewardContract.unstake(DEPOSIT_AMOUNT);

    expect(await stakingToken.balanceOf(userAccount.address)).to.equal(
      DEPOSIT_AMOUNT.add(preBalance),
    );
  });
});
