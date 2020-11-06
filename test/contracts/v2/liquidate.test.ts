import 'module-alias/register';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';
import {
  Account,
  addSnapshotBeforeRestoreAfterEach,
  getWaffleExpect,
} from '../../helpers/testingUtils';
import { d2Setup, initializeD2Arc } from '@test/helpers/d2ArcDescribe';
import { ITestContext } from '@test/helpers/d2ArcDescribe';
import { D2ArcOptions } from '../../helpers/d2ArcDescribe';
import { TEN_PERCENT, ONE_YEAR_IN_SECONDS, BASE } from '../../../src/constants';
import { LIQUIDATION_COLLATERALIZED_ERROR } from '../../helpers/contractErrors';
import { BigNumberish } from 'ethers/utils';

let ownerAccount: Account;
let minterAccount: Account;
let liquidatorAccount: Account;
let printerAccount: Account;
let otherAccount: Account;

const COLLATERAL_AMOUNT = ArcNumber.new(100);
const BORROW_AMOUNT = ArcNumber.new(50);

const ctx: ITestContext = {};

async function init(ctx: ITestContext): Promise<void> {
  [ownerAccount, minterAccount, liquidatorAccount, printerAccount, otherAccount] = ctx.accounts;

  const setupOptions = {
    oraclePrice: ArcDecimal.new(1).value,
    collateralRatio: ArcDecimal.new(2).value,
    interestRate: TEN_PERCENT,
    initialCollateralBalances: [
      [minterAccount, COLLATERAL_AMOUNT.mul(5)],
      [liquidatorAccount, COLLATERAL_AMOUNT.mul(10)],
    ],
  } as D2ArcOptions;

  await initializeD2Arc(ctx, setupOptions);
}

const expect = getWaffleExpect();

