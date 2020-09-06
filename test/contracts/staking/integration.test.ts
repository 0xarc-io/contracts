import 'jest';

import simpleDescribe from '@test/helpers/simpleDescribe';
import { ITestContext } from '@test/helpers/simpleDescribe';
import { Wallet, ethers } from 'ethers';
import {
  AddressAccrual,
  StakingRewardsAccrualCapped,
  TokenStakingAccrual,
  KYFV2,
  ArcxToken,
} from '@src/typings';
import { TestToken } from '@src/typings/TestToken';
import { AddressZero } from 'ethers/constants';
import Token from '@src/utils/Token';
import { EVM } from '../../helpers/EVM';
import { generatedWallets } from '../../../src/utils/generatedWallets';
import { expectRevert } from '../../../src/utils/expectRevert';
import ArcNumber from '@src/utils/ArcNumber';
import { BigNumber } from 'ethers/utils';

let ownerWallet: Wallet;
let userWallet: Wallet;
let investorWallet: Wallet;
let kermanInvestorWallet1: Wallet;
let kermanInvestorWallet2: Wallet;
let kermanWallet: Wallet;
let arcFoundationWallet: Wallet;

let arcToken: ArcxToken;
let stakingToken: TestToken;
let kermanToken: TestToken;
let arcDAO: AddressAccrual;
let rewardPool: StakingRewardsAccrualCapped;
let kermanStaking: TokenStakingAccrual;
let kyf: KYFV2;

jest.setTimeout(30000);

const provider = new ethers.providers.JsonRpcProvider();
const evm = new EVM(provider);

let wallets = generatedWallets(provider);

