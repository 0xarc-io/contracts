import 'module-alias/register';

import ArcNumber from '@src/utils/ArcNumber';
import Token from '@src/utils/Token';
import { expectRevert } from '@src/utils/expectRevert';
import ArcDecimal from '@src/utils/ArcDecimal';
import { AssetType } from '@src/types';
import { Account, getWaffleExpect } from '../../helpers/testingUtils';
import d2ArcDescribe, { initializeD2Arc } from '@test/helpers/d2ArcDescribe';
import { ITestContext } from '@test/helpers/d2ArcDescribe';

let ownerAccount: Account;
let lenderAccount: Account;
let minterAccount: Account;
let otherAccount: Account;

async function init(ctx: ITestContext): Promise<void> {
  const setupOptions = {
    oraclePrice: ArcDecimal.new(100).value,
    accounts: [ownerAccount, lenderAccount, minterAccount, otherAccount],
  };

  await initializeD2Arc(ctx, setupOptions);

  [ownerAccount, lenderAccount, minterAccount, otherAccount] = setupOptions.accounts;
}

const expect = getWaffleExpect();

d2ArcDescribe('#D2Core.operateAction(Open)', init, (ctx: ITestContext) => {
  before(async () => {});

  it('should be be able to open at the exact c-ratio', async () => {});

  it('should be able to open above the c-ratio', async () => {});

  it('should not be able to open below the required c-ratio', async () => {});

  it('should not be able to open without enough collateral', async () => {});

  it('should not be able to open with the wrong collateral asset', async () => {});
});
