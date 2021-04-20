import 'module-alias/register';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';

import { expect } from 'chai';
import { mozartFixture } from '../fixtures';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';
import { generateContext, ITestContext } from '../context';
import { setupMozart } from '../setup';
import { MozartTestArc } from '@src/MozartTestArc';

import { BASE, TEN_PERCENT } from '@src/constants';
import { ONE_YEAR_IN_SECONDS } from '@src/constants';

import Token from '@src/utils/Token';

xdescribe('Mozart.operateAction(Repay)', () => {
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

    // Set an unlimited approval
    await Token.approve(
      arc.synth().synthetic.address,
      ctx.signers.minter,
      arc.synth().core.address,
      BORROW_AMOUNT.mul(100),
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  it('should be able to repay to increase the c-ratio', async () => {
    // Create a 200% collateralised position
    await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.minter);

    let position = await arc.synth().core.getPosition(0);
    expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT);
    expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT);

    expect(await arc.synthetic().totalSupply()).to.equal(BORROW_AMOUNT);

    await arc.repay(0, BORROW_AMOUNT.div(2), 0, ctx.signers.minter);

    // Ensure that the synthetic supply has been burned by repaying
    expect(await arc.synthetic().totalSupply()).to.equal(BORROW_AMOUNT.div(2));

    position = await arc.synth().core.getPosition(0);
    expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT);
    expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT.div(2));
  });

  it('should not be able to repay from someone elses position', async () => {
    // Create a 400% collateralised position
    await arc.openPosition(COLLATERAL_AMOUNT.mul(2), BORROW_AMOUNT, ctx.signers.minter);

    // Withdraw the maximum amount to put it at the boundary (200%)
    await expect(arc.repay(0, 0, COLLATERAL_AMOUNT, ctx.signers.unauthorised)).to.be.reverted;
  });

  it('should be able to repay (withdraw) to decrease the c-ratio', async () => {
    // Create a 400% collateralised position
    await arc.openPosition(COLLATERAL_AMOUNT.mul(2), BORROW_AMOUNT, ctx.signers.minter);

    const currentPrice = await arc.synth().oracle.fetchCurrentPrice();

    let position = await arc.synth().core.getPosition(0);
    let collateralDelta = await arc
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
    await arc.repay(0, 0, COLLATERAL_AMOUNT, ctx.signers.minter);
    position = await arc.synth().core.getPosition(0);

    collateralDelta = await arc
      .synth()
      .core.calculateCollateralDelta(
        position.collateralAmount,
        position.borrowedAmount.value,
        currentPrice,
      );

    expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT);
    expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT);
    expect(collateralDelta.value).to.equal(0);
    expect(collateralDelta.sign).to.be.true;
  });

  it('should be able to repay to make the position collateralized ', async () => {
    // Create a 200% collateralised position
    await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.minter);

    // Drop the price to $0.50 so the position is now 100% (should be 200%)
    const newPrice = ArcDecimal.new(0.5).value;
    await arc.updatePrice(newPrice);

    let position = await arc.synth().core.getPosition(0);

    const collateralDelta = await arc
      .synth()
      .core.calculateCollateralDelta(position.collateralAmount, position.borrowedAmount.value, {
        value: newPrice,
      });

    // Basically we're underwater by our initial collateral deposit
    expect(collateralDelta.value).to.equal(COLLATERAL_AMOUNT);
    expect(collateralDelta.sign).to.be.false;

    // Double check to make sure we're under-collateralized
    const price = await arc.core().getCurrentPrice();
    expect(await arc.synth().core.isCollateralized(position, price)).to.be.false;

    await arc.repay(0, BORROW_AMOUNT.div(2), 0, ctx.signers.minter);
    position = await arc.synth().core.getPosition(0);

    // We should be happy campers now
    expect(await arc.synth().core.isCollateralized(position, price)).to.be.true;
  });

  it('should not be able to withdraw if undercollateralized', async () => {
    // Create a 200% collateralised position
    await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.minter);

    // Drop the price to $0.99999 so the position is just under 200%
    const newPrice = ArcDecimal.new(0.999999).value;
    await arc.updatePrice(newPrice);

    // When trying to withdraw right below the undercollat amount then it should revert
    await expect(arc.repay(0, 0, 1, ctx.signers.minter)).to.be.reverted;
  });

  it('should not be able to repay more than it owes (positive debt not allowed)', async () => {
    await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.minter);
    await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.unauthorised);

    await Token.transfer(
      arc.syntheticAddress(),
      ctx.signers.minter.address,
      BORROW_AMOUNT,
      ctx.signers.unauthorised,
    );

    expect(arc.repay(0, BORROW_AMOUNT.mul(3), COLLATERAL_AMOUNT, ctx.signers.minter)).to.be
      .reverted;
  });

  it('should be able to repay accumulated interest (12 months)', async () => {
    await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.minter);

    // Set the time to one year from now in order for interest to accumulate
    await arc.updateTime(ONE_YEAR_IN_SECONDS);
    await arc.synth().core.updateIndex();

    let borrowIndex = await arc.core().getBorrowIndex();
    let position = await arc.getPosition(0);

    const totalOwed = ArcNumber.bigMul(BORROW_AMOUNT, borrowIndex[0]);
    const interestOwed = await totalOwed.sub(BORROW_AMOUNT);

    await arc.openPosition(
      COLLATERAL_AMOUNT.mul(4),
      BORROW_AMOUNT.mul(4),
      ctx.signers.unauthorised,
    );

    await Token.transfer(
      arc.syntheticAddress(),
      ctx.signers.minter.address,
      BORROW_AMOUNT.mul(4),
      ctx.signers.unauthorised,
    );

    const originalCollateralBalance = await arc
      .synth()
      .collateral.balanceOf(ctx.signers.minter.address);

    // Repay the interest owed
    await arc.repay(0, interestOwed, 0, ctx.signers.minter);

    expect(await arc.synth().collateral.balanceOf(ctx.signers.minter.address)).to.equal(
      originalCollateralBalance,
    );

    position = await arc.getPosition(0);
    borrowIndex = await arc.core().getBorrowIndex();

    expect(ArcNumber.bigMul(position.borrowedAmount.value, borrowIndex[0])).to.equal(BORROW_AMOUNT);

    const outstandingBorrow = ArcNumber.bigMul(position.borrowedAmount.value, borrowIndex[0]);
    const availableCollateral = await arc
      .core()
      .calculateCollateralDelta(position.collateralAmount, 1, {
        value: BASE,
      });

    expect(availableCollateral.value.gte(ArcDecimal.new(99.99).value));
    position = await arc.getPosition(0);

    // Repay the remaining amount to get back all of the collateral
    await arc.repay(0, outstandingBorrow, availableCollateral.value, ctx.signers.minter);

    position = await arc.getPosition(0);
    expect(await arc.synth().collateral.balanceOf(ctx.signers.minter.address)).to.equal(
      originalCollateralBalance.add(availableCollateral.value),
    );
  });
});
