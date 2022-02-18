import 'module-alias/register';
import { expect } from 'chai';

import { TestToken } from '@src/typings/TestToken';
import { BigNumber, BigNumberish, utils } from 'ethers';
import { TokenStakingAccrual } from '@src/typings/TokenStakingAccrual';
import { expectRevert } from '@test/helpers/expectRevert';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ethers } from 'hardhat';
import { TestTokenFactory } from '@src/typings/TestTokenFactory';
import { TokenStakingAccrualFactory } from '@src/typings/TokenStakingAccrualFactory';
import { deployTokenStakingAccrual } from '../deployers';
import { Token } from '@src/utils';

let ownerAccount: SignerWithAddress;
let userAccount: SignerWithAddress;

let rewardContract: TokenStakingAccrual;
let stakingToken: TestToken;
let rewardToken: TestToken;

describe('TokenAccrual', () => {
  before(async () => {
    const signers = await ethers.getSigners();
    ownerAccount = signers[0];
    userAccount = signers[1];
  });

  beforeEach(async () => {
    stakingToken = await new TestTokenFactory(ownerAccount).deploy(
      'LINKUSD/USDC 50/50',
      'BPT',
      18,
    );
    rewardToken = await new TestTokenFactory(ownerAccount).deploy(
      'Arc Token',
      'ARC',
      18,
    );

    rewardContract = await deployTokenStakingAccrual(
      ownerAccount,
      stakingToken.address,
      rewardToken.address,
    );

    expect(await rewardContract.stakingToken()).to.equal(stakingToken.address);
    expect(await rewardContract.accrualToken()).to.equal(rewardToken.address);
  });

  async function getStakingContractAs(caller: SignerWithAddress) {
    return await new TokenStakingAccrualFactory(caller).attach(
      rewardContract.address,
    );
  }

  async function stakeTokens(
    contract: TokenStakingAccrual,
    tokens: BigNumberish,
    caller: SignerWithAddress,
  ) {
    await stakingToken.mintShare(caller.address, tokens);
    await Token.approve(stakingToken.address, caller, contract.address, tokens);
    await contract.stake(tokens);
  }

  it('should be able to stake tokens', async () => {
    const rewardContract = await getStakingContractAs(userAccount);
    await stakeTokens(rewardContract, 100, userAccount);
    expect(await rewardContract.getUserBalance(userAccount.address)).to.equal(
      BigNumber.from(100),
    );
    expect(await rewardContract.getTotalBalance()).to.equal(
      BigNumber.from(100),
    );
  });

  it('should be able to withdraw tokens', async () => {
    const rewardContract = await getStakingContractAs(userAccount);
    await stakeTokens(rewardContract, 100, userAccount);
    await rewardContract.unstake(100);
    expect(await rewardContract.getUserBalance(userAccount.address)).to.equal(
      BigNumber.from(0),
    );
    expect(await rewardContract.getTotalBalance()).to.equal(BigNumber.from(0));
  });

  it('should be able to claim fees', async () => {
    const DEPOSIT_AMOUNT = utils.parseEther('100');

    const userRewardContract = await getStakingContractAs(userAccount);
    await stakeTokens(userRewardContract, DEPOSIT_AMOUNT, userAccount);

    const adminRewardContract = await getStakingContractAs(ownerAccount);
    await stakeTokens(adminRewardContract, DEPOSIT_AMOUNT, ownerAccount);

    await rewardToken.mintShare(rewardContract.address, DEPOSIT_AMOUNT);

    await rewardContract.claimFor(userAccount.address);
    await rewardContract.claimFor(ownerAccount.address);

    expect(
      (await rewardToken.balanceOf(userAccount.address)).toString(),
    ).to.equal(utils.parseEther('50').toString());

    expect(
      (await rewardToken.balanceOf(ownerAccount.address)).toString(),
    ).to.equal(utils.parseEther('50').toString());

    await expectRevert(rewardContract.claimFor(userAccount.address));
    await expectRevert(rewardContract.claimFor(ownerAccount.address));

    await rewardToken.mintShare(rewardContract.address, DEPOSIT_AMOUNT);

    await rewardContract.claimFor(userAccount.address);
    await rewardContract.claimFor(ownerAccount.address);

    expect(
      (await rewardToken.balanceOf(userAccount.address)).toString(),
    ).to.equal(utils.parseEther('100').toString());

    expect(
      (await rewardToken.balanceOf(ownerAccount.address)).toString(),
    ).to.equal(utils.parseEther('100').toString());
  });

  it('should be able to exit', async () => {
    const DEPOSIT_AMOUNT = utils.parseEther('100');

    const rewardContract = await getStakingContractAs(userAccount);

    const preBalance = await stakingToken.balanceOf(userAccount.address);

    await stakeTokens(rewardContract, DEPOSIT_AMOUNT, userAccount);
    await rewardContract.unstake(DEPOSIT_AMOUNT);

    expect(await stakingToken.balanceOf(userAccount.address)).to.equal(
      DEPOSIT_AMOUNT.add(preBalance),
    );
  });
});
