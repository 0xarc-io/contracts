import 'module-alias/register';

import { expect } from 'chai';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';
import { TEN_PERCENT } from '@src/constants';

import { generateContext, ITestContext } from '../context';
import { setupMozart } from '../setup';
import { mozartFixture } from '../fixtures';
import { MozartTestArc } from '@src/MozartTestArc';
import { BigNumber } from '@ethersproject/bignumber';

// These tests do not reset and act more as integration tests for weird decimal tokens
describe('Mozart.decimals', () => {
  let ctx: ITestContext;
  let arc: MozartTestArc;

  const DECIMALS = 6;
  const COLLATERAL_AMOUNT = 100;
  const BORROW_AMOUNT = ArcNumber.new(50);

  async function init(ctx: ITestContext): Promise<void> {
    await setupMozart(ctx, {
      oraclePrice: ArcDecimal.new(1).value,
      collateralRatio: ArcDecimal.new(2).value,
      interestRate: TEN_PERCENT,
    });
  }

  before(async () => {
    ctx = await generateContext(mozartFixture, init, { decimals: DECIMALS });
    arc = ctx.sdks.mozart;
  });

  describe('#open', () => {
    it('should not be able to open without enough collateral', async () => {
      await expect(
        arc.openPosition(
          ArcNumber.new(COLLATERAL_AMOUNT - 1, DECIMALS),
          BORROW_AMOUNT,
          ctx.signers.minter,
        ),
      ).to.be.reverted;
    });

    it('should be able to open a valid position', async () => {
      await arc.openPosition(
        ArcNumber.new(COLLATERAL_AMOUNT, DECIMALS),
        BORROW_AMOUNT,
        ctx.signers.minter,
      );

      // Did the appropriate amount of collateral get transfered over
      expect(await arc.collateral().balanceOf(arc.syntheticAddress())).to.equal(
        ArcNumber.new(COLLATERAL_AMOUNT, DECIMALS),
      );

      // Now check if the amounts got normalised in the system
      const position = await arc.getPosition(0);
      expect(position.collateralAmount.value).to.equal(ArcNumber.new(COLLATERAL_AMOUNT, 18));
      expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT);
    });
  });

  describe('#borrow', () => {
    it('should not be able to borow without enough collateral', async () => {
      await expect(arc.borrow(0, 0, 1, ctx.signers.minter)).to.be.reverted;
    });

    it('should be able to deposit more', async () => {
      await arc.borrow(0, ArcNumber.new(COLLATERAL_AMOUNT, DECIMALS), 0, ctx.signers.minter);

      // Did the appropriate amount of collateral get transfered over
      expect(await arc.collateral().balanceOf(arc.syntheticAddress())).to.equal(
        ArcNumber.new(COLLATERAL_AMOUNT, DECIMALS).mul(2),
      );

      // Now check if the amounts got normalised in the system
      const position = await arc.getPosition(0);
      expect(position.collateralAmount.value).to.equal(ArcNumber.new(COLLATERAL_AMOUNT, 18).mul(2));
      expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT);
    });

    it('should be able to borrow more', async () => {
      await arc.borrow(0, 0, BORROW_AMOUNT, ctx.signers.minter);
      await expect(arc.borrow(BORROW_AMOUNT, 0, 0, ctx.signers.minter)).to.be.reverted;
    });
  });

  describe('#repay', () => {
    it('should be able to repay debt', async () => {
      await arc.repay(0, BORROW_AMOUNT, 0, ctx.signers.minter);
    });

    it('should be able to withdraw collateral', async () => {
      await arc.repay(0, 0, ArcNumber.new(COLLATERAL_AMOUNT, DECIMALS), ctx.signers.minter);

      await arc.repay(
        0,
        BORROW_AMOUNT,
        ArcNumber.new(COLLATERAL_AMOUNT, DECIMALS),
        ctx.signers.minter,
      );
    });
  });

  describe('#liquidate', () => {
    it('should receive the correct amount of collateral', async () => {
      await arc.borrow(
        0,
        ArcNumber.new(COLLATERAL_AMOUNT, DECIMALS),
        BORROW_AMOUNT,
        ctx.signers.minter,
      );

      await arc.openPosition(
        ArcNumber.new(COLLATERAL_AMOUNT, DECIMALS),
        BORROW_AMOUNT,
        ctx.signers.liquidator,
      );

      const position = await arc.getPosition(0);
      const liquidationDetails = await arc.getLiquidationDetails(position);
      await arc.updatePrice(ArcDecimal.new(0.5).value);

      await arc.liquidatePosition(0, ctx.signers.liquidator);

      expect(position.collateralAmount.value).to.equal(liquidationDetails.newCollateralAmount);
      expect(position.borrowedAmount.value).to.equal(liquidationDetails.newDebtAmount);

      expect(await arc.collateral().balanceOf(arc.syntheticAddress())).to.equal(
        position.collateralAmount.value
          .sub(liquidationDetails.collateralLiquidated)
          .div(BigNumber.from(10).pow(12)),
      );
    });
  });
});
