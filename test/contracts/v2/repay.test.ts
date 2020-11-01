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
import { BigNumber, BigNumberish } from 'ethers/utils';
import { REPAY_WITHDRAW_ERROR, UNDERCOLLATERALIZED_ERROR } from '../../helpers/contractErrors';
import { TEN_PERCENT, ONE_YEAR_IN_SECONDS, BASE } from '../../../src/constants';
import Token from '@src/utils/Token';
import { Zero } from 'ethers/constants';

let ownerAccount: Account;
let minterAccount: Account;
let printerAccount: Account;
let otherAccount: Account;

const COLLATERAL_AMOUNT = ArcNumber.new(100);
const BORROW_AMOUNT = ArcNumber.new(50);

const ctx: ITestContext = {};

async function init(ctx: ITestContext): Promise<void> {
  [ownerAccount, minterAccount, printerAccount, otherAccount] = ctx.accounts;

  const setupOptions = {
    oraclePrice: ArcDecimal.new(1).value,
    collateralRatio: ArcDecimal.new(2).value,
    interestRate: TEN_PERCENT,
    printerDestination: printerAccount.address,
    initialCollateralBalances: [
      [minterAccount, COLLATERAL_AMOUNT.mul(5)],
      [otherAccount, COLLATERAL_AMOUNT.mul(5)],
    ],
  } as D2ArcOptions;

  await initializeD2Arc(ctx, setupOptions);
}

const expect = getWaffleExpect();

