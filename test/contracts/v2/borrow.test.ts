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

  it('should update the index and print more synthetics', async () => {});

  it('should update the index and print more synthetics based on the print ratio', async () => {});

  it('should be able to borrow more if the c-ratio is not at the minimum', async () => {});

  it('should not be able to borrow below the required c-ratio', async () => {});

  it('should not be able to borrow without enough collateral', async () => {});

  it('should not be able to borrow with the wrong collateral asset', async () => {});

  it('should not be able to borrow more if the price decreases', async () => {});

  it('should not be able to borrow more if the interest payments have increased', async () => {});

  it('should not be able to borrow more than the synthetic limit', async () => {});

  it('should not be able to borrow more the collateral limit', async () => {});
});
