import 'module-alias/register';

import simpleDescribe from '@test/helpers/simpleDescribe';
import { ITestContext } from '@test/helpers/simpleDescribe';
import { Wallet, ethers } from 'ethers';
import {
  AddressAccrual,
  TokenStakingAccrual,
  KYFV2,
  ArcxToken,
  MockRewardCampaign,
} from '@src/typings';
import { TestToken } from '@src/typings/TestToken';
import { AddressZero } from 'ethers/constants';
import Token from '@src/utils/Token';
import { EVM } from '../../helpers/EVM';
import { generatedWallets } from '../../../src/utils/generatedWallets';
import { expectRevert } from '../../../src/utils/expectRevert';
import ArcNumber from '@src/utils/ArcNumber';
import { BigNumber, BigNumberish } from 'ethers/utils';
import { D1TestArc } from '../../../src/D1TestArc';
import { ArcProxy } from '@src/typings';
import ArcDecimal from '@src/utils/ArcDecimal';
import { getWaffleExpect } from '../../helpers/testingUtils';

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
let rewardPool: MockRewardCampaign;
let kermanStaking: TokenStakingAccrual;
let kyf: KYFV2;
let arc: D1TestArc;

const expect = getWaffleExpect();

const provider = new ethers.providers.JsonRpcProvider();
const evm = new EVM(provider);

let wallets = generatedWallets(provider);
let positionId: BigNumberish;

