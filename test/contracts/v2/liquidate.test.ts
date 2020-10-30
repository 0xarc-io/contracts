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

d2ArcDescribe('D2Core.operateAction(Liquidate)', init, (ctx: ITestContext) => {
  before(async () => {});

  it('should be able to liquidate below the c-ratio', async () => {});

  it('should not be able to liquidate above the c-ratio ', async () => {});

  it('should not be able to liquidate without enough synthetic', async () => {});

  it('should be able to liquidate if too much interest accumulates', async () => {});

  it('should be able to liquidate if the price drops', async () => {});

  it('should not be able to liquidate if the price increases', async () => {});

  it('should be able to liquidate again if the price drops', async () => {});
});
