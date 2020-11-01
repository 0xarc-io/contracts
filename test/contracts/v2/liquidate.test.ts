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
    await ctx.arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, minterAccount.wallet);
    await ctx.arc.openPosition(
      COLLATERAL_AMOUNT.mul(5),
      BORROW_AMOUNT.mul(5),
      liquidatorAccount.wallet,
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  it('should be able to liquidate an undercollateralized position', async () => {
    // Drop the price in half
    await ctx.arc.updatePrice(ArcDecimal.new(0.5).value);

    // Call up arthur to do the deed
    await ctx.arc.liquidatePosition(0, liquidatorAccount.wallet);

    // @TODO: Check total supply
    // @TODO: Check position borrow amount (decrease)
    // @TODO: Check position collateral amount (decrease)
    // @TODO: Check liquidator collateral amount (increase)
    // @TODO: Check liquidator synth balance (decrease)
    // @TODO: Check proxy collateral amount (increase)
  });

  it('should not be able to liquidate a collateralized position ', async () => {
    expect(ctx.arc.liquidatePosition(0, liquidatorAccount.wallet)).to.be.reverted;
  });

  it('should not be able to liquidate without enough synthetic', async () => {});

  it('should be able to liquidate if too much interest accumulates', async () => {});

  it('should be able to liquidate if the price drops', async () => {});

  it('should not be able to liquidate if the price increases', async () => {});

  it('should be able to liquidate again if the price drops', async () => {});
});
