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
}

const expect = getWaffleExpect();

d2ArcDescribe('D2Core.setters()', init, (ctx: ITestContext) => {
  before(async () => {});

  describe('#withdrawTokens', () => {
    it('should not be callable by any user', async () => {});

    it('should only be callable by the admin', async () => {});
  });

  describe('#setPause', () => {
    it('should not be callable by any user', async () => {});

    it('should only be callable by the admin', async () => {});

    it('should not be able to execute any action once paused', async () => {});
  });
});
