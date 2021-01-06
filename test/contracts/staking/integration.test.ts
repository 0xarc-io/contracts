import 'module-alias/register';

import { BigNumber, BigNumberish } from 'ethers';
import { expect } from 'chai';

import ArcDecimal from '@src/utils/ArcDecimal';
import ArcNumber from '@src/utils/ArcNumber';
import { expectRevert } from '@test/helpers/expectRevert';
import { AddressAccrual } from '@src/typings/AddressAccrual';
import { TestToken } from '@src/typings/TestToken';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { ArcxToken } from '@src/typings/ArcxToken';
import { TokenStakingAccrual } from '@src/typings/TokenStakingAccrual';
import { KYFV2 } from '@src/typings/KYFV2';
import Token from '@src/utils/Token';
import { MockRewardCampaign } from '@src/typings/MockRewardCampaign';
import { generateContext, ITestContext } from '../context';
import { spritzFixture } from '../fixtures';
import { SpritzTestArc } from '../../../src/SpritzTestArc';
import { ArcxTokenFactory } from '@src/typings/ArcxTokenFactory';
import { MockRewardCampaignFactory } from '@src/typings/MockRewardCampaignFactory';
import { ArcProxyFactory } from '@src/typings/ArcProxyFactory';
import { TokenStakingAccrualFactory } from '@src/typings/TokenStakingAccrualFactory';
import {
  deployAddressAccrual,
  deployTestToken,
  deployMockRewardCampaign,
  deployTokenStakingAccrual,
  deployKyfV2,
} from '../deployers';

let ownerWallet: SignerWithAddress;
let userWallet: SignerWithAddress;
let investorWallet: SignerWithAddress;
let kermanInvestorWallet1: SignerWithAddress;
let kermanInvestorWallet2: SignerWithAddress;
let kermanWallet: SignerWithAddress;
let arcFoundationWallet: SignerWithAddress;

let arcToken: ArcxToken;
let stakingToken: TestToken;
let kermanToken: TestToken;
let arcDAO: AddressAccrual;
let rewardPool: MockRewardCampaign;
let kermanStaking: TokenStakingAccrual;
let kyf: KYFV2;

describe('Staking Integration', () => {
  let ctx: ITestContext;
  let arc: SpritzTestArc;
  let positionId: BigNumberish;

  async function init(ctx: ITestContext): Promise<void> {
    const signers = await ethers.getSigners();
    ownerWallet = signers[0];
    userWallet = signers[1];
    investorWallet = signers[2];
    kermanWallet = signers[3];
    arcFoundationWallet = signers[4];
    kermanInvestorWallet1 = signers[5];
    kermanInvestorWallet2 = signers[6];
  }

  before(async () => {
    ctx = await generateContext(spritzFixture, init);
    arc = ctx.sdks.spritz;

    arcToken = await new ArcxTokenFactory(ownerWallet).deploy();
    stakingToken = await deployTestToken(ownerWallet, 'BPT', 'BPT');
    kermanToken = await deployTestToken(ownerWallet, 'KERMAN', 'KERMAN');

    arcDAO = await deployAddressAccrual(ownerWallet, arcToken.address);

    rewardPool = await deployMockRewardCampaign(
      ownerWallet,
      arcDAO.address,
      ownerWallet.address,
      arcToken.address,
      stakingToken.address,
    );

    rewardPool = await new MockRewardCampaignFactory(ownerWallet).attach(
      (await new ArcProxyFactory(ownerWallet).deploy(rewardPool.address, ownerWallet.address, []))
        .address,
    );

    kermanStaking = await deployTokenStakingAccrual(
      ownerWallet,
      kermanToken.address,
      arcToken.address,
    );

    kyf = await deployKyfV2(ownerWallet);

    await rewardPool.init(
      arcDAO.address,
      ownerWallet.address,
      arcToken.address,
      stakingToken.address,
      ArcDecimal.new(0.4),
      ArcDecimal.new(1),
      100,
      1,
      100,
    );

    const result = await arc._borrowSynthetic(100, 1000, userWallet);
    positionId = result.params.id;

    await kyf.setVerifier(ownerWallet.address);
    await kyf.setHardCap(10);

    await rewardPool.setApprovedKYFInstance(kyf.address, true);
    await rewardPool.setApprovedStateContract(arc.core.address);
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

    const userRewardPool = await new MockRewardCampaignFactory(userWallet).attach(
      rewardPool.address,
    );
    await userRewardPool.stake(100, positionId, arc.core.address);

    expect((await userRewardPool.balanceOf(userWallet.address)).toNumber()).to.equal(100);
  });

  it('should be able to enable claims', async () => {
    // Dump 100 ARC tokens into the rewards contract
    await arcToken.mint(rewardPool.address, 100);

    // Set the time period for the rewards amount to 100
    await rewardPool.notifyRewardAmount(100);

    // Increase the time to 200 to get to the end of the reward period + debt deadline
    await rewardPool.setCurrentTimestamp(200);

    const userRewardPool = await new MockRewardCampaignFactory(userWallet).attach(
      rewardPool.address,
    );
    await expectRevert(userRewardPool.getReward(userWallet.address));
    await expectRevert(userRewardPool.setTokensClaimable(true));

    await rewardPool.setTokensClaimable(true);
    await userRewardPool.getReward(userWallet.address);

    expect(await (await arcToken.balanceOf(userWallet.address)).toNumber()).to.be.gte(
      BigNumber.from(100).mul(6).div(10).toNumber(),
    );
    expect(await (await arcToken.balanceOf(arcDAO.address)).toNumber()).to.be.gte(
      BigNumber.from(100).mul(4).div(10).toNumber(),
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
      BigNumber.from(expectedBalance).div(4),
    );
    expect(await arcToken.balanceOf(kermanStaking.address)).to.equal(
      BigNumber.from(expectedBalance).div(4),
    );
    expect(await arcToken.balanceOf(kermanWallet.address)).to.equal(
      BigNumber.from(expectedBalance).div(4),
    );
    expect(await arcToken.balanceOf(arcFoundationWallet.address)).to.equal(
      BigNumber.from(expectedBalance).div(4),
    );
  });

  it('should be able to claim tokens as a KERMAN holder', async () => {
    expect(await arcToken.balanceOf(kermanInvestorWallet1.address)).to.equal(BigNumber.from(0));
    expect(await arcToken.balanceOf(kermanInvestorWallet2.address)).to.equal(BigNumber.from(0));

    await kermanToken.mintShare(kermanInvestorWallet1.address, 50);
    await kermanToken.mintShare(kermanInvestorWallet2.address, 50);

    await Token.approve(kermanToken.address, kermanInvestorWallet1, kermanStaking.address, 50);
    await Token.approve(kermanToken.address, kermanInvestorWallet2, kermanStaking.address, 50);

    await new TokenStakingAccrualFactory(kermanInvestorWallet1)
      .attach(kermanStaking.address)
      .stake(50);
    await new TokenStakingAccrualFactory(kermanInvestorWallet2)
      .attach(kermanStaking.address)
      .stake(50);

    await kermanStaking.claimFor(kermanInvestorWallet1.address);
    await kermanStaking.claimFor(kermanInvestorWallet2.address);

    expect(await arcToken.balanceOf(kermanInvestorWallet1.address)).to.equal(BigNumber.from(5));
    expect(await arcToken.balanceOf(kermanInvestorWallet2.address)).to.equal(BigNumber.from(5));
  });
});