describe('D2Core.operateAction(Repay)', () => {
  let ctx: ITestContext = {};

  before(async () => {
    ctx = await d2Setup(init);

    // Set an unlimited approval
    await Token.approve(
      ctx.arc.synth().synthetic.address,
      minterAccount.wallet,
      ctx.arc.synth().core.address,
      BORROW_AMOUNT.mul(100),
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  it('should be able to repay to increase the c-ratio', async () => {
    // Create a 200% collateralised position
    await ctx.arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, minterAccount.wallet);

    let position = await ctx.arc.synth().core.getPosition(0);
    expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT);
    expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT);

    expect(await ctx.arc.synthetic().totalSupply()).to.equal(BORROW_AMOUNT);

    await ctx.arc.repay(0, BORROW_AMOUNT.div(2), 0, minterAccount.wallet);

    // Ensure that the synthetic supply has been burned by repaying
    expect(await ctx.arc.synthetic().totalSupply()).to.equal(BORROW_AMOUNT.div(2));

    position = await ctx.arc.synth().core.getPosition(0);
    expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT);
    expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT.div(2));
  });

  it('should be able to repay (withdraw) to decrease the c-ratio', async () => {
    // Create a 400% collateralised position
    await ctx.arc.openPosition(COLLATERAL_AMOUNT.mul(2), BORROW_AMOUNT, minterAccount.wallet);

    const currentPrice = await ctx.arc.synth().oracle.fetchCurrentPrice();

    let position = await ctx.arc.synth().core.getPosition(0);
    let collateralDelta = await ctx.arc
      .synth()
      .core.calculateCollateralDelta(
        position.collateralAmount,
        position.borrowedAmount.value,
        currentPrice,
      );

    expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT.mul(2));
    expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT);
    expect(collateralDelta.value).to.equal(COLLATERAL_AMOUNT);
    expect(collateralDelta.sign).to.be.true;

    // Withdraw the maximum amount to put it at the boundary (200%)
    await ctx.arc.repay(0, 0, COLLATERAL_AMOUNT, minterAccount.wallet);
    position = await ctx.arc.synth().core.getPosition(0);

    collateralDelta = await ctx.arc
      .synth()
      .core.calculateCollateralDelta(
        position.collateralAmount,
        position.borrowedAmount.value,
        currentPrice,
      );

    expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT);
    expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT);
    expect(collateralDelta.value).to.equal(Zero);
    expect(collateralDelta.sign).to.be.true;
  });

  it('should be able to repay to make the position collateralized ', async () => {
    // Create a 200% collateralised position
    await ctx.arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, minterAccount.wallet);

    // Drop the price to $0.50 so the position is now 100% (should be 200%)
    const newPrice = ArcDecimal.new(0.5).value;
    await ctx.arc.updatePrice(newPrice);

    let position = await ctx.arc.synth().core.getPosition(0);

    let collateralDelta = await ctx.arc
      .synth()
      .core.calculateCollateralDelta(position.collateralAmount, position.borrowedAmount.value, {
        value: newPrice,
      });

    // Basically we're underwater by our initial collateral deposit
    expect(collateralDelta.value).to.equal(COLLATERAL_AMOUNT);
    expect(collateralDelta.sign).to.be.false;

    // Double check to make sure we're under-collateralized
    expect(await ctx.arc.synth().core.isCollateralized(position)).to.be.false;

    await ctx.arc.repay(0, BORROW_AMOUNT.div(2), 0, minterAccount.wallet);
    position = await ctx.arc.synth().core.getPosition(0);

    // We should be happy campers now
    expect(await ctx.arc.synth().core.isCollateralized(position)).to.be.true;

    const totals = await ctx.arc.synth().core.getTotals();
  });

  it('should not be able to withdraw if undercollateralized', async () => {
    // Create a 200% collateralised position
    await ctx.arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, minterAccount.wallet);

    // Drop the price to $0.99999 so the position is just under 200%
    const newPrice = ArcDecimal.new(0.999999).value;
    await ctx.arc.updatePrice(newPrice);

    // When trying to withdraw right below the undercollat amount then it should revert
    expect(ctx.arc.repay(0, 0, 1, minterAccount.wallet)).to.be.revertedWith(REPAY_WITHDRAW_ERROR);
  });

  it('should not be able to repay more than it owes (positive debt not allowed)', async () => {
    await ctx.arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, minterAccount.wallet);
    await ctx.arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, otherAccount.wallet);

    await Token.transfer(
      ctx.arc.syntheticAddress(),
      minterAccount.address,
      BORROW_AMOUNT,
      otherAccount.wallet,
    );

    expect(ctx.arc.repay(0, BORROW_AMOUNT.mul(3), COLLATERAL_AMOUNT, minterAccount.wallet)).to.be
      .reverted;
  });

  it.only('should be able to repay accumulated interest (12 months)', async () => {
    await ctx.arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, minterAccount.wallet);

    // Set the time to one year from now in order for interest to accumulate
    await ctx.arc.updateTime(ONE_YEAR_IN_SECONDS);
    await ctx.arc.synth().core.updateIndexAndPrint();

    let borrowIndex = await ctx.arc.core().getBorrowIndex();
    let position = await ctx.arc.getPosition(0);

    const totalOwed = BORROW_AMOUNT.bigMul(borrowIndex[0]);
    const interestOwed = await totalOwed.sub(BORROW_AMOUNT);

    await ctx.arc.openPosition(COLLATERAL_AMOUNT.mul(4), BORROW_AMOUNT.mul(4), otherAccount.wallet);

    await Token.transfer(
      ctx.arc.syntheticAddress(),
      minterAccount.address,
      BORROW_AMOUNT.mul(4),
      otherAccount.wallet,
    );

    const originalCollateralBalance = await ctx.arc
      .synth()
      .collateral.balanceOf(minterAccount.address);

    // Repay the interest owed
    await ctx.arc.repay(0, interestOwed, 0, minterAccount.wallet);

    expect(await ctx.arc.synth().collateral.balanceOf(minterAccount.address)).to.equal(
      originalCollateralBalance,
    );

    position = await ctx.arc.getPosition(0);
    borrowIndex = await ctx.arc.core().getBorrowIndex();

    expect(position.borrowedAmount.value.bigMul(borrowIndex[0])).to.equal(BORROW_AMOUNT);

    const outstandingBorrow = position.borrowedAmount.value.bigMul(borrowIndex[0]);
    const availableCollateral = await ctx.arc
      .core()
      .calculateCollateralDelta(position.collateralAmount, 1, {
        value: BASE,
      });

    expect(availableCollateral.value.gte(ArcDecimal.new(99.99).value));
    position = await ctx.arc.getPosition(0);

    // Repay the remaining amount to get back all of the collateral
    await ctx.arc.repay(0, outstandingBorrow, availableCollateral.value, minterAccount.wallet);

    position = await ctx.arc.getPosition(0);
    expect(await ctx.arc.synth().collateral.balanceOf(minterAccount.address)).to.equal(
      originalCollateralBalance.add(availableCollateral.value),
    );
  });
});
