import 'module-alias/register';

import { ethers, Wallet } from 'ethers';
import { expectRevert } from '@src/utils/expectRevert';

import ArcNumber from '@src/utils/ArcNumber';
import d1ArcDescribe from '@test/helpers/d1ArcDescribe';
import { ITestContext } from '@test/helpers/d1ArcDescribe';
import { AddressZero } from 'ethers/constants';
import ArcDecimal from '@src/utils/ArcDecimal';
import { Account, getWaffleExpect } from '../../helpers/testingUtils';

let ownerWallet: Account;
let otherWallet: Account;

const expect = getWaffleExpect();

async function init(ctx: ITestContext): Promise<void> {
  await ctx.arc.oracle.setPrice(ArcDecimal.new(100));
  await ctx.arc.state.setMarketParams({
    collateralRatio: { value: ArcNumber.new(2) },
    liquidationUserFee: { value: ArcDecimal.new(0.05).value },
    liquidationArcFee: { value: ArcDecimal.new(0.05).value },
  });

  ownerWallet = ctx.accounts[0];
  otherWallet = ctx.accounts[1];
}

d1ArcDescribe('D1Arc', init, (ctx: ITestContext) => {
  describe('#init', () => {
    it('cannot call init if already called', async () => {
      const stateAddress = await ctx.arc.core.state();
      expect(stateAddress).not.to.equal(AddressZero);
      await expectRevert(ctx.arc.core.init(AddressZero));
    });
  });

  describe('#setPause', () => {
    it('cannot call operate action if contracts are paused', async () => {
      await ctx.arc.core.setPause(true);
      expect(await ctx.arc.core.paused()).to.be.true;
      await expectRevert(ctx.arc._borrowSynthetic(1, 5, ownerWallet.signer));
    });

    it('can unpause contracts', async () => {
      await ctx.arc.core.setPause(false);
      expect(await ctx.arc.core.paused()).to.be.false;
      await await ctx.arc._borrowSynthetic(1, 5, ownerWallet.signer);
    });
  });

  describe('#withdrawTokens', () => {
    beforeEach(async () => {
      await ctx.arc.collateralAsset.mintShare(ctx.arc.core.address, 5, {});
    });
    it('cannot withdraw as a non-admin', async () => {
      const core = await ctx.arc.getCore(otherWallet.signer);
      await expectRevert(
        core.withdrawTokens(ctx.arc.collateralAsset.address, otherWallet.address, 1),
      );
    });

    it('can withdraw tokens as an admin', async () => {
      const core = await ctx.arc.getCore(ownerWallet.signer);
      await core.withdrawTokens(ctx.arc.collateralAsset.address, otherWallet.address, 1);
    });
  });
});
