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
    await savings.setCurrentTimestamp(time);
    await arc.updateTime(time);
  }

  async function updateOwnerIndex() {
    const contract = await getContract(ctx.signers.admin);
    await contract.updateIndex();
  }

  async function stake(amount: BigNumberish, signer: Signer = ctx.signers.minter) {
    await Token.approve(arc.syntheticAddress(), signer, savings.address, amount);

    const contract = await getContract(signer);
    await contract.stake(amount);
  }

  describe('#setSavingsRate', () => {
    it('should not be settable by anyone', async () => {
      const contract = await getContract(ctx.signers.unauthorised);
      await expect(contract.setSavingsRate(5)).to.be.reverted;
    });

    it('should be settable by the admin', async () => {
      const contract = await getContract(ctx.signers.admin);
      await contract.setSavingsRate(5);
      expect(await contract.getSavingsRate()).to.equal(BigNumber.from(5));
    });
  });

  describe('#setArcFee', () => {
    it('should not be settable by anyone', async () => {
      const contract = await getContract(ctx.signers.unauthorised);
      await expect(contract.setArcFee(ctx.signers.revenue.address, { value: 5 })).to.be.reverted;
    });

    it('should be settable by the admin', async () => {
      const contract = await getContract(ctx.signers.admin);
      await contract.setArcFee(ctx.signers.revenue.address, { value: 5 });
      expect(await contract.arcFee()).to.equal(BigNumber.from(5));
      expect(await contract.arcFeeDestination()).to.equal(ctx.signers.revenue.address);
    });
  });

  describe('#setFullCollateralized', () => {
    it('should not be settable by anyone', async () => {
      const contract = await getContract(ctx.signers.unauthorised);
      await expect(contract.setSavingsRate(5)).to.be.reverted;
    });

    it('should be settable by the admin', async () => {
      const contract = await getContract(ctx.signers.admin);
      await contract.setSavingsRate(5);
      expect(await contract.getSavingsRate()).to.equal(BigNumber.from(5));
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
      await updateOwnerIndex();
      await savings.setPaused(true);
      await expect(stake(BORROW_AMOUNT)).to.be.reverted;
      await expect(savings.updateIndex()).to.be.reverted;
    });
  });

  describe('#stake', () => {
    it('should not be able to stake more than their balance', async () => {});

    it('should be able to stake additional amounts', async () => {});
  });

  describe('#unstake', () => {
    it('should be able to unstake', async () => {});

    it('should not be able to unstake more than it has staked', async () => {});
  });

  describe('#updateIndex', () => {
    beforeEach(async () => {
      await savings.setSavingsRate(TEN_PERCENT);
      await savings.setFullyCollateralized(true);
    });

    it('should not be able to update the first index by anyone else', async () => {
      const contract = await getContract(ctx.signers.unauthorised);
      await expect(contract.updateIndex()).to.be.reverted;
    });

    it('the first update index is only callable by the owner', async () => {
      await updateOwnerIndex();
      expect(await savings.exchangeRate()).to.equal(BASE);
      expect(await savings.totalSupplied()).to.equal(0);
      expect(await savings.indexLastUpdate()).to.equal(0);
    });

    it('should be callabe by anyone', async () => {
      await updateOwnerIndex();
      await savings.updateIndex();
    });

    it('should update the index based on the increased debt issuance & mint more', async () => {
      await updateOwnerIndex();

      // Stake the whole borrow amount
      await stake(BORROW_AMOUNT);

      // Update to the future with a ~10% APY savings rate
      await updateTime(ONE_YEAR_IN_SECONDS);
      await arc.core().updateIndex();

      expect(await savings.savingsIndex()).to.equal(BASE);
      const beforeSupply = await arc.synthetic().totalSupply();
      await savings.updateIndex();
      const afterSupply = await arc.synthetic().totalSupply();

      expect(afterSupply.gte(beforeSupply));

      const coreBorrowIndex = (await arc.core().getBorrowIndex())[0];
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
      await updateOwnerIndex();

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
      await updateOwnerIndex();

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

    it('should not be able to update beyond the debt hard cap (if fully collateralized)', async () => {
      await updateOwnerIndex();

      // Stake half the borrow amount
      await stake(BORROW_AMOUNT.div(2));

      // Update to the future with a ~10% APY savings rate
      await updateTime(ONE_YEAR_IN_SECONDS);
      await arc.core().updateIndex();
      await savings.updateIndex();

      await savings.setSavingsRate(TEN_PERCENT.mul(3));

      // Update to the future by another year
      await updateTime(ONE_YEAR_IN_SECONDS.mul(2));
      await arc.core().updateIndex();
      await savings.updateIndex();

      // Update to the future by another year
      await updateTime(ONE_YEAR_IN_SECONDS.mul(3));
      await arc.core().updateIndex();
      await expect(savings.updateIndex()).to.be.reverted;
    });

    it('should not be able to update beyond the debt hard cap (if not fully collateralized)', async () => {
      await updateOwnerIndex();
      await savings.setFullyCollateralized(false);

      // Stake half the borrow amount
      await stake(BORROW_AMOUNT.div(2));

      // Update to the future with a ~10% APY savings rate
      await updateTime(ONE_YEAR_IN_SECONDS);
      await arc.core().updateIndex();
      await savings.updateIndex();

      await savings.setSavingsRate(TEN_PERCENT.mul(3));

      // Update to the future by another year
      await updateTime(ONE_YEAR_IN_SECONDS.mul(2));
      await arc.core().updateIndex();
      await savings.updateIndex();

      // Update to the future by another year
      await updateTime(ONE_YEAR_IN_SECONDS.mul(3));
      await arc.core().updateIndex();
      await savings.updateIndex();
    });
  });
});
