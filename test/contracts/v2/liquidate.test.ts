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
import { D2ArcOptions, DEFAULT_PRINTER_ARC_RATIO } from '../../helpers/d2ArcDescribe';
import { Operation } from '../../../src/types';
import { BigNumber } from 'ethers/utils';
import { UNDERCOLLATERALIZED_ERROR } from '../../helpers/contractErrors';
import { TEN_PERCENT, ONE_YEAR_IN_SECONDS, BASE } from '../../../src/constants';
import { Zero } from 'ethers/constants';
import { calculateLiquidationAmount } from '@src/utils/calculations';

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
    printerDestination: printerAccount.address,
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

    // Check synth supply decreased
    expect(await await ctx.arc.synthetic().totalSupply()).to.equal(
      preLiquidateSupply.sub(liquidationDetails.debtNeededToLiquidate),
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
    expect(ctx.arc.liquidatePosition(0, liquidatorAccount.signer)).to.be.reverted;
  });

  it('should not be able to liquidate without enough synthetic', async () => {
    expect(ctx.arc.liquidatePosition(0, liquidatorAccount.signer)).to.be.reverted;
  });

  it('should be able to liquidate if interest accumulates', async () => {});

  it('should be able to liquidate if the price drops', async () => {});

  it('should not be able to liquidate if the price increases', async () => {});

  it('should be able to liquidate again if the price drops', async () => {});
});
