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
import { BigNumber, BigNumberish } from 'ethers/utils';
import { TEN_PERCENT, ONE_YEAR_IN_SECONDS, BASE } from '../../../src/constants';
import Token from '@src/utils/Token';
import { Zero } from 'ethers/constants';

let ownerAccount: Account;
let minterAccount: Account;
let printerAccount: Account;
let otherAccount: Account;

const COLLATERAL_AMOUNT = ArcNumber.new(200);
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

describe('D2Core.operateAction(Borrow)', () => {
  let ctx: ITestContext = {};

  before(async () => {
    ctx = await d2Setup(init);
    // Open a position at 400% c-ratio
    await ctx.arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, minterAccount.signer);
    // Set an unlimited approval
    await Token.approve(
      ctx.arc.synth().synthetic.address,
      minterAccount.signer,
      ctx.arc.synth().core.address,
      BORROW_AMOUNT.mul(100),
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  it('should be able to borrow above the c-ratio', async () => {
    const prePosition = await ctx.arc.getPosition(0);
    expect(prePosition.collateralAmount.value).to.equal(COLLATERAL_AMOUNT);
    expect(prePosition.borrowedAmount.value).to.equal(BORROW_AMOUNT);

    // Set it right at the boundary of the c-ratio
    await ctx.arc.borrow(0, 0, BORROW_AMOUNT, minterAccount.signer);

    const postPosition = await ctx.arc.getPosition(0);
    expect(postPosition.borrowedAmount.value).to.equal(BORROW_AMOUNT.mul(2));
    expect(await ctx.arc.synth().core.isCollateralized(postPosition)).to.be.true;
  });

  it('should update the index', async () => {
    // Set the time to one year from now in order for interest to accumulate
    await ctx.arc.updateTime(ONE_YEAR_IN_SECONDS);
    await ctx.arc.synth().core.updateIndex();

    let borrowIndex = await ctx.arc.synth().core.getBorrowIndex();

    // In order to calculate the new index we need to multiply one year
    // by the interest rate (in seconds)
    let calculatedIndex = BASE.add(
      (await ctx.arc.synth().core.getInterestRate()).mul(ONE_YEAR_IN_SECONDS),
    );

    // Our calculated index should equal the newly set borrow index
    expect(borrowIndex[0]).to.equal(calculatedIndex);

    // Set the time to two years from now in order for interest to accumulate
    await ctx.arc.updateTime(ONE_YEAR_IN_SECONDS.mul(2));
    await ctx.arc.synth().core.updateIndex();

    borrowIndex = await ctx.arc.synth().core.getBorrowIndex();

    calculatedIndex = calculatedIndex.add(
      (await ctx.arc.synth().core.getInterestRate()).mul(ONE_YEAR_IN_SECONDS),
    );

    // Our calculated index should equal the newly set borrow index
    expect(borrowIndex[0]).to.equal(calculatedIndex);
  });

  it('should be able to borrow more if the c-ratio is not at the minimum', async () => {
    const beforePosition = await ctx.arc.getPosition(0);
    await ctx.arc.borrow(0, 0, BORROW_AMOUNT, minterAccount.signer);

    const afterPosition = await ctx.arc.getPosition(0);

    expect(afterPosition.collateralAmount.value).to.equal(beforePosition.collateralAmount.value);
    expect(afterPosition.borrowedAmount.value).to.equal(
      beforePosition.borrowedAmount.value.add(BORROW_AMOUNT),
    );
    await expect(ctx.arc.borrow(0, 0, 1, minterAccount.signer)).to.be.reverted;
  });

  it('should be able to borrow from someone elses account', async () => {
    await expect(ctx.arc.borrow(0, 0, BORROW_AMOUNT, otherAccount.signer)).to.be.reverted;
  });

  it('should not be able to borrow without enough collateral', async () => {
    await expect(ctx.arc.borrow(0, 0, BORROW_AMOUNT.add(1), minterAccount.signer)).be.reverted;
    await expect(
      ctx.arc.borrow(0, COLLATERAL_AMOUNT.sub(1), BORROW_AMOUNT.mul(3), minterAccount.signer),
    ).be.reverted;
  });

  it('should be able to borrow more if more collateral provided', async () => {
    await ctx.arc.borrow(0, 0, BORROW_AMOUNT, minterAccount.signer);
    await ctx.arc.borrow(0, COLLATERAL_AMOUNT, BORROW_AMOUNT.mul(2), minterAccount.signer);

    let position = await ctx.arc.getPosition(0);
    const price = await ctx.arc.synth().oracle.fetchCurrentPrice();
    const collateralDelta = await ctx.arc
      .core()
      .calculateCollateralDelta(position.collateralAmount, position.borrowedAmount.value, price);

    expect(collateralDelta.value).to.equal(Zero);

    await expect(ctx.arc.borrow(0, 0, BORROW_AMOUNT, minterAccount.signer)).to.be.reverted;
  });

  it('should not be able to borrow more if the price decreases', async () => {
    await ctx.arc.updatePrice(ArcDecimal.new(0.5).value);
    await expect(ctx.arc.borrow(0, 0, 1, minterAccount.signer)).to.be.reverted;
  });

  it('should not be able to borrow more if the interest payments have increased', async () => {
    await ctx.arc.updatePrice(ArcDecimal.new(0.5).value);

    expect(await ctx.arc.isCollateralized(0)).to.be.true;

    // Set the time to two years from now in order for interest to accumulate
    await ctx.arc.updateTime(ONE_YEAR_IN_SECONDS);
    await ctx.arc.synth().core.updateIndex();

    expect(await ctx.arc.isCollateralized(0)).to.be.false;
  });

  it('should not be able to borrow more the collateral limit', async () => {
    await ctx.arc.core().setLimits(COLLATERAL_AMOUNT, 0);
    await expect(ctx.arc.borrow(0, 1, 0, minterAccount.signer)).to.be.reverted;
  });
});
