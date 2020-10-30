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

d2ArcDescribe('D2Core.operateAction(Repay)', init, (ctx: ITestContext) => {
  before(async () => {});

  it('should be able to repay to increase the c-ratio', async () => {});

  it('should be able to repay to decrease the c-ratio', async () => {});

  it('should be able to repay to make the position collateralized ', async () => {});

  it('should not be able to repay and withdraw below the c-ratio', async () => {});

  it('should not be able to withdraw below the c-ratio', async () => {});

  it('should not be able to withdraw if undercollateralized', async () => {});

  it('should be able to repay accumulated interest (3 months)', async () => {});

  it('should be able to repay accumulated interest (6 months)', async () => {});

  it('should be able to repay accumulated interest (12 months)', async () => {});
});
