import 'module-alias/register';

import { expect } from 'chai';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';
import { TEN_PERCENT, ONE_YEAR_IN_SECONDS } from '@src/constants';

import { generateContext, ITestContext } from '../context';
import { setupMozart } from '../setup';
import { mozartFixture } from '../fixtures';
import { MozartTestArc } from '@src/MozartTestArc';
import Token from '@src/utils/Token';
import { MozartSavingsV1 } from '@src/typings/MozartSavingsV1';
import { MockMozartSavingsV2Factory } from '@src/typings';

const COLLATERAL_AMOUNT = ArcNumber.new(200);
const BORROW_AMOUNT = ArcNumber.new(50);

describe('Mozart.integration', () => {
  let ctx: ITestContext;
  let arc: MozartTestArc;
  let savings: MozartSavingsV1;

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
    savings = ctx.contracts.mozart.savings;
  });

  it('should be able to open a collateralized position', async () => {
    // Open a position at 400% c-ratio
    await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.minter);

    // Set an unlimited approval
    await Token.approve(
      arc.synth().synthetic.address,
      ctx.signers.minter,
      arc.synth().core.address,
      BORROW_AMOUNT.mul(100),
    );
  });

  it('should be able deposit to increase the c-ratio', async () => {
    await arc.borrow(0, COLLATERAL_AMOUNT, 0, ctx.signers.minter);
  });

  it('should be able to accumulate more interest', async () => {
    await arc.updateTime(ONE_YEAR_IN_SECONDS);
    await savings.s;
    await arc.core().updateIndex();

    const borrowIndex = (await arc.core().getBorrowIndex())[0];
    const position = await arc.getPosition(0);

    expect(ArcNumber.bigMul(borrowIndex, position.borrowedAmount.value).gte(BORROW_AMOUNT));
  });

  it('should be able to stake and claim newly minted tokens', async () => {
    await Token.transfer(
      arc.syntheticAddress(),
      ctx.signers.staker.address,
      BORROW_AMOUNT,
      ctx.signers.minter,
    );

    await Token.approve(arc.syntheticAddress(), ctx.signers.staker, savings.address, BORROW_AMOUNT);

    await savings.updateIndex();
    await savings.connect(ctx.signers.staker).stake(BORROW_AMOUNT);

    await ctx.contracts.mozart.savings
      .connect(ctx.signers.admin)
      .setCurrentTimestamp(ONE_YEAR_IN_SECONDS);

    await savings.updateIndex();

    const accruedBalance = await savings.balanceOf(ctx.signers.staker.address);
    const currentIndex = await savings.savingsIndex();
    const convertedBalanance = ArcNumber.bigMul(accruedBalance, currentIndex);

    await savings.connect(ctx.signers.staker).unstake(convertedBalanance);

    expect(await arc.synthetic().balanceOf(ctx.signers.staker.address)).to.equal(
      convertedBalanance,
    );
  });

  it('should be able to pay back the accumulated interest', async () => {});

  it('should be able to wait to accumulate enough interest to become undercollaralized', async () => {});

  it('should be able to liquidate the position to become collateralised again', async () => {});

  it('should be able to borrow more once the price increases', async () => {});

  it('should be able to repay a portion and withdraw some', async () => {});

  it('should be able to withdraw all of the collateral', async () => {});
});
