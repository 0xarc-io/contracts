import 'module-alias/register';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';

import { expect } from 'chai';
import { mozartFixture } from '../fixtures';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';
import { generateContext, ITestContext } from '../context';
import { setupMozart } from '../setup';

import { BASE, TEN_PERCENT } from '@src/constants';
import { Operation } from '@arc-types/core';
import { BigNumber } from '@ethersproject/bignumber';
import { MozartTestArc } from '@src/MozartTestArc';
import { ONE_YEAR_IN_SECONDS } from '@src/constants';

describe('Mozart.operateAction(Open)', () => {
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
  });

  addSnapshotBeforeRestoreAfterEach();

  it('should be be able to open at the exact c-ratio', async () => {
    const result = await ctx.sdks.mozart.openPosition(
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      ctx.signers.minter,
    );

    // Simple tests ensuring the events are emitting the correct information
    expect(result.operation).to.equal(Operation.Open, 'Invalid operation emitted');
    expect(result.params.amountOne).to.equal(
      COLLATERAL_AMOUNT,
      'Invalid collateral amount emitted',
    );
    expect(result.params.amountTwo).to.equal(BORROW_AMOUNT, 'Invalid borrow amount emitted');
    expect(result.params.id).to.equal(BigNumber.from(0));
    expect(result.updatedPosition.borrowedAmount.value).to.equal(BORROW_AMOUNT);
    expect(result.updatedPosition.collateralAmount.value).to.equal(COLLATERAL_AMOUNT);

    // Check the newly created position has the correct amounts set
    const position = await arc.synth().core.getPosition(0);
    expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT);
    expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT);
    expect(position.owner).to.equal(ctx.signers.minter.address);

    const totals = await arc.getSynthTotals();
    expect(totals[0]).to.equal(COLLATERAL_AMOUNT);
    expect(totals[1]).to.equal(BORROW_AMOUNT);

    expect(await arc.synth().collateral.balanceOf(arc.syntheticAddress())).to.equal(
      COLLATERAL_AMOUNT,
    );
    expect(await arc.synthetic().totalSupply()).to.equal(BORROW_AMOUNT);
    expect(await arc.synthetic().balanceOf(ctx.signers.minter.address)).to.equal(BORROW_AMOUNT);
  });

  it('should be able to open above the c-ratio', async () => {
    await arc.openPosition(COLLATERAL_AMOUNT.mul(2), BORROW_AMOUNT, ctx.signers.minter);

    const position = await arc.getPosition(0);
    expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT);
    expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT.mul(2));
    expect(position.owner).to.equal(ctx.signers.minter.address);
  });

  it('should not be able to open below the required c-ratio', async () => {
    await expect(arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT.add(1), ctx.signers.minter)).to
      .be.reverted;

    await expect(arc.openPosition(COLLATERAL_AMOUNT.sub(1), BORROW_AMOUNT, ctx.signers.minter)).to
      .be.reverted;
  });

  it('should be able to calculate the principle amount', async () => {
    await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.minter);

    expect((await arc.getSynthTotals())[1]).to.equal(BORROW_AMOUNT);

    // The printer and the core should have no synths printed before this point
    expect(await arc.synth().synthetic.balanceOf(arc.coreAddress())).to.equal(0);

    // Set the time to one year from now in order for interest to accumulate
    await arc.updateTime(ONE_YEAR_IN_SECONDS);
    await arc.synth().core.updateIndex();

    const borrowIndex = await arc.synth().core.getBorrowIndex();

    // In order to calculate the new index we need to multiply one year
    // by the interest rate (in seconds)
    const calculatedIndex = BASE.add(
      (await arc.synth().core.getInterestRate()).mul(ONE_YEAR_IN_SECONDS),
    );

    // Our calculated index should equal the newly set borrow index
    expect(borrowIndex[0]).to.equal(calculatedIndex);

    // Open a second position which is borrowing the same amount but
    // should have a lower borrow amount since it's depositing at a time
    // where the borrow index is higher
    const result = await arc.openPosition(
      COLLATERAL_AMOUNT.mul(2),
      BORROW_AMOUNT,
      ctx.signers.minter,
    );

    const position = await arc.getPosition(result.params.id);
    const secondPositionBorrowedAmount = ArcNumber.bigDiv(BORROW_AMOUNT, calculatedIndex);

    // Check the borrowed amount is the interest adjusted value
    expect(position.borrowedAmount.value).to.equal(secondPositionBorrowedAmount);
    expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT.mul(2));
    expect(position.owner).to.equal(ctx.signers.minter.address);

    // Compute how much the interest adjusted borrow amount for the first position is
    const firstPositionAccumulatedAmount = ArcNumber.bigMul(BORROW_AMOUNT, calculatedIndex);

    // Thet total borrow amount should be the first position accumulated with the newly
    // created second position
    const newBorrowTotal = secondPositionBorrowedAmount.add(firstPositionAccumulatedAmount);

    const totals = await arc.getSynthTotals();
    expect(totals[0]).to.equal(COLLATERAL_AMOUNT.mul(3));
    expect(totals[1]).to.equal(newBorrowTotal);

    const issuedAmount = await arc.synthetic().getMinterIssued(arc.coreAddress());
    expect(issuedAmount.value).to.equal(BORROW_AMOUNT.mul(2));
    expect(issuedAmount.sign).to.be.true;

    expect(await arc.synth().collateral.balanceOf(arc.syntheticAddress())).to.equal(
      COLLATERAL_AMOUNT.mul(3),
    );
    expect(await arc.synthetic().totalSupply()).to.equal(BORROW_AMOUNT.mul(2));
    expect(await arc.synthetic().balanceOf(ctx.signers.minter.address)).to.equal(
      BORROW_AMOUNT.mul(2),
    );
  });

  it('should not be able to borrow below in the minimum position amount', async () => {
    await arc.core().setLimits(0, COLLATERAL_AMOUNT.add(1));
    await expect(arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.minter)).to.be
      .reverted;
  });
});