describe('Staking Integration', () => {
  ownerWallet = wallets[0];
  userWallet = wallets[1];
  investorWallet = wallets[2];
  kermanWallet = wallets[3];
  arcFoundationWallet = wallets[4];
  kermanInvestorWallet1 = wallets[5];
  kermanInvestorWallet2 = wallets[6];

  before(async () => {
    arcToken = await ArcxToken.deploy(ownerWallet);
    stakingToken = await TestToken.deploy(ownerWallet, 'BPT', 'BPT');
    kermanToken = await TestToken.deploy(ownerWallet, 'KERMAN', 'KERMAN');
    arcDAO = await AddressAccrual.deploy(ownerWallet, arcToken.address);

    rewardPool = await MockRewardCampaign.deploy(
      ownerWallet,
      arcDAO.address,
      ownerWallet.address,
      arcToken.address,
      stakingToken.address,
    );

    rewardPool = await MockRewardCampaign.at(
      ownerWallet,
      (await ArcProxy.deploy(ownerWallet, rewardPool.address, ownerWallet.address, [])).address,
    );
    kermanStaking = await TokenStakingAccrual.deploy(
      ownerWallet,
      kermanToken.address,
      arcToken.address,
    );

    kyf = await KYFV2.deploy(ownerWallet);

    arc = await D1TestArc.init(ownerWallet);
    await arc.deployTestArc();

    await rewardPool.init(
      arcDAO.address,
      ownerWallet.address,
      arcToken.address,
      stakingToken.address,
      ArcDecimal.new(0.4),
      ArcDecimal.new(1),
      arc.state.address,
      100,
      1,
      100,
    );

    const result = await arc._borrowSynthetic(100, 1000, userWallet);
    positionId = result.params.id;

    await kyf.setVerifier(ownerWallet.address);
    await kyf.setHardCap(10);

    await rewardPool.setApprovedKYFInstance(kyf.address, true);
    await rewardPool.setRewardsDuration(100);
  });

  it('should be able to get verified', async () => {
    const hash = ethers.utils.solidityKeccak256(['address'], [userWallet.address]);
    const signedMessage = await ownerWallet.signMessage(ethers.utils.arrayify(hash));
    const signature = ethers.utils.splitSignature(signedMessage);

    await kyf.verify(userWallet.address, signature.v, signature.r, signature.s);

    expect(await kyf.checkVerified(userWallet.address)).to.be.true;
  });

  it('should be able to stake', async () => {
    await stakingToken.mintShare(userWallet.address, 100);
    await Token.approve(stakingToken.address, userWallet, rewardPool.address, 100);

    const userRewardPool = await MockRewardCampaign.at(userWallet, rewardPool.address);
    await userRewardPool.stake(100, positionId);

    expect((await userRewardPool.balanceOf(userWallet.address)).toNumber()).to.equal(100);
  });

  it('should be able to enable claims', async () => {
    // Dump 100 ARC tokens into the rewards contract
    await arcToken.mint(rewardPool.address, 100);

    // Set the time period for the rewards amount to 100
    await rewardPool.notifyRewardAmount(100);

    // Increase the time to 200 to get to the end of the reward period + debt deadline
    await rewardPool.setCurrentTimestamp(200);

    const userRewardPool = await MockRewardCampaign.at(userWallet, rewardPool.address);
    await expectRevert(userRewardPool.getReward(userWallet.address));
    await expectRevert(userRewardPool.setTokensClaimable(true));

    await rewardPool.setTokensClaimable(true);
    await userRewardPool.getReward(userWallet.address);

    expect(await (await arcToken.balanceOf(userWallet.address)).toNumber()).to.be.gte(
      new BigNumber(100).mul(6).div(10).toNumber(),
    );
    expect(await (await arcToken.balanceOf(arcDAO.address)).toNumber()).to.be.gte(
      new BigNumber(100).mul(4).div(10).toNumber(),
    );
  });

  it('should be able to claim tokens as an investor', async () => {
    await arcDAO.increaseShare(investorWallet.address, 25);
    await arcDAO.increaseShare(kermanStaking.address, 25);
    await arcDAO.increaseShare(kermanWallet.address, 25);
    await arcDAO.increaseShare(arcFoundationWallet.address, 25);

    await arcDAO.updateFees();

    const expectedBalance = 40;

    expect(await (await arcDAO.accruedBalance()).toNumber()).to.be.gte(40);

    expect(await arcToken.balanceOf(investorWallet.address)).to.equal(ArcNumber.new(0));
    expect(await arcToken.balanceOf(kermanStaking.address)).to.equal(ArcNumber.new(0));
    expect(await arcToken.balanceOf(kermanWallet.address)).to.equal(ArcNumber.new(0));
    expect(await arcToken.balanceOf(arcFoundationWallet.address)).to.equal(ArcNumber.new(0));

    await arcDAO.claimFor(investorWallet.address);
    await arcDAO.claimFor(kermanStaking.address);
    await arcDAO.claimFor(kermanWallet.address);
    await arcDAO.claimFor(arcFoundationWallet.address);

    expect(await arcToken.balanceOf(investorWallet.address)).to.equal(
      new BigNumber(expectedBalance).div(4),
    );
    expect(await arcToken.balanceOf(kermanStaking.address)).to.equal(
      new BigNumber(expectedBalance).div(4),
    );
    expect(await arcToken.balanceOf(kermanWallet.address)).to.equal(
      new BigNumber(expectedBalance).div(4),
    );
    expect(await arcToken.balanceOf(arcFoundationWallet.address)).to.equal(
      new BigNumber(expectedBalance).div(4),
    );
  });

  it('should be able to claim tokens as a KERMAN holder', async () => {
    expect(await arcToken.balanceOf(kermanInvestorWallet1.address)).to.equal(new BigNumber(0));
    expect(await arcToken.balanceOf(kermanInvestorWallet2.address)).to.equal(new BigNumber(0));

    await kermanToken.mintShare(kermanInvestorWallet1.address, 50);
    await kermanToken.mintShare(kermanInvestorWallet2.address, 50);

    await Token.approve(kermanToken.address, kermanInvestorWallet1, kermanStaking.address, 50);
    await Token.approve(kermanToken.address, kermanInvestorWallet2, kermanStaking.address, 50);

    await TokenStakingAccrual.at(kermanInvestorWallet1, kermanStaking.address).stake(50);
    await TokenStakingAccrual.at(kermanInvestorWallet2, kermanStaking.address).stake(50);

    await kermanStaking.claimFor(kermanInvestorWallet1.address);
    await kermanStaking.claimFor(kermanInvestorWallet2.address);

    expect(await arcToken.balanceOf(kermanInvestorWallet1.address)).to.equal(new BigNumber(5));
    expect(await arcToken.balanceOf(kermanInvestorWallet2.address)).to.equal(new BigNumber(5));
  });
});
