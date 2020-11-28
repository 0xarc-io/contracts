import 'module-alias/register';

import { expect } from 'chai';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';
import Token from '@src/utils/Token';

import { TEN_PERCENT, ONE_YEAR_IN_SECONDS, BASE } from '@src/constants';

import { generateContext, ITestContext } from '../context';
import { setupMozart } from '../setup';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';
import { mozartFixture } from '../fixtures';
import { MozartTestArc } from '@src/MozartTestArc';
import { MozartSavingsV1 } from '@src/typings/MozartSavingsV1';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { Signer } from '@ethersproject/abstract-signer';
import { MockMozartSavingsV1Factory } from '@src/typings';

const COLLATERAL_AMOUNT = ArcNumber.new(200);
const BORROW_AMOUNT = ArcNumber.new(50);

describe('MozartSavingsV1', () => {
  let ctx: ITestContext;
  let arc: MozartTestArc;
  let savings: MozartSavingsV1;

  async function init(ctx: ITestContext): Promise<void> {
    await setupMozart(ctx, {
      oraclePrice: ArcDecimal.new(1).value,
      collateralRatio: ArcDecimal.new(2).value,
      interestRate: TEN_PERCENT,
    });
  }

  before(async () => {
    ctx = await generateContext(mozartFixture, init);
    arc = ctx.sdks.mozart;
    savings = ctx.contracts.mozart.savingsV1;

    await savings.setPaused(false);
    await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.minter);

    await Token.approve(
      arc.syntheticAddress(),
      ctx.signers.minter,
      savings.address,
      ArcNumber.new(10000),
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  async function getContract(signer: Signer) {
    return await ctx.contracts.mozart.savingsV1.connect(signer);
  }

  async function updateTime(time: BigNumberish) {
    const mockContract = MockMozartSavingsV1Factory.connect(savings.address, ctx.signers.minter);
    await mockContract.setCurrentTimestamp(BigNumber.from(time).add(0));
    await arc.updateTime(time);
  }

  async function stake(amount: BigNumberish, signer: Signer = ctx.signers.minter) {
    await Token.approve(arc.syntheticAddress(), signer, savings.address, amount);

    const contract = await getContract(signer);
    await contract.stake(amount);
  }

  describe('#init', () => {
    it('should not be callable by non admin', async () => {
      await expect(
        savings
          .connect(ctx.signers.unauthorised)
          .init('TEST', 'TEST', await savings.synthetic(), { value: 0 }),
      ).to.reverted;
    });

    it('should have the correct variables set', async () => {
      // Check initial index and index last update
      expect(await savings.indexLastUpdate()).to.equal(0);
      expect(await savings.savingsIndex()).to.equal(BASE);
    });
  });

  describe('#setSavingsRate', () => {
    it('should not be settable by anyone', async () => {
      const contract = await getContract(ctx.signers.unauthorised);
      await expect(contract.setSavingsRate(5)).to.be.reverted;
    });

    it('should be settable by the admin', async () => {
      const contract = await getContract(ctx.signers.admin);
      await contract.setSavingsRate(ArcNumber.new(5));
      expect(await contract.exchangeRate()).to.equal(ArcNumber.new(5));
    });
  });

  describe('#setArcFee', () => {
    it('should not be settable by anyone', async () => {
      const contract = await getContract(ctx.signers.unauthorised);
      await expect(contract.setArcFee({ value: 5 })).to.be.reverted;
    });

    it('should be settable by the admin', async () => {
      const contract = await getContract(ctx.signers.admin);
      const fee = ArcDecimal.new(0.5).value;
      await contract.setArcFee({ value: fee });
      expect(await contract.arcFee()).to.equal(fee);
    });
  });

  describe('#setPaused', () => {
    it('should not be settable by anyone', async () => {
      const contract = await getContract(ctx.signers.unauthorised);
      await expect(contract.setPaused(true)).to.be.reverted;
    });

    it('should be settable by the admin', async () => {
      const contract = await getContract(ctx.signers.admin);
      await contract.setPaused(true);
      expect(await contract.paused()).to.be.true;
    });

    it('should not be able to call any function if pause', async () => {
      await savings.updateIndex();
      await savings.setPaused(true);
      await expect(stake(BORROW_AMOUNT)).to.be.reverted;
      await expect(savings.updateIndex()).to.be.reverted;
    });
  });

  describe('#stake', () => {
    beforeEach(async () => {
      await savings.updateIndex();
    });

    it('should not be able to stake more than their balance', async () => {
      await expect(stake(BORROW_AMOUNT, ctx.signers.unauthorised)).to.be.reverted;
    });

    it('should be able to stake', async () => {
      await stake(BORROW_AMOUNT, ctx.signers.minter);
      expect(await savings.balanceOf(ctx.signers.minter.address)).to.equal(BORROW_AMOUNT);
    });

    it('should be able to stake additional amounts', async () => {
      await stake(BORROW_AMOUNT.div(2), ctx.signers.minter);
      await stake(BORROW_AMOUNT.div(2), ctx.signers.minter);
      expect(await savings.balanceOf(ctx.signers.minter.address)).to.equal(BORROW_AMOUNT);
    });
  });

  describe('#unstake', () => {
    beforeEach(async () => {
      await savings.updateIndex();
      // Create a second depositor
      await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.staker);
      await stake(BORROW_AMOUNT, ctx.signers.staker);
    });

    it('should be able to unstake', async () => {
      await stake(ArcNumber.new(5));
      const contract = await getContract(ctx.signers.minter);
      await contract.unstake(ArcNumber.new(5));
    });

    it('should not be able to unstake more than it has staked', async () => {
      await stake(ArcNumber.new(5));
      const contract = await getContract(ctx.signers.minter);
      await expect(contract.unstake(ArcNumber.new(10))).to.be.reverted;
    });
  });

  describe('#updateIndex', () => {
    beforeEach(async () => {
      await savings.setSavingsRate(TEN_PERCENT);
    });

    it('should accrue the correct amount of interest on the first update', async () => {});

    it('should be callabe by anyone', async () => {
      await savings.updateIndex();
    });

    it('should update the index based on the increased debt issuance & mint more', async () => {
      // Set the initial index to 1
      await savings.updateIndex();
      expect(await savings.savingsIndex()).to.equal(BASE);

      // Stake the whole borrow amount
      await stake(BORROW_AMOUNT);

      // Update to the future with a ~10% APY savings rate
      await updateTime(ONE_YEAR_IN_SECONDS);

      // Call updateIndex() to accumulate the borrows in the core contract
      await arc.core().updateIndex();

      // The savings index should equal to 1 since we havent updated it yet
      expect(await savings.savingsIndex()).to.equal(BASE);
      const beforeSupply = await arc.synthetic().totalSupply();
      const savingsRate = await savings.savingsRate();

      // Update the savings index
      await savings.updateIndex();

      const afterSupply = await arc.synthetic().totalSupply();
      const coreBorrowIndex = (await arc.core().getBorrowIndex())[0];
      const savingsIndex = await savings.savingsIndex();

      expect(savingsIndex).to.equal(savingsRate.mul(ONE_YEAR_IN_SECONDS).add(BASE));

      // The amount minted should have increased
      expect(afterSupply).to.equal(ArcNumber.bigMul(savingsIndex, beforeSupply));

      expect(await savings.savingsIndex()).to.equal(coreBorrowIndex);
      expect(afterSupply).to.equal(ArcNumber.bigMul(coreBorrowIndex, BORROW_AMOUNT));

      // The newly minted synth should go straight to this contract
      const savingsBalance = ArcNumber.bigMul(coreBorrowIndex, BORROW_AMOUNT);
      expect(await arc.synthetic().balanceOf(savings.address)).to.equal(savingsBalance);

      const issuedAmount = await arc.synthetic().getMinterIssued(savings.address);
      expect(issuedAmount.value).to.equal(
        ArcNumber.bigMul(BORROW_AMOUNT, coreBorrowIndex).sub(BORROW_AMOUNT),
      );
    });

    it('should calculate the correct index if someone deposits more funds', async () => {
      await savings.updateIndex();

      // Stake the whole borrow amount
      await stake(BORROW_AMOUNT);

      // Update to the future with a ~10% APY savings rate
      await updateTime(ONE_YEAR_IN_SECONDS);
      await arc.core().updateIndex();
      await savings.updateIndex();

      const savingsIndex = await savings.savingsIndex();

      // User mints more debt to stake,
      await arc.borrow(0, COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.minter);
      await stake(BORROW_AMOUNT, ctx.signers.minter);

      expect(await savings.balanceOf(ctx.signers.minter.address)).to.equal(
        BORROW_AMOUNT.add(ArcNumber.bigDiv(BORROW_AMOUNT, savingsIndex)),
      );
    });

    it('should calculate the correct index if someone withdraws funds', async () => {
      await savings.updateIndex();

      // Stake the whole borrow amount
      await stake(BORROW_AMOUNT);

      // Update to the future with a ~10% APY savings rate
      await updateTime(ONE_YEAR_IN_SECONDS);
      await arc.core().updateIndex();
      await savings.updateIndex();

      const savingsIndex = await savings.savingsIndex();

      const contract = await getContract(ctx.signers.minter);
      const preSynthBalance = await arc.synthetic().balanceOf(ctx.signers.minter.address);
      const preSavingsBalance = await savings.balanceOf(ctx.signers.minter.address);
      await contract.unstake(BORROW_AMOUNT);

      const postSynthBalance = await arc.synthetic().balanceOf(ctx.signers.minter.address);
      const postSavingsBalance = await savings.balanceOf(ctx.signers.minter.address);
      expect(postSynthBalance).to.equal(preSynthBalance.add(BORROW_AMOUNT));
      expect(postSavingsBalance).to.equal(
        preSavingsBalance.sub(ArcNumber.bigDiv(BORROW_AMOUNT, savingsIndex)),
      );
    });
  });
});
