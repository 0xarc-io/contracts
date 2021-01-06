import 'module-alias/register';

import { BigNumber, BigNumberish } from 'ethers';
import { expect } from 'chai';

import ArcDecimal from '@src/utils/ArcDecimal';
import ArcNumber from '@src/utils/ArcNumber';
import { expectRevert } from '@test/helpers/expectRevert';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ethers } from 'hardhat';
import { TestToken } from '@src/typings/TestToken';
import { MockRewardCampaign } from '@src/typings/MockRewardCampaign';
import { generateContext, ITestContext } from '../context';
import { mozartFixture } from '../fixtures';

import Token from '@src/utils/Token';
import { TestTokenFactory } from '@src/typings/TestTokenFactory';
import { MockRewardCampaignFactory } from '@src/typings/MockRewardCampaignFactory';
import { ArcProxyFactory } from '@src/typings/ArcProxyFactory';
import { deployMockRewardCampaign, deployTestToken } from '../deployers';
import { MozartTestArc } from '../../../src/MozartTestArc';
import { setupMozart } from '../setup';
import { MAX_UINT256, TEN_PERCENT } from '../../../src/constants';
import { ArcProxy, MozartCoreV2, MozartCoreV2Factory } from '@src/typings';

let ownerAccount: SignerWithAddress;
let userAccount: SignerWithAddress;
let slasherAccount: SignerWithAddress;
let distributionAccount: SignerWithAddress;

let stakingRewards: MockRewardCampaign;

let stakingToken: TestToken;
let rewardToken: TestToken;

const BASE = BigNumber.from(10).pow(18);

