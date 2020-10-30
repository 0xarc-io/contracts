import 'module-alias/register';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';
import { Account, getWaffleExpect } from '../../helpers/testingUtils';
import d2ArcDescribe, { initializeD2Arc } from '@test/helpers/d2ArcDescribe';
import { ITestContext } from '@test/helpers/d2ArcDescribe';
import { D2ArcOptions } from '../../helpers/d2ArcDescribe';

let ownerAccount: Account;
let minterAccount: Account;
let otherAccount: Account;

async function init(ctx: ITestContext): Promise<void> {
  [ownerAccount, minterAccount, otherAccount] = ctx.accounts;

  const setupOptions = {
    oraclePrice: ArcDecimal.new(100).value,
    collateralRatio: ArcDecimal.new(2).value,
    initialCollateralBalances: [[minterAccount, ArcNumber.new(100)]],
  } as D2ArcOptions;

  await initializeD2Arc(ctx, setupOptions);
}

const expect = getWaffleExpect();

d2ArcDescribe('D2Core.operateAction(Borrow)', init, (ctx: ITestContext) => {
  before(async () => {});

  it('should be able to borrow above the c-ratio', async () => {});

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
