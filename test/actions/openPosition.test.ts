import 'jest';
import { Wallet, ethers } from 'ethers';
import { ITestContext } from '../arcDescribe';
import initializeArc from '../initializeArc';
import ArcNumber from '../../src/utils/ArcNumber';
import Token from '../../src/utils/Token';
import arcDescribe from '../arcDescribe';
import { expectRevert } from '../../src/utils/expectRevert';
import ArcDecimal from '../../src/utils/ArcDecimal';
import { stat } from 'fs';
import { AssetType } from '@src/types';

let ownerWallet: Wallet;
let lenderWallet: Wallet;
let minterWallet: Wallet;
let otherWallet: Wallet;

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);
  await ctx.arc.oracle.setPrice(ArcDecimal.new(100));

  ownerWallet = ctx.wallets[0];
  lenderWallet = ctx.wallets[1];
  minterWallet = ctx.wallets[2];
  otherWallet = ctx.wallets[3];
}

jest.setTimeout(30000);

arcDescribe('#Actions.openPosition()', init, (ctx: ITestContext) => {
  describe('with stable shares', () => {
    beforeEach(async () => {
      await ctx.arc.collateralAsset.mintShare(minterWallet.address, ArcNumber.new(200));

      await Token.approve(
        ctx.arc.collateralAsset.address,
        minterWallet,
        ctx.arc.core.address,
        ArcNumber.new(200),
      );
    });

    it('should be able to borrow by the exact amout of collateral provided', async () => {
      await ctx.arc.openPosition(
        AssetType.Collateral,
        ArcNumber.new(200),
        ArcNumber.new(1),
        minterWallet,
      );

      const supply = await ctx.arc.state.totalSupplied();
      expect(supply).toEqual(ArcNumber.new(200));

      const position = await ctx.arc.state.positions(0);
      expect(position.collateralAmount.value).toEqual(ArcNumber.new(200));
      expect(position.collateralAmount.isPositive).toEqual(true);
      expect(position.borrowedAmount.value).toEqual(ArcNumber.new(1));
      expect(position.borrowedAmount.isPositive).toEqual(true);
      expect(position.collateralAsset).toEqual(AssetType.Collateral);
      expect(position.borrowedAsset).toEqual(AssetType.Synthetic);
    });

    it('should not be able to open a position with not enough collateral', async () => {
      await expectRevert(
        ctx.arc.openPosition(
          AssetType.Synthetic,
          ArcNumber.new(199),
          ArcNumber.new(1),
          minterWallet,
        ),
      );
    });

    it('should not be able to open a position with anything other than the liquidity asset', async () => {
      await expectRevert(
        ctx.arc.openPosition(2, ArcNumber.new(200), ArcNumber.new(1), minterWallet),
      );
    });
  });
});
