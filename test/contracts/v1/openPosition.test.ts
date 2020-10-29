import 'jest';

import { Wallet, ethers } from 'ethers';
import { ITestContext } from '@test/helpers/d1ArcDescribe';
import initializeArc from '@test/helpers/initializeArc';
import d1ArcDescribe from '@test/helpers/d1ArcDescribe';
import ArcNumber from '@src/utils/ArcNumber';
import Token from '@src/utils/Token';
import { expectRevert } from '@src/utils/expectRevert';
import ArcDecimal from '@src/utils/ArcDecimal';
import { AssetType } from '@src/types';

let ownerWallet: Wallet;
let lenderWallet: Wallet;
let minterWallet: Wallet;
let otherWallet: Wallet;

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);

  ownerWallet = ctx.wallets[0];
  lenderWallet = ctx.wallets[1];
  minterWallet = ctx.wallets[2];
  otherWallet = ctx.wallets[3];
}

jest.setTimeout(30000);

d1ArcDescribe('#Actions.openPosition()', init, (ctx: ITestContext) => {
  describe('with stable shares', () => {
    beforeEach(async () => {
      await ctx.arc.oracle.setPrice(ArcDecimal.new(200));
      await ctx.arc.collateralAsset.mintShare(minterWallet.address, ArcNumber.new(1));

      await Token.approve(
        ctx.arc.collateralAsset.address,
        minterWallet,
        ctx.arc.core.address,
        ArcNumber.new(1),
      );
    });

    it('should be able to borrow by the exact amout of collateral provided', async () => {
      await ctx.arc.openPosition(ArcNumber.new(1), ArcNumber.new(100), minterWallet);

      const supply = await ctx.arc.state.totalSupplied();
      expect(supply).toEqual(ArcNumber.new(1));

      const position = await ctx.arc.state.positions(0);
      expect(position.collateralAmount.value).toEqual(ArcNumber.new(1));
      expect(position.collateralAmount.sign).toEqual(true);
      expect(position.borrowedAmount.value).toEqual(ArcNumber.new(100));
      expect(position.borrowedAmount.sign).toEqual(false);
      expect(position.collateralAsset).toEqual(AssetType.Collateral);
      expect(position.borrowedAsset).toEqual(AssetType.Synthetic);
    });

    it('should not be able to open a position with not enough collateral', async () => {
      await expectRevert(ctx.arc.openPosition(ArcNumber.new(1), ArcNumber.new(101), minterWallet));
    });

    it('should not be able to open a position with not enough collateral', async () => {
      await expectRevert(ctx.arc.openPosition(ArcNumber.new(0), ArcNumber.new(1), minterWallet));
    });
  });
});