describe('RewardCampaign', () => {
  let arc: MozartTestArc;
  let core2: MozartCoreV2;
  let core2proxy: ArcProxy;

  const DAO_ALLOCATION = ArcDecimal.new(0.4);
  const SLAHSER_CUT = ArcDecimal.new(0.3);
  const USER_ALLOCATION = ArcDecimal.new(1).value.sub(DAO_ALLOCATION.value);
  const DEBT_TO_STAKE = 2;
  const REWARDS_END_DATE = 100;
  const VESTING_END_DATE = 200;
  const HARD_CAP = ArcNumber.new(2100);
  const REWARD_AMOUNT = ArcNumber.new(100);
  const DEBT_AMOUNT = HARD_CAP.div(DEBT_TO_STAKE); //1050
  const COLLATERAL_AMOUNT = DEBT_AMOUNT.mul(2); // 2100

  async function init(ctx: ITestContext): Promise<void> {
    const signers = await ethers.getSigners();
    ownerAccount = signers[0];
    userAccount = signers[1];
    slasherAccount = signers[2];
    distributionAccount = signers[3];

    await setupMozart(ctx, {
      oraclePrice: ArcDecimal.new(1).value,
      collateralRatio: ArcDecimal.new(DEBT_TO_STAKE).value,
      interestRate: TEN_PERCENT,
    });
  }

  async function setup() {
    const ctx: ITestContext = await generateContext(mozartFixture, init);

    arc = ctx.sdks.mozart;

    stakingToken = await deployTestToken(ownerAccount, 'LINKUSD/USDC 50/50', 'BPT');
    rewardToken = await deployTestToken(ownerAccount, 'Arc Token', 'ARC');

    stakingRewards = await deployMockRewardCampaign(
      ownerAccount,
      ownerAccount.address,
      distributionAccount.address,
      rewardToken.address,
      stakingToken.address,
    );

    stakingRewards = await new MockRewardCampaignFactory(ownerAccount).attach(
      (
        await new ArcProxyFactory(ownerAccount).deploy(
          stakingRewards.address,
          ownerAccount.address,
          [],
        )
      ).address,
    );

    await rewardToken.mintShare(stakingRewards.address, REWARD_AMOUNT);

    await stakingRewards.setCurrentTimestamp(0);
    await stakingRewards.setRewardsDistributor(ownerAccount.address);
    await stakingRewards.setRewardsDuration(REWARDS_END_DATE);

    await stakingRewards.init(
      ownerAccount.address,
      ownerAccount.address,
      rewardToken.address,
      stakingToken.address,
      DAO_ALLOCATION,
      SLAHSER_CUT,
      VESTING_END_DATE,
      DEBT_TO_STAKE,
      HARD_CAP,
    );
    await stakingRewards.setApprovedStateContract(arc.coreAddress());

    await stakingRewards.notifyRewardAmount(REWARD_AMOUNT);
  }

  async function deploySecondCore() {
    core2proxy =  await new ArcProxyFactory(ownerAccount).deploy(
      await (await new MozartCoreV2Factory(ownerAccount).deploy()).address,
      await ownerAccount.getAddress(),
      [],
    );
    core2 = MozartCoreV2Factory.connect(core2proxy.address, ownerAccount);
    await core2.init(
      18,
      arc.collateral().address,
      arc.syntheticAddress(),
      await arc.core().getCurrentOracle(),
      await ownerAccount.getAddress(),
      {value: ArcNumber.new(2)},
      {value: ArcDecimal.new(0.1).value},
      {value: 0}
    );

    const collateralAddress = await core2.getCollateralAsset();
    await Token.approve(
      collateralAddress,
      userAccount,
      core2proxy.address,
      COLLATERAL_AMOUNT
    );
    
    await arc.synthetic().addMinter(
      core2proxy.address,
      MAX_UINT256,
    );

    await arc.addSynths({ TESTX: core2.address });
  }

  /* ========== Helpers ========== */

  async function getContract(caller: SignerWithAddress) {
    return new MockRewardCampaignFactory(caller).attach(stakingRewards.address);
  }

  // async function verifyUserIn(kyf: KYFV2, address: string = userAccount.address) {
  //   const hash = ethers.utils.solidityKeccak256(['address'], [address]);
  //   const signedMessage = await ownerAccount.signMessage(ethers.utils.arrayify(hash));
  //   const signature = ethers.utils.splitSignature(signedMessage);
  //   await kyf.verify(address, signature.v, signature.r, signature.s);
  // }

  // async function approve(kyf: KYFV2) {
  //   await stakingRewards.setApprovedKYFInstance(kyf.address, true);
  // }

  async function mint(amount: BigNumberish, account: SignerWithAddress) {
    await stakingToken.mintShare(account.address, amount);
    await Token.approve(
      stakingToken.address,
      account,
      stakingRewards.address,
      BigNumber.from(amount).mul(10),
    );
  }

  async function stake(
    amount: BigNumberish, 
    id: BigNumberish, 
    wallet: SignerWithAddress, 
    stateContract: string
  ) {
    const userStaking = await getContract(wallet);
    await userStaking.stake(amount, id, stateContract);
  }

  async function slash(user: string, wallet: SignerWithAddress) {
    const slasherStaking = await getContract(wallet);
    await slasherStaking.slash(user);
  }

  async function getReward(wallet: SignerWithAddress) {
    const userStaking = await getContract(wallet);
    await userStaking.getReward(wallet.address);
  }

  /* ========== Public fuctions ========== */

  describe('#stake', () => {
    let positionId: BigNumberish;
    let altPositionId: BigNumberish;

    beforeEach(setup);

    beforeEach(async () => {
      const result1 = await arc.openPosition(COLLATERAL_AMOUNT, DEBT_AMOUNT, userAccount);
      positionId = result1.params.id;

      const result2 = await arc.openPosition(COLLATERAL_AMOUNT, DEBT_AMOUNT, slasherAccount);
      altPositionId = result2.params.id;
    });

    it('should not be able to stake over the hard cap', async () => {
      await mint(HARD_CAP.add(1), userAccount);
      await expectRevert(stake(HARD_CAP.add(1), positionId, userAccount, arc.coreAddress()));
    });

    it('should not be able to stake over the hard cap in total', async () => {
      await mint(HARD_CAP.mul(3), userAccount);
      await stake(HARD_CAP, positionId, userAccount, arc.coreAddress());
      await expectRevert(stake(HARD_CAP, positionId, userAccount, arc.coreAddress()));
    });

    it('should not be able to stake without a valid debt position owned by the same user', async () => {
      await mint(HARD_CAP, userAccount);
      await expectRevert(stake(HARD_CAP, altPositionId, userAccount, arc.coreAddress()));
    });

    it('should not be able to stake 1/2 of the hard cap with less than 1/2 the debt', async () => {
      await mint(HARD_CAP, userAccount);

      const newPosition = await arc.openPosition(
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT.div(2),
        userAccount,
      );
      await expectRevert(stake(HARD_CAP, newPosition.params.id, userAccount, arc.coreAddress()));
    });

    it('should be able to stake 1/2 of the hard cap with 1/2 the debt', async () => {
      await mint(HARD_CAP.div(2), userAccount);

      const newPosition = await arc.openPosition(
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT.div(2),
        userAccount,
      );
      await stake(HARD_CAP.div(2), newPosition.params.id, userAccount, arc.coreAddress());

      const stakerDetails = await stakingRewards.stakers(userAccount.address);
      expect(stakerDetails.balance).to.equal(HARD_CAP.div(2));
      expect(stakerDetails.debtSnapshot).to.equal(DEBT_AMOUNT.div(2));
      expect(stakerDetails.positionId).to.equal(newPosition.params.id);
      expect(stakerDetails.rewardsEarned).to.equal(ArcNumber.new(0));
      expect(stakerDetails.rewardPerTokenPaid).to.equal(ArcNumber.new(0));
    });

    it('should not be able to stake the full amount with less debt', async () => {
      await mint(HARD_CAP, userAccount);

      const newPosition = await arc.openPosition(
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT.div(2),
        userAccount,
      );
      await expectRevert(stake(HARD_CAP, newPosition.params.id, userAccount, arc.coreAddress()));
    });

    it('should be able to stake the maximum with the correct debt amount', async () => {
      await mint(HARD_CAP, userAccount);
      await stake(HARD_CAP, positionId, userAccount, arc.coreAddress());

      const stakerDetails = await stakingRewards.stakers(userAccount.address);
      expect(stakerDetails.balance).to.equal(HARD_CAP);
      expect(stakerDetails.debtSnapshot).to.equal(DEBT_AMOUNT);
      expect(stakerDetails.positionId).to.equal(positionId);
      expect(stakerDetails.rewardsEarned).to.equal(ArcNumber.new(0));
      expect(stakerDetails.rewardPerTokenPaid).to.equal(ArcNumber.new(0));
    });

    it('should not be able to set a lower debt requirement by staking less before the deadline', async () => {
      /**
       * stake to debt ratio is 2
       * debt amt is 500
       * stake 1000 lp tokens
       * 
       * do:
       *  stake additional 100 lp
       */

      const collateralAmount = ArcNumber.new(1000);
      const debtAmount = collateralAmount.div(2);
      const additionalStakeAmount = ArcNumber.new(100);
       
      await mint(collateralAmount, userAccount);

      const positionResult = await arc.openPosition(
        collateralAmount,
        debtAmount,
        userAccount
      );
      const newPositionId = positionResult.params.id;
      
      await mint(collateralAmount, userAccount);
      await stake(collateralAmount, newPositionId, userAccount, arc.coreAddress());

      await mint(additionalStakeAmount, userAccount);
      await expect(
        stake(additionalStakeAmount, newPositionId, userAccount, arc.coreAddress()),
      ).to.be.revertedWith('Must be a valid minter');
    });

    it('should not be able to stake to an unnaproved state contract', async () => {
      await deploySecondCore();
      await mint(HARD_CAP, userAccount);
      await expectRevert(
        stake(
          HARD_CAP, 
          positionId, 
          userAccount, 
          core2.address
        )
      );
    });

    it('should be able to stake to a second state contract', async () => {
      await deploySecondCore();
      await mint(HARD_CAP, userAccount);

      await stakingRewards.setApprovedStateContract(core2.address);

      // Open position on second core
      await Token.approve(
        await core2.getCollateralAsset(),
        userAccount,
        core2proxy.address,
        COLLATERAL_AMOUNT
      );
      const positionResult = await arc.openPosition(
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT,
        userAccount,
        arc.synths.TESTX
      )
      const secondPositionId = positionResult.params.id;
      
      await stake(HARD_CAP, secondPositionId, userAccount, core2.address);

      const stakerDetails = await stakingRewards.stakers(userAccount.address);
      expect(stakerDetails.balance).to.equal(HARD_CAP);
      expect(stakerDetails.debtSnapshot).to.equal(DEBT_AMOUNT);
      expect(stakerDetails.positionId).to.equal(positionId);
      expect(stakerDetails.rewardsEarned).to.equal(ArcNumber.new(0));
      expect(stakerDetails.rewardPerTokenPaid).to.equal(ArcNumber.new(0));
    });

    it('should not be able to re-stake to a different state contract', async () => {
      await deploySecondCore();
      await mint(HARD_CAP, userAccount);
      await stakingRewards.setApprovedStateContract(core2.address);

      // Open position on the second core
      await Token.approve(
        await core2.getCollateralAsset(),
        userAccount,
        core2proxy.address,
        COLLATERAL_AMOUNT
      );
      const positionResult = await arc.openPosition(
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT,
        userAccount,
        arc.synths.TESTX
      )
      const secondPositionId = positionResult.params.id;
      
      await stake(HARD_CAP.div(2), positionId, userAccount, arc.coreAddress());
      await expect(
        stake(HARD_CAP.div(2), secondPositionId, userAccount, core2.address)
      ).to.be.revertedWith('Cannot re-stake to a different state contract');
    });
  });

  describe('#slash', () => {
    let userPosition: BigNumberish;

    beforeEach(async () => {
      await setup();

      const result1 = await arc.openPosition(COLLATERAL_AMOUNT, DEBT_AMOUNT, userAccount);
      userPosition = result1.params.id;

      await arc.openPosition(COLLATERAL_AMOUNT, DEBT_AMOUNT, slasherAccount);

      await mint(HARD_CAP, userAccount);
      await stake(HARD_CAP, userPosition, userAccount, arc.coreAddress());
    });

    it('should not be able to slash if user has the amount of their debt snapshot', async () => {
      await expectRevert(slash(userAccount.address, slasherAccount));
    });

    it('should not be able to slash past the vesting end date', async () => {
      await arc.repay(userPosition, DEBT_AMOUNT, 0, userAccount);
      await stakingRewards.setCurrentTimestamp(200);
      await expectRevert(slash(userAccount.address, slasherAccount));
    });

    it('should not be able to slash if the tokens are unstaked but debt is there', async () => {
      await stakingRewards.setCurrentTimestamp(100);

      const earned = await stakingRewards.earned(userAccount.address);
      expect(earned.gte(USER_ALLOCATION.mul(REWARD_AMOUNT).div(BASE).sub(100))).to.be.true;

      await expectRevert(slash(userAccount.address, slasherAccount));
    });

    it('should be able to slash if the user does not have enough debt', async () => {
      await stakingRewards.setCurrentTimestamp(100);

      await arc.repay(userPosition, DEBT_AMOUNT, 0, userAccount);

      await slash(userAccount.address, slasherAccount);

      expect(
        await (await stakingRewards.earned(slasherAccount.address)).gte(
          USER_ALLOCATION.mul(SLAHSER_CUT.value).mul(REWARD_AMOUNT).div(BASE).div(BASE).sub(100),
        ),
      ).to.be.true;

      expect(
        await (await stakingRewards.earned(ownerAccount.address)).gte(
          USER_ALLOCATION.mul(ArcNumber.new(1).sub(SLAHSER_CUT.value))
            .mul(REWARD_AMOUNT)
            .div(BASE)
            .div(BASE)
            .sub(100),
        ),
      ).to.be.true;
    });
  });

  describe('#getReward', () => {
    let userPosition: BigNumberish;

    beforeEach(setup);

    beforeEach(async () => {
      const result1 = await arc.openPosition(COLLATERAL_AMOUNT, DEBT_AMOUNT, userAccount);
      userPosition = result1.params.id;

      await arc.openPosition(COLLATERAL_AMOUNT, DEBT_AMOUNT, slasherAccount);

      await mint(HARD_CAP, userAccount);
      await stake(HARD_CAP, userPosition, userAccount, arc.coreAddress());
    });

    it('should not be able to get the reward if the tokens are not claimable after the reward period', async () => {
      await stakingRewards.setCurrentTimestamp(150);
      await expectRevert(getReward(userAccount));
    });

    it('should not be able to get the reward if the tokens are not claimable after the vesting date', async () => {
      await stakingRewards.setCurrentTimestamp(250);
      await expectRevert(getReward(userAccount));
    });

    it('should be able to claim 1/2 the rewards if 1/2 way through the vesting end date', async () => {
      await stakingRewards.setCurrentTimestamp(150);
      await stakingRewards.setTokensClaimable(true);
      await getReward(userAccount);

      expect(
        await (await rewardToken.balanceOf(userAccount.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(2).div(BASE).sub(100),
        ),
      );
    });

    it('should be able to claim rewards gradually over time', async () => {
      await stakingRewards.setTokensClaimable(true);

      await stakingRewards.setCurrentTimestamp(125);
      await getReward(userAccount);
      expect(
        await (await rewardToken.balanceOf(userAccount.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(4).div(BASE).sub(100),
        ),
      );

      await stakingRewards.setCurrentTimestamp(150);
      await getReward(userAccount);
      expect(
        await (await rewardToken.balanceOf(userAccount.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(2).div(BASE).sub(100),
        ),
      );

      await stakingRewards.setCurrentTimestamp(200);
      await getReward(userAccount);
      expect(
        await (await rewardToken.balanceOf(userAccount.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(BASE).sub(100),
        ),
      );
    });

    it('should not be able to claim rewards twice past the end of the vesting date', async () => {
      await stakingRewards.setTokensClaimable(true);
      await stakingRewards.setCurrentTimestamp(200);

      await getReward(userAccount);
      expect(
        await (await rewardToken.balanceOf(userAccount.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(BASE).sub(100),
        ),
      );

      await getReward(userAccount);
      expect(
        await (await rewardToken.balanceOf(userAccount.address)).gte(
          USER_ALLOCATION.mul(REWARD_AMOUNT).div(BASE).sub(100),
        ),
      );
    });
  });

  describe('#withdraw', () => {
    beforeEach(setup);

    it('should be able to withdraw', async () => {
      const contract = await getContract(userAccount);
      const result = await arc.openPosition(COLLATERAL_AMOUNT, DEBT_AMOUNT, userAccount);

      await mint(HARD_CAP, userAccount);
      await stake(HARD_CAP, result.params.id, userAccount, arc.coreAddress());

      expect(await stakingToken.balanceOf(userAccount.address)).to.equal(BigNumber.from(0));

      await contract.withdraw(HARD_CAP);

      expect(await stakingToken.balanceOf(userAccount.address)).to.equal(HARD_CAP);
    });
  });

  describe('#exit', () => {
    let userPosition: BigNumberish;

    beforeEach(async () => {
      await setup();

      const result = await arc.openPosition(COLLATERAL_AMOUNT, DEBT_AMOUNT, userAccount);
      userPosition = result.params.id;

      await mint(HARD_CAP, userAccount);
      await stake(HARD_CAP, userPosition, userAccount, arc.coreAddress());
      await stakingRewards.setCurrentTimestamp(10);
    });

    it('should not be able to be called before the tokens are tradable', async () => {
      const contract = await getContract(userAccount);
      await expectRevert(contract.exit());
    });

    it('should be able to exit', async () => {
      await stakingRewards.setTokensClaimable(true);

      const contract = await getContract(userAccount);
      await contract.exit();

      expect(await stakingToken.balanceOf(userAccount.address)).to.equal(HARD_CAP);
      expect(await rewardToken.balanceOf(userAccount.address)).to.equal(0);

      await stake(HARD_CAP, userPosition, userAccount, arc.coreAddress());
      await stakingRewards.setCurrentTimestamp(99);
      await contract.exit();

      expect(await stakingToken.balanceOf(userAccount.address)).to.equal(HARD_CAP);
      expect(await rewardToken.balanceOf(userAccount.address)).to.equal(0);

      await stake(HARD_CAP, userPosition, userAccount, arc.coreAddress());
      await stakingRewards.setCurrentTimestamp(150);
      await contract.exit();

      expect(await stakingToken.balanceOf(userAccount.address)).to.equal(HARD_CAP);
      expect(await (await rewardToken.balanceOf(userAccount.address)).gte(0)).to.be.true;
    });
  });

  /* ========== Admin fuctions ========== */

  describe('#notifyRewardAmount', () => {
    beforeEach(setup);

    it('should not be callable by anyone', async () => {
      await expectRevert((await getContract(userAccount)).notifyRewardAmount(REWARD_AMOUNT));
      await expectRevert((await getContract(slasherAccount)).notifyRewardAmount(REWARD_AMOUNT));
    });

    it('should only be callable by the rewards distributor', async () => {
      await rewardToken.mintShare(stakingRewards.address, REWARD_AMOUNT);
      await (await getContract(ownerAccount)).notifyRewardAmount(REWARD_AMOUNT);
    });
  });

  describe('#recoverERC20', () => {
    let dummyToken: TestToken;

    beforeEach(async () => {
      await setup();
      dummyToken = await new TestTokenFactory(ownerAccount).deploy('TEST', 'TEST', 18);
      await dummyToken.mintShare(stakingRewards.address, 100);
    });

    it('should not be callable by anyone', async () => {
      await expectRevert((await getContract(userAccount)).recoverERC20(dummyToken.address, 100));
      await expectRevert((await getContract(slasherAccount)).recoverERC20(dummyToken.address, 100));
    });

    it('should only be callable by the contract owner', async () => {
      await (await getContract(ownerAccount)).recoverERC20(dummyToken.address, 100);
    });
  });

  describe('#setTokensClaimable', () => {
    beforeEach(setup);

    it('should not be callable by anyone', async () => {
      await expectRevert((await getContract(userAccount)).setTokensClaimable(true));
      await expectRevert((await getContract(slasherAccount)).setTokensClaimable(true));
    });

    it('should only be callable by the contract owner', async () => {
      expect(await stakingRewards.tokensClaimable()).to.be.false;
      await (await getContract(ownerAccount)).setTokensClaimable(true);
      expect(await stakingRewards.tokensClaimable()).to.be.true;
    });
  });

  describe('#init', () => {
    beforeEach(setup);

    it('should not be callable by anyone', async () => {
      await expectRevert(
        (await getContract(userAccount)).init(
          ownerAccount.address,
          ownerAccount.address,
          rewardToken.address,
          stakingToken.address,
          DAO_ALLOCATION,
          SLAHSER_CUT,
          VESTING_END_DATE,
          DEBT_TO_STAKE,
          HARD_CAP,
        ),
      );
      await expectRevert(
        (await getContract(slasherAccount)).init(
          ownerAccount.address,
          ownerAccount.address,
          rewardToken.address,
          stakingToken.address,
          DAO_ALLOCATION,
          SLAHSER_CUT,
          VESTING_END_DATE,
          DEBT_TO_STAKE,
          HARD_CAP,
        ),
      );
    });

    it('should only be callable by the contract owner', async () => {
      await (await getContract(ownerAccount)).init(
        ownerAccount.address,
        ownerAccount.address,
        rewardToken.address,
        stakingToken.address,
        DAO_ALLOCATION,
        SLAHSER_CUT,
        VESTING_END_DATE,
        DEBT_TO_STAKE,
        HARD_CAP,
      );

      expect(await stakingRewards.daoAllocation()).to.equal(DAO_ALLOCATION.value);
      expect(await stakingRewards.slasherCut()).to.equal(SLAHSER_CUT.value);
      expect(await (await stakingRewards.vestingEndDate()).toNumber()).to.equal(VESTING_END_DATE);
      expect(await (await stakingRewards.debtToStake()).toNumber()).to.equal(DEBT_TO_STAKE);
      expect(await stakingRewards.hardCap()).to.equal(HARD_CAP);
    });
  });

  // describe('#setApprovedKYFInstance', () => {
  //   beforeEach(setup);

  //   it('should not be callable by anyone', async () => {
  //     await expectRevert(
  //       (await getContract(userAccount)).setApprovedKYFInstance(kyfTranche1.address, true),
  //     );
  //     await expectRevert(
  //       (await getContract(slasherAccount)).setApprovedKYFInstance(kyfTranche1.address, true),
  //     );
  //   });

  //   it('should only be callable by the contract owner', async () => {
  //     expect(await stakingRewards.kyfInstances(kyfTranche1.address)).to.be.false;
  //     await (await getContract(ownerAccount)).setApprovedKYFInstance(kyfTranche1.address, true);
  //     expect(await stakingRewards.kyfInstances(kyfTranche1.address)).to.be.true;
  //   });
  // });

  describe('#setApprovedStateContract', () => {
    beforeEach(setup);
    
    it('should not be able to set a state contract as an unauthorized user', async () => {
      await deploySecondCore();
      const userStaking = await getContract(userAccount);
      await expectRevert(userStaking.setApprovedStateContract(core2.address));
    });

    it('should be able to add a valid state contract as the owner', async () => {
      await deploySecondCore();
      const ownerStaking = await getContract(ownerAccount);
      await ownerStaking.setApprovedStateContract(core2.address);
      expect(await ownerStaking.approvedStateContracts(core2.address)).to.be.true;
    });
  })
});
