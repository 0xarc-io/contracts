import 'module-alias/register';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';

import { expect } from 'chai';
import { mozartFixture } from '../fixtures';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';
import { generateContext, ITestContext } from '../context';
import { setupMozart } from '../setup';
import { MozartTestArc } from '@src/MozartTestArc';

import { TEN_PERCENT } from '@src/constants';
import { BigNumberish } from '@ethersproject/bignumber';
import { ONE_YEAR_IN_SECONDS } from '@src/constants';

describe('MozartV1.operateAction(Liquidate)', () => {
  const COLLATERAL_AMOUNT = ArcNumber.new(100);
  const BORROW_AMOUNT = ArcNumber.new(50);

  let ctx: ITestContext;
  let arc: MozartTestArc;

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

    await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.minter);
  });

  addSnapshotBeforeRestoreAfterEach();

  async function openLiquidatorPosition() {
    // Ensure the liquidator has enough synth
    await arc.openPosition(COLLATERAL_AMOUNT.mul(5), BORROW_AMOUNT.mul(5), ctx.signers.liquidator);
  }

  async function attemptLiquidation(positionId: BigNumberish) {
    await expect(arc.liquidatePosition(positionId, ctx.signers.liquidator)).to.be.reverted;
  }

  it('should be able to liquidate an undercollateralized position', async () => {
    await openLiquidatorPosition();

    // Get information about the position pre-liquidation and what we expect
    const preLiquidatePosition = await arc.getPosition(0);

    // Drop the price
    await arc.updatePrice(ArcDecimal.new(0.75).value);

    const liquidationDetails = await arc.getLiquidationDetails(preLiquidatePosition);
    const preLiquidateSupply = await arc.synthetic().totalSupply();
    const preProxyCollateralBalance = await arc.synth().collateral.balanceOf(arc.coreAddress());
    const preLiquidatorCollateralBalance = await arc
      .synth()
      .collateral.balanceOf(ctx.signers.liquidator.address);
    const preLiquidatorSyntheticBalance = await arc
      .synth()
      .synthetic.balanceOf(ctx.signers.liquidator.address);
    const preTotals = await arc.getSynthTotals();

    // Call up arthur to do the deed
    await arc.liquidatePosition(0, ctx.signers.liquidator);

    const postLiquidatePosition = await arc.getPosition(0);
    const postLiquidatorCollateralBalance = await arc
      .synth()
      .collateral.balanceOf(ctx.signers.liquidator.address);
    const postLiquidatorSyntheticBalance = await arc
      .synth()
      .synthetic.balanceOf(ctx.signers.liquidator.address);
    const postProxyCollateralBalance = await arc.synth().collateral.balanceOf(arc.coreAddress());
    const postTotals = await arc.getSynthTotals();

    // Check synth supply decreased
    expect(await await arc.synthetic().totalSupply()).to.equal(
      preLiquidateSupply.sub(liquidationDetails.debtNeededToLiquidate),
    );

    const issuedAmount = await arc.synthetic().getMinterIssued(arc.coreAddress());
    expect(issuedAmount.value).to.equal(preTotals[1].sub(liquidationDetails.debtNeededToLiquidate));

    // Check position borrow amount (decrease)
    expect(postLiquidatePosition.borrowedAmount.value).to.equal(liquidationDetails.newDebtAmount);
    // Check position collateral amount (decrease)
    expect(postLiquidatePosition.collateralAmount.value.sub(1)).to.equal(
      liquidationDetails.newCollateralAmount,
    );

    // Check liquidator collateral amount (increase)
    expect(postLiquidatorCollateralBalance.add(1)).to.equal(
      preLiquidatorCollateralBalance.add(
        liquidationDetails.collateralLiquidated.sub(liquidationDetails.collateralToArc),
      ),
    );
    // Check liquidator synth balance (decrease)
    expect(postLiquidatorSyntheticBalance).to.equal(
      preLiquidatorSyntheticBalance.sub(liquidationDetails.debtNeededToLiquidate),
    );

    // Check proxy collateral amount (increase)
    expect(postProxyCollateralBalance).to.equal(
      preProxyCollateralBalance.add(liquidationDetails.collateralToArc),
    );
  });

  it('should not be able to liquidate a collateralized position ', async () => {
    await openLiquidatorPosition();
    await attemptLiquidation(0);
  });

  it('should not be able to liquidate without enough synthetic', async () => {
    await attemptLiquidation(0);
  });

  it('should be able to liquidate if interest accumulates (1 day)', async () => {
    await openLiquidatorPosition();

    // We already have a position open, let's fast forward time by a year
    await arc.updateTime(60 * 60 * 24);

    // This should now make our position undercollateralised and ripe for liquidation
    await arc.core().updateIndex();

    // Pull the trigger
    await arc.liquidatePosition(0, ctx.signers.liquidator);
  });

  it('should be able to liquidate if interest accumulates (1 year)', async () => {
    await openLiquidatorPosition();

    // We already have a position open, let's fast forward time by a year
    await arc.updateTime(ONE_YEAR_IN_SECONDS);

    // This should now make our position undercollateralised and ripe for liquidation
    await arc.core().updateIndex();

    // Pull the trigger
    await arc.liquidatePosition(0, ctx.signers.liquidator);
  });

  it('should be able to liquidate if the price drops', async () => {
    await openLiquidatorPosition();

    // Increase the collateral amount by twice the amount
    await arc.borrow(0, COLLATERAL_AMOUNT, 0, ctx.signers.minter);

    // Accumulate some interest
    await arc.updateTime(ONE_YEAR_IN_SECONDS);
    await arc.core().updateIndex();

    await attemptLiquidation(0);

    await arc.updatePrice(ArcDecimal.new(0.5).value);

    await arc.liquidatePosition(0, ctx.signers.liquidator);
  });

  it('should not be able to liquidate if the price increases', async () => {
    await openLiquidatorPosition();

    // Accumulate some interest
    await arc.updateTime(ONE_YEAR_IN_SECONDS);
    await arc.core().updateIndex();

    let position = await arc.getPosition(0);
    expect(await arc.core().isCollateralized(position)).to.be.false;

    // Increase the price
    await arc.updatePrice(ArcDecimal.new(1.1).value);
    position = await arc.getPosition(0);
    expect(await arc.core().isCollateralized(position)).to.be.true;

    await attemptLiquidation(0);
  });

  it('should be able to liquidate again if the price drops', async () => {
    await openLiquidatorPosition();
    await attemptLiquidation(0);

    await arc.updatePrice(ArcDecimal.new(0.9).value);
    await arc.liquidatePosition(0, ctx.signers.liquidator);

    await arc.updatePrice(ArcDecimal.new(0.4).value);
    await arc.liquidatePosition(0, ctx.signers.liquidator);
  });

  it('should be able to liquidate the remains if the price crashes by a large amount', async () => {
    await openLiquidatorPosition();
    await attemptLiquidation(0);

    await arc.updatePrice(ArcDecimal.new(0.4).value);
    await arc.liquidatePosition(0, ctx.signers.liquidator);

    let position = await arc.getPosition(0);
    let beforeTotalCollateralHeld = await arc.synth().collateral.balanceOf(arc.syntheticAddress());
    let beforeSyntheticBalance = await arc.synthetic().balanceOf(ctx.signers.liquidator.address);

    await arc.liquidatePosition(0, ctx.signers.liquidator);

    let afterTotalCollateralHeld = await arc.synth().collateral.balanceOf(arc.syntheticAddress());
    let afterSyntheticBalance = await arc.synthetic().balanceOf(ctx.signers.liquidator.address);

    expect(afterSyntheticBalance).to.equal(beforeSyntheticBalance);
    expect(afterTotalCollateralHeld).to.equal(beforeTotalCollateralHeld);

    position = await arc.getPosition(0);
  });
});
