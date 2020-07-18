import 'jest';

import { ethers, Wallet } from 'ethers';
import { expectRevert } from '@src/utils/expectRevert';

import ArcNumber from '@src/utils/ArcNumber';
import arcDescribe from './arcDescribe';
import { ITestContext } from './arcDescribe';
import initializeArc from './initializeArc';
import ArcDecimal from '../src/utils/ArcDecimal';
import { BigNumber } from 'ethers/utils';

let ownerWallet: Wallet;
let otherWallet: Wallet;

jest.setTimeout(30000);

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);

  ownerWallet = ctx.wallets[0];
  otherWallet = ctx.wallets[1];
}

arcDescribe('Arc', init, (ctx: ITestContext) => {
  describe('#setLimits', () => {
    it('should not be able to set limits as non-admin', async () => {});

    it('should be able to set limits as the admin', async () => {});
  });

  describe('#limits', () => {
    it('should not be abe to lend more than the limit', async () => {});

    it('should be able to lend the maximum amount', async () => {});

    it('should not be able to mint more than the limit', async () => {});

    it('should be able to mint the maximum amount', async () => {});
  });
});