describe('Staking Integration', () => {
  ownerWallet = wallets[0];
  userWallet = wallets[1];
  investorWallet = wallets[2];
  kermanWallet = wallets[3];
  arcFoundationWallet = wallets[4];
  kermanInvestorWallet1 = wallets[5];
  kermanInvestorWallet2 = wallets[6];

  beforeAll(async () => {
    arcToken = await ArcxToken.deploy(ownerWallet);
    stakingToken = await TestToken.deploy(ownerWallet, 'BPT', 'BPT');
    kermanToken = await TestToken.deploy(ownerWallet, 'KERMAN', 'KERMAN');
    arcDAO = await AddressAccrual.deploy(ownerWallet, arcToken.address);

    rewardPool = await StakingRewardsAccrualCapped.deploy(
      ownerWallet,
      arcDAO.address,
      ownerWallet.address,
      arcToken.address,
      stakingToken.address,
      AddressZero,
    );

    kermanStaking = await TokenStakingAccrual.deploy(
      ownerWallet,
      kermanToken.address,
      arcToken.address,
    );

    kyf = await KYFV2.deploy(ownerWallet);

    await kyf.setVerifier(ownerWallet.address);
    await kyf.setHardCap(10);

    await rewardPool.setApprovedKYFInstance(kyf.address, true);
    await rewardPool.setStakeHardCap(100);

    await rewardPool.setRewardsDistribution(ownerWallet.address);
    await rewardPool.setRewardsDuration(100);
  });

  it('should be able to get verified', async () => {
    const hash = ethers.utils.solidityKeccak256(['address'], [userWallet.address]);
    const signedMessage = await ownerWallet.signMessage(ethers.utils.arrayify(hash));
    const signature = ethers.utils.splitSignature(signedMessage);

    await kyf.verify(userWallet.address, signature.v, signature.r, signature.s);

    expect(await kyf.checkVerified(userWallet.address)).toBeTruthy();
  });

  it('should be able to stake', async () => {
    await stakingToken.mintShare(userWallet.address, 100);
    await Token.approve(stakingToken.address, userWallet, rewardPool.address, 100);

    const userRewardPool = await StakingRewardsAccrualCapped.at(userWallet, rewardPool.address);
    await userRewardPool.stake(100);

    expect((await userRewardPool.balanceOf(userWallet.address)).toNumber()).toEqual(100);
  });

  it('should be able to increase the staking hard cap and let users stake more', async () => {
    const userRewardPool = await StakingRewardsAccrualCapped.at(userWallet, rewardPool.address);

    await stakingToken.mintShare(userWallet.address, 100);
    await Token.approve(stakingToken.address, userWallet, rewardPool.address, 100);

    await expectRevert(userRewardPool.stake(100));
    await rewardPool.setStakeHardCap(200);
    await userRewardPool.stake(100);

    expect((await userRewardPool.balanceOf(userWallet.address)).toNumber()).toEqual(200);
  });

  it('should be able to enable claims', async () => {
    // Dump 100 ARC tokens into the rewards contract
    await arcToken.mint(rewardPool.address, 100);

    // Set the time period for the rewards amount to 100
    await rewardPool.notifyRewardAmount(100);

    // Increase the time by 100 to get to the end of the reward period
    await evm.increaseTime(100);
    await evm.mineBlock();

    const userRewardPool = await StakingRewardsAccrualCapped.at(userWallet, rewardPool.address);
    await expectRevert(userRewardPool.getReward());
    await expectRevert(userRewardPool.setTokensClaimable(true));

    await rewardPool.setTokensClaimable(true);
    await userRewardPool.getReward();

    expect(await (await arcToken.balanceOf(userWallet.address)).toNumber()).toBeGreaterThanOrEqual(
      new BigNumber(100).mul(2).div(3).toNumber(),
    );
    expect(await (await arcToken.balanceOf(arcDAO.address)).toNumber()).toBeGreaterThanOrEqual(
      new BigNumber(100).div(3).toNumber(),
    );
  });

  it('should be able to claim tokens as an investor', async () => {
    await arcDAO.increaseShare(investorWallet.address, 25);
    await arcDAO.increaseShare(kermanStaking.address, 25);
    await arcDAO.increaseShare(kermanWallet.address, 25);
    await arcDAO.increaseShare(arcFoundationWallet.address, 25);

    await arcDAO.updateFees();

    expect(await (await arcDAO.accruedBalance()).toNumber()).toBeGreaterThanOrEqual(33);

    expect(await arcToken.balanceOf(investorWallet.address)).toEqual(ArcNumber.new(0));
    expect(await arcToken.balanceOf(kermanStaking.address)).toEqual(ArcNumber.new(0));
    expect(await arcToken.balanceOf(kermanWallet.address)).toEqual(ArcNumber.new(0));
    expect(await arcToken.balanceOf(arcFoundationWallet.address)).toEqual(ArcNumber.new(0));

    await arcDAO.claimFor(investorWallet.address);
    await arcDAO.claimFor(kermanStaking.address);
    await arcDAO.claimFor(kermanWallet.address);
    await arcDAO.claimFor(arcFoundationWallet.address);

    expect(await arcToken.balanceOf(investorWallet.address)).toEqual(new BigNumber(8));
    expect(await arcToken.balanceOf(kermanStaking.address)).toEqual(new BigNumber(8));
    expect(await arcToken.balanceOf(kermanWallet.address)).toEqual(new BigNumber(8));
    expect(await arcToken.balanceOf(arcFoundationWallet.address)).toEqual(new BigNumber(8));
  });

  it('should be able to claim tokens as a KERMAN holder', async () => {
    expect(await arcToken.balanceOf(kermanInvestorWallet1.address)).toEqual(new BigNumber(0));
    expect(await arcToken.balanceOf(kermanInvestorWallet2.address)).toEqual(new BigNumber(0));

    await kermanToken.mintShare(kermanInvestorWallet1.address, 50);
    await kermanToken.mintShare(kermanInvestorWallet2.address, 50);

    await Token.approve(kermanToken.address, kermanInvestorWallet1, kermanStaking.address, 50);
    await Token.approve(kermanToken.address, kermanInvestorWallet2, kermanStaking.address, 50);

    await TokenStakingAccrual.at(kermanInvestorWallet1, kermanStaking.address).stake(50);
    await TokenStakingAccrual.at(kermanInvestorWallet2, kermanStaking.address).stake(50);

    await kermanStaking.claimFor(kermanInvestorWallet1.address);
    await kermanStaking.claimFor(kermanInvestorWallet2.address);

    expect(await arcToken.balanceOf(kermanInvestorWallet1.address)).toEqual(new BigNumber(4));
    expect(await arcToken.balanceOf(kermanInvestorWallet2.address)).toEqual(new BigNumber(4));
  });
});
