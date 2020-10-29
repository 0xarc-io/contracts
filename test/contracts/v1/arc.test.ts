import 'jest';

import { ethers, Wallet } from 'ethers';
import { expectRevert } from '@src/utils/expectRevert';

import ArcNumber from '@src/utils/ArcNumber';
import arcDescribe from '@test/helpers/arcDescribe';
import { ITestContext } from '@test/helpers/arcDescribe';
import initializeArc from '@test/helpers/initializeArc';
import { AddressZero } from 'ethers/constants';
import ArcDecimal from '@src/utils/ArcDecimal';

let ownerWallet: Wallet;
let otherWallet: Wallet;

jest.setTimeout(30000);

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);
  await ctx.arc.oracle.setPrice(ArcDecimal.new(100));

  await ctx.arc.state.setMarketParams({
    collateralRatio: { value: ArcNumber.new(2) },
    liquidationUserFee: { value: ArcDecimal.new(0.05).value },
    liquidationArcFee: { value: ArcDecimal.new(0.05).value },
  });

  ownerWallet = ctx.wallets[0];
  otherWallet = ctx.wallets[1];
}

arcDescribe('D1Arc', init, (ctx: ITestContext) => {
  describe('#init', () => {
    it('cannot call init if already called', async () => {
      const stateAddress = await ctx.arc.core.state();
      expect(stateAddress).not.toEqual(AddressZero);
      await expectRevert(ctx.arc.core.init(AddressZero));
    });
  });

  describe('#setPause', () => {
    it('cannot call operate action if contracts are paused', async () => {
      await ctx.arc.core.setPause(true);
      expect(await ctx.arc.core.paused()).toBeTruthy();
      await expectRevert(ctx.arc._borrowSynthetic(1, 5, ownerWallet));
    });

    it('can unpause contracts', async () => {
      await ctx.arc.core.setPause(false);
      expect(await ctx.arc.core.paused()).toBeFalsy();
      await await ctx.arc._borrowSynthetic(1, 5, ownerWallet);
    });
  });

  describe('#withdrawTokens', () => {
    beforeEach(async () => {
      await ctx.arc.collateralAsset.mintShare(ctx.arc.core.address, 5, {});
    });
    it('cannot withdraw as a non-admin', async () => {
      const core = await ctx.arc.getCore(otherWallet);
      await expectRevert(
        core.withdrawTokens(ctx.arc.collateralAsset.address, otherWallet.address, 1),
      );
    });

    it('can withdraw tokens as an admin', async () => {
      const core = await ctx.arc.getCore(ownerWallet);
      await core.withdrawTokens(ctx.arc.collateralAsset.address, otherWallet.address, 1);
    });
  });
});