describe('D2Core.operateAction(Liquidate)', () => {
  let ctx: ITestContext = {};

  before(async () => {
    ctx = await d2Setup(init);
    // Open a 200% collateralized position (at the boundary)
    await ctx.arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, minterAccount.signer);
  });

  addSnapshotBeforeRestoreAfterEach();

  async function openLiquidatorPosition() {
    // Ensure the liquidator has enough synth
    await ctx.arc.openPosition(
      COLLATERAL_AMOUNT.mul(5),
      BORROW_AMOUNT.mul(5),
      liquidatorAccount.signer,
    );
  }

  async function attemptLiquidation(positionId: BigNumberish) {
    await expect(ctx.arc.liquidatePosition(positionId, liquidatorAccount.signer)).to.be.reverted;
  }

  it('should be able to liquidate an undercollateralized position', async () => {
    await openLiquidatorPosition();

    // Get information about the position pre-liquidation and what we expect
    const preLiquidatePosition = await ctx.arc.getPosition(0);

    // Drop the price
    await ctx.arc.updatePrice(ArcDecimal.new(0.75).value);

    const liquidationDetails = await ctx.arc.getLiquidationDetails(preLiquidatePosition);
    const preLiquidateSupply = await ctx.arc.synthetic().totalSupply();
    const preProxyCollateralBalance = await ctx.arc
      .synth()
      .collateral.balanceOf(ctx.arc.coreAddress());
    const preLiquidatorCollateralBalance = await ctx.arc
      .synth()
      .collateral.balanceOf(liquidatorAccount.address);
    const preLiquidatorSyntheticBalance = await ctx.arc
      .synth()
      .synthetic.balanceOf(liquidatorAccount.address);
    const preTotals = await ctx.arc.getSynthTotals();

    // Call up arthur to do the deed
    await ctx.arc.liquidatePosition(0, liquidatorAccount.signer);

    const postLiquidatePosition = await ctx.arc.getPosition(0);
    const postLiquidatorCollateralBalance = await ctx.arc
      .synth()
      .collateral.balanceOf(liquidatorAccount.address);
    const postLiquidatorSyntheticBalance = await ctx.arc
      .synth()
      .synthetic.balanceOf(liquidatorAccount.address);
    const postProxyCollateralBalance = await ctx.arc
      .synth()
      .collateral.balanceOf(ctx.arc.coreAddress());
    const postTotals = await ctx.arc.getSynthTotals();

    // Check synth supply decreased
    expect(await await ctx.arc.synthetic().totalSupply()).to.equal(
      preLiquidateSupply.sub(liquidationDetails.debtNeededToLiquidate),
    );

    expect(postTotals[2].value).to.equal(
      preTotals[1].sub(liquidationDetails.debtNeededToLiquidate),
    );

    // Check position borrow amount (decrease)
    expect(postLiquidatePosition.borrowedAmount.value).to.equal(liquidationDetails.newDebtAmount);

    console.log(
      `Current collat amount: ${postLiquidatePosition.collateralAmount.value.toString()}`,
    );

    // Check position collateral amount (decrease)
    expect(postLiquidatePosition.collateralAmount.value).to.equal(
      liquidationDetails.newCollateralAmount,
    );

    // Check liquidator collateral amount (increase)
    console.log(`Pre liquidator colat: ${preLiquidatorCollateralBalance.toString()}`);
    console.log(`Post liquidator collat: ${postLiquidatorCollateralBalance.toString()}`);
    expect(postLiquidatorCollateralBalance).to.equal(
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
    await ctx.arc.updateTime(60 * 60 * 24);

    // This should now make our position undercollateralised and ripe for liquidation
    await ctx.arc.core().updateIndex();

    // Pull the trigger
    await ctx.arc.liquidatePosition(0, liquidatorAccount.signer);
  });

  it('should be able to liquidate if interest accumulates (1 year)', async () => {
    await openLiquidatorPosition();

    // We already have a position open, let's fast forward time by a year
    await ctx.arc.updateTime(ONE_YEAR_IN_SECONDS);

    // This should now make our position undercollateralised and ripe for liquidation
    await ctx.arc.core().updateIndex();

    // Pull the trigger
    await ctx.arc.liquidatePosition(0, liquidatorAccount.signer);
  });

  it('should be able to liquidate if the price drops', async () => {
    await openLiquidatorPosition();

    // Increase the collateral amount by twice the amount
    await ctx.arc.borrow(0, COLLATERAL_AMOUNT, 0, minterAccount.signer);

    // Accumulate some interest
    await ctx.arc.updateTime(ONE_YEAR_IN_SECONDS);
    await ctx.arc.core().updateIndex();

    await attemptLiquidation(0);

    await ctx.arc.updatePrice(ArcDecimal.new(0.5).value);

    await ctx.arc.liquidatePosition(0, liquidatorAccount.signer);
  });

  it('should not be able to liquidate if the price increases', async () => {
    await openLiquidatorPosition();

    // Accumulate some interest
    await ctx.arc.updateTime(ONE_YEAR_IN_SECONDS);
    await ctx.arc.core().updateIndex();

    let position = await ctx.arc.getPosition(0);
    expect(await ctx.arc.core().isCollateralized(position)).to.be.false;

    // Increase the price
    await ctx.arc.updatePrice(ArcDecimal.new(1.1).value);
    position = await ctx.arc.getPosition(0);
    expect(await ctx.arc.core().isCollateralized(position)).to.be.true;

    await attemptLiquidation(0);
  });

  it('should be able to liquidate again if the price drops', async () => {
    await openLiquidatorPosition();
    await attemptLiquidation(0);

    await ctx.arc.updatePrice(ArcDecimal.new(0.9).value);
    await ctx.arc.liquidatePosition(0, liquidatorAccount.signer);

    await ctx.arc.updatePrice(ArcDecimal.new(0.6).value);
    await ctx.arc.liquidatePosition(0, liquidatorAccount.signer);

    await attemptLiquidation(0);
  });
});
