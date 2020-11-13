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
import { D2SavingsV1, MockD2SavingsV1 } from '@src/typings';

let ownerAccount: Account;
let minterAccount: Account;
let stakerAccount: Account;
let revenueAccount: Account;
let otherAccount: Account;

const COLLATERAL_AMOUNT = ArcNumber.new(200);
const BORROW_AMOUNT = ArcNumber.new(50);

const ctx: ITestContext = {};
let savings: MockD2SavingsV1;

async function init(ctx: ITestContext): Promise<void> {
  [ownerAccount, minterAccount, stakerAccount, revenueAccount, otherAccount] = ctx.accounts;

  const setupOptions = {
    oraclePrice: ArcDecimal.new(1).value,
    collateralRatio: ArcDecimal.new(2).value,
    interestRate: TEN_PERCENT,
    initialCollateralBalances: [
      [minterAccount, COLLATERAL_AMOUNT.mul(5)],
      [otherAccount, COLLATERAL_AMOUNT.mul(5)],
    ],
  } as D2ArcOptions;

  await initializeD2Arc(ctx, setupOptions);
}

const expect = getWaffleExpect();

describe('D2Core.integration', () => {
  let ctx: ITestContext = {};

  before(async () => {
    ctx = await d2Setup(init);
    savings = await MockD2SavingsV1.deploy(
      ownerAccount.signer,
      ctx.arc.coreAddress(),
      ctx.arc.syntheticAddress(),
      revenueAccount.address,
      { value: 0 },
    );
  });

  it('should be able to open a collateralized position', async () => {
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

  it('should be able deposit to increase the c-ratio', async () => {
    await ctx.arc.borrow(0, COLLATERAL_AMOUNT, 0, minterAccount.signer);
  });

  it('should be able to accumulate more interest', async () => {
    await ctx.arc.updateTime(ONE_YEAR_IN_SECONDS);
    await savings.s;
    await ctx.arc.core().updateIndex();

    const borrowIndex = (await ctx.arc.core().getBorrowIndex())[0];
    const position = await ctx.arc.getPosition(0);

    expect(borrowIndex.bigMul(position.borrowedAmount.value).gte(BORROW_AMOUNT));
  });

  it('should be able to stake and claim newly minted tokens', async () => {
    await Token.transfer(
      ctx.arc.syntheticAddress(),
      stakerAccount.address,
      BORROW_AMOUNT,
      minterAccount.signer,
    );

    await Token.approve(
      ctx.arc.syntheticAddress(),
      stakerAccount.signer,
      savings.address,
      BORROW_AMOUNT,
    );
  });

  it('should be able to pay back the accumulated interest', async () => {});

  it('should be able to wait to accumulate enough interest to become undercollaralized', async () => {});

  it('should be able to liquidate the position to become collateralised again', async () => {});

  it('should be able to borrow more once the price increases', async () => {});

  it('should be able to repay a portion and withdraw some', async () => {});

  it('should be able to withdraw all of the collateral', async () => {});
});
