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
import { Operation } from '../../../src/types';
import { BigNumber } from 'ethers/utils';
import { TEN_PERCENT, ONE_YEAR_IN_SECONDS, BASE } from '../../../src/constants';
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
    initialCollateralBalances: [[minterAccount, COLLATERAL_AMOUNT.mul(5)]],
  } as D2ArcOptions;

  await initializeD2Arc(ctx, setupOptions);
}

const expect = getWaffleExpect();

describe('D2Core.operateAction(Open)', () => {
  let ctx: ITestContext = {};

  before(async () => {
    ctx = await d2Setup(init);
  });

  addSnapshotBeforeRestoreAfterEach();

  it('should be be able to open at the exact c-ratio', async () => {
    const result = await ctx.arc.openPosition(
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      minterAccount.signer,
    );

    // Simple tests ensuring the events are emitting the correct information
    expect(result.operation).to.equal(Operation.Open, 'Invalid operation emitted');
    expect(result.params.amountOne).to.equal(
      COLLATERAL_AMOUNT,
      'Invalid collateral amount emitted',
    );
    expect(result.params.amountTwo).to.equal(BORROW_AMOUNT, 'Invalid borrow amount emitted');
    expect(result.params.id).to.equal(new BigNumber(0));
    expect(result.updatedPosition.borrowedAmount.value).to.equal(BORROW_AMOUNT);
    expect(result.updatedPosition.collateralAmount.value).to.equal(COLLATERAL_AMOUNT);

    // Check the newly created position has the correct amounts set
    const position = await ctx.arc.synth().core.getPosition(0);
    expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT);
    expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT);
    expect(position.owner).to.equal(minterAccount.address);

    const totals = await ctx.arc.getSynthTotals();
    expect(totals[0]).to.equal(COLLATERAL_AMOUNT);
    expect(totals[1]).to.equal(BORROW_AMOUNT);

    expect(await ctx.arc.synth().collateral.balanceOf(ctx.arc.syntheticAddress())).to.equal(
      COLLATERAL_AMOUNT,
    );
    expect(await ctx.arc.synthetic().totalSupply()).to.equal(BORROW_AMOUNT);
    expect(await ctx.arc.synthetic().balanceOf(minterAccount.address)).to.equal(BORROW_AMOUNT);
  });

  it('should be able to open above the c-ratio', async () => {
    const result = await ctx.arc.openPosition(
      COLLATERAL_AMOUNT.mul(2),
      BORROW_AMOUNT,
      minterAccount.signer,
    );

    const position = await ctx.arc.getPosition(0);
    expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT);
    expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT.mul(2));
    expect(position.owner).to.equal(minterAccount.address);
  });

  it('should not be able to open below the required c-ratio', async () => {
    await expect(
      ctx.arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT.add(1), minterAccount.signer),
    ).to.be.reverted;

    await expect(
      ctx.arc.openPosition(COLLATERAL_AMOUNT.sub(1), BORROW_AMOUNT, minterAccount.signer),
    ).to.be.reverted;
  });

  it('should be able to calculate the principle amount', async () => {
    await ctx.arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, minterAccount.signer);

    expect((await ctx.arc.getSynthTotals())[1]).to.equal(BORROW_AMOUNT);

    // The printer and the core should have no synths printed before this point
    expect(await ctx.arc.synth().synthetic.balanceOf(ctx.arc.coreAddress())).to.equal(Zero);
    expect(await ctx.arc.synth().synthetic.balanceOf(printerAccount.address)).to.equal(Zero);

    // Set the time to one year from now in order for interest to accumulate
    await ctx.arc.updateTime(ONE_YEAR_IN_SECONDS);
    await ctx.arc.synth().core.updateIndex();

    const borrowIndex = await ctx.arc.synth().core.getBorrowIndex();

    // In order to calculate the new index we need to multiply one year
    // by the interest rate (in seconds)
    const calculatedIndex = BASE.add(
      (await ctx.arc.synth().core.getInterestRate()).mul(ONE_YEAR_IN_SECONDS),
    );

    // Our calculated index should equal the newly set borrow index
    expect(borrowIndex[0]).to.equal(calculatedIndex);

    // Open a second position which is borrowing the same amount but
    // should have a lower borrow amount since it's depositing at a time
    // where the borrow index is higher
    const result = await ctx.arc.openPosition(
      COLLATERAL_AMOUNT.mul(2),
      BORROW_AMOUNT,
      minterAccount.signer,
    );

    const position = await ctx.arc.getPosition(result.params.id);
    const secondPositionBorrowedAmount = BORROW_AMOUNT.bigDiv(calculatedIndex);

    // Check the borrowed amount is the interest adjusted value
    expect(position.borrowedAmount.value).to.equal(secondPositionBorrowedAmount);
    expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT.mul(2));
    expect(position.owner).to.equal(minterAccount.address);

    // Compute how much the interest adjusted borrow amount for the first position is
    const firstPositionAccumulatedAmount = BORROW_AMOUNT.bigMul(calculatedIndex);

    // Thet total borrow amount should be the first position accumulated with the newly
    // created second position
    const newBorrowTotal = secondPositionBorrowedAmount.add(firstPositionAccumulatedAmount);

    const totals = await ctx.arc.getSynthTotals();
    expect(totals[0]).to.equal(COLLATERAL_AMOUNT.mul(3));
    expect(totals[1]).to.equal(newBorrowTotal);

    const issuedAmount = await ctx.arc.synthetic().getMinterIssued(ctx.arc.coreAddress());
    expect(issuedAmount.value).to.equal(BORROW_AMOUNT.mul(2));
    expect(issuedAmount.sign).to.be.true;

    // The interest increase is simply how much the total is less the amount we know we deposited (par values)
    const interestIncrease = newBorrowTotal.sub(BORROW_AMOUNT.add(secondPositionBorrowedAmount));

    expect(await ctx.arc.synth().collateral.balanceOf(ctx.arc.syntheticAddress())).to.equal(
      COLLATERAL_AMOUNT.mul(3),
    );
    expect(await ctx.arc.synthetic().totalSupply()).to.equal(BORROW_AMOUNT.mul(2));
    expect(await ctx.arc.synthetic().balanceOf(minterAccount.address)).to.equal(
      BORROW_AMOUNT.mul(2),
    );
  });

  it('should not be able to borrow below in the minimum position amount', async () => {
    await ctx.arc.core().setLimits(0, COLLATERAL_AMOUNT.add(1));
    await expect(ctx.arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, minterAccount.signer)).to.be
      .reverted;
  });
});
