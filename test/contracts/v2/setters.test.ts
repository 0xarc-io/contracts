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

  describe('#setRate', () => {
    it('should not be settable by any user', async () => {});

    it('should only be settable by the admin', async () => {});
  });

  describe('#setOracle', () => {
    it('should not be settable by any user', async () => {});

    it('should only be settable by the admin', async () => {});
  });

  describe('#setCollateralRatio', () => {
    it('should not be settable by any user', async () => {});

    it('should only be settable by the admin', async () => {});
  });

  describe('#setPrinterDestination', () => {
    it('should not be settable by any user', async () => {});

    it('should only be settable by the admin', async () => {});
  });

  describe('#setLiquidationFees', () => {
    it('should not be settable by any user', async () => {});

    it('should only be settable by the admin', async () => {});
  });

  describe('#setRate', () => {
    it('should not be settable by any user', async () => {});

    it('should only be settable by the admin', async () => {});
  });
});
