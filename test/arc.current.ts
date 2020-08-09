import 'jest';

import { ethers, Wallet } from 'ethers';
import { expectRevert } from '@src/utils/expectRevert';

import ArcNumber from '@src/utils/ArcNumber';
import arcDescribe from './arcDescribe';
import { ITestContext } from './arcDescribe';
import initializeArc from './initializeArc';
import { StateV1 } from '@src/typings';
import { AddressZero } from 'ethers/constants';

let ownerWallet: Wallet;
let otherWallet: Wallet;

jest.setTimeout(30000);

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);

  ownerWallet = ctx.wallets[0];
  otherWallet = ctx.wallets[1];
}

arcDescribe('Arc', init, (ctx: ITestContext) => {
  describe('#init', () => {
    it('cannot call init if already called', async () => {
      const stateAddress = await ctx.arc.core.state();
      expect(stateAddress).not.toEqual(AddressZero);
      await expectRevert(ctx.arc.core.init(AddressZero));
    });
  });

  describe('#withdrawExcessTokens', async () => {
    it('cannot withdraw depositors funds', async () => {});

    it('cannot withdraw as a non-adming', async () => {});

    it('can withdraw any excess collateral tokens', async () => {});

    it('can withdraw any misc tokens', async () => {});
  });
});
