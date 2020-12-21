import 'module-alias/register';

import { expect } from 'chai';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';
import { TEN_PERCENT, ONE_YEAR_IN_SECONDS, BASE } from '@src/constants';

import { generateContext, ITestContext } from '../context';
import { setupMozart } from '../setup';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';
import { mozartFixture } from '../fixtures';
import { MozartTestArc } from '@src/MozartTestArc';

const COLLATERAL_AMOUNT = ArcNumber.new(200);
const BORROW_AMOUNT = ArcNumber.new(50);

describe('Mozart.operateAction(Borrow)', () => {
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

  it('should be able to borrow above the c-ratio', async () => {
    const prePosition = await arc.getPosition(0);
    expect(prePosition.collateralAmount.value).to.equal(COLLATERAL_AMOUNT);
    expect(prePosition.borrowedAmount.value).to.equal(BORROW_AMOUNT);

    // Set it right at the boundary of the c-ratio
    await arc.borrow(0, 0, BORROW_AMOUNT, ctx.signers.minter);

    const postPosition = await arc.getPosition(0);
    expect(postPosition.borrowedAmount.value).to.equal(BORROW_AMOUNT.mul(2));
    const price = await arc.synth().core.getCurrentPrice();
    expect(await arc.synth().core.isCollateralized(postPosition, price)).to.be.true;
  });

  it.only('should update the index', async () => {
    // Set the time to one year from now in order for interest to accumulate
    const totalBorrowed0 = (await arc.core().getTotals())[1];

    await arc.updateTime(ONE_YEAR_IN_SECONDS);
    await arc.synth().core.updateIndex();

    let borrowIndex = await arc.core().getBorrowIndex();
    const totalBorrowed1 = (await arc.core().getTotals())[1];

    // In order to calculate the new index we need to multiply one year
    // by the interest rate (in seconds)
    let calculatedIndex = BASE.add(
      (await arc.synth().core.getInterestRate()).mul(ONE_YEAR_IN_SECONDS),
    );

    // Our calculated index should equal the newly set borrow index
    expect(borrowIndex[0]).to.equal(calculatedIndex);
    expect(totalBorrowed1).to.equal(ArcNumber.bigMul(totalBorrowed0, borrowIndex[0]));

    // Set the time to two years from now in order for interest to accumulate
    await arc.updateTime(ONE_YEAR_IN_SECONDS.mul(2));
    await arc.synth().core.updateIndex();

    const totalBorrowed2 = (await arc.core().getTotals())[1];

    borrowIndex = await arc.synth().core.getBorrowIndex();

    const earnedInterest = (await arc.synth().core.getInterestRate()).mul(ONE_YEAR_IN_SECONDS);
    calculatedIndex = calculatedIndex.add(earnedInterest);

    // Our calculated index should equal the newly set borrow index
    expect(borrowIndex[0]).to.equal(calculatedIndex);

    expect(totalBorrowed2).to.equal(ArcNumber.bigMul(borrowIndex[0], earnedInterest.add(BASE)));
  });

  it('should be able to borrow more if the c-ratio is not at the minimum', async () => {
    const beforePosition = await arc.getPosition(0);
    await arc.borrow(0, 0, BORROW_AMOUNT, ctx.signers.minter);

    const afterPosition = await arc.getPosition(0);

    expect(afterPosition.collateralAmount.value).to.equal(beforePosition.collateralAmount.value);
    expect(afterPosition.borrowedAmount.value).to.equal(
      beforePosition.borrowedAmount.value.add(BORROW_AMOUNT),
    );
    await expect(arc.borrow(0, 0, 1, ctx.signers.minter)).to.be.reverted;
  });

  it('should be able to borrow from someone elses account', async () => {
    await expect(arc.borrow(0, 0, BORROW_AMOUNT, ctx.signers.unauthorised)).to.be.reverted;
  });

  it('should not be able to borrow without enough collateral', async () => {
    await expect(arc.borrow(0, 0, BORROW_AMOUNT.add(1), ctx.signers.minter)).be.reverted;
    await expect(arc.borrow(0, COLLATERAL_AMOUNT.sub(1), BORROW_AMOUNT.mul(3), ctx.signers.minter))
      .be.reverted;
  });

  it('should be able to borrow more if more collateral provided', async () => {
    await arc.borrow(0, 0, BORROW_AMOUNT, ctx.signers.minter);
    await arc.borrow(0, COLLATERAL_AMOUNT, BORROW_AMOUNT.mul(2), ctx.signers.minter);

    const position = await arc.getPosition(0);
    const price = await arc.synth().oracle.fetchCurrentPrice();
    const collateralDelta = await arc
      .core()
      .calculateCollateralDelta(position.collateralAmount, position.borrowedAmount.value, price);

    expect(collateralDelta.value).to.equal(0);

    await expect(arc.borrow(0, 0, BORROW_AMOUNT, ctx.signers.minter)).to.be.reverted;
  });

  it('should not be able to borrow more if the price decreases', async () => {
    await arc.updatePrice(ArcDecimal.new(0.5).value);
    await expect(arc.borrow(0, 0, 1, ctx.signers.minter)).to.be.reverted;
  });

  it('should not be able to borrow more if the interest payments have increased', async () => {
    await arc.updatePrice(ArcDecimal.new(0.5).value);

    expect(await arc.isCollateralized(0)).to.be.true;

    // Set the time to two years from now in order for interest to accumulate
    await arc.updateTime(ONE_YEAR_IN_SECONDS);
    await arc.synth().core.updateIndex();

    expect(await arc.isCollateralized(0)).to.be.false;
  });

  it('should not be able to borrow more the collateral limit', async () => {
    await arc.core().setLimits(COLLATERAL_AMOUNT, 0);
    await expect(arc.borrow(0, 1, 0, ctx.signers.minter)).to.be.reverted;
  });
});
