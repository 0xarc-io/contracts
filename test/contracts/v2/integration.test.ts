import 'module-alias/register';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';
import { Account, getWaffleExpect } from '../../helpers/testingUtils';
import d2ArcDescribe, { initializeD2Arc } from '@test/helpers/d2ArcDescribe';
import { ITestContext } from '@test/helpers/d2ArcDescribe';
import { D2ArcOptions } from '../../helpers/d2ArcDescribe';

let ownerAccount: Account;
let minterAccount: Account;
let liquidatorAccount: Account;
let otherAccount: Account;

async function init(ctx: ITestContext): Promise<void> {
  [ownerAccount, minterAccount, liquidatorAccount, otherAccount] = ctx.accounts;

  const setupOptions = {
    oraclePrice: ArcDecimal.new(100).value,
    collateralRatio: ArcDecimal.new(2).value,
    initialCollateralBalances: [
      [minterAccount, ArcNumber.new(100)],
      [liquidatorAccount, ArcNumber.new(500)],
    ],
  } as D2ArcOptions;

  await initializeD2Arc(ctx, setupOptions);
}

const expect = getWaffleExpect();

d2ArcDescribe('D2Arc', init, (ctx: ITestContext) => {
  beforeEach(async () => {});

  it('should be able to open a collateralized position', async () => {});

  it('should be able deposit to increase the c-ratio', async () => {});

  it('should be able to accumulate more interest', async () => {});

  it('should be able to claim the newly minted tokens', async () => {});

  it('should be able to pay back the accumulated interest', async () => {});

  it('should be able to wait to accumulate enough interest to become undercollaralized', async () => {});

  it('should be able to liquidate the position to become collateralised again', async () => {});

  it('should be able to borrow more once the price increases', async () => {});

  it('should be able to repay a portion and withdraw some', async () => {});

  it('should be able to withdraw all of the collateral', async () => {});
});
