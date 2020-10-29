import 'module-alias/register';

import { ITestContext } from '@test/helpers/d1ArcDescribe';
import initializeArc from '@test/helpers/initializeArc';
import d1ArcDescribe from '@test/helpers/d1ArcDescribe';
import ArcNumber from '@src/utils/ArcNumber';
import Token from '@src/utils/Token';
import { expectRevert } from '@src/utils/expectRevert';
import ArcDecimal from '@src/utils/ArcDecimal';
import { AssetType } from '@src/types';
import { Account, getWaffleExpect } from '../../helpers/testingUtils';

let ownerAccount: Account;
let lenderAccount: Account;
let minterAccount: Account;
let otherAccount: Account;

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);

  ownerAccount = ctx.accounts[0];
  lenderAccount = ctx.accounts[1];
  minterAccount = ctx.accounts[2];
  otherAccount = ctx.accounts[3];
}

const expect = getWaffleExpect();

d1ArcDescribe('#Actions.openPosition()', init, (ctx: ITestContext) => {
  describe('with stable shares', () => {
    beforeEach(async () => {
      await ctx.arc.oracle.setPrice(ArcDecimal.new(200));
      await ctx.arc.collateralAsset.mintShare(minterAccount.address, ArcNumber.new(1));

      await Token.approve(
        ctx.arc.collateralAsset.address,
        minterAccount.wallet,
        ctx.arc.core.address,
        ArcNumber.new(1),
      );
    });

    it('should be able to borrow by the exact amout of collateral provided', async () => {
      await ctx.arc.openPosition(ArcNumber.new(1), ArcNumber.new(100), minterAccount.wallet);

      const supply = await ctx.arc.state.totalSupplied();
      expect(supply).to.equal(ArcNumber.new(1));

      const position = await ctx.arc.state.positions(0);
      expect(position.collateralAmount.value).to.equal(ArcNumber.new(1));
      expect(position.collateralAmount.sign).to.equal(true);
      expect(position.borrowedAmount.value).to.equal(ArcNumber.new(100));
      expect(position.borrowedAmount.sign).to.equal(false);
      expect(position.collateralAsset).to.equal(AssetType.Collateral);
      expect(position.borrowedAsset).to.equal(AssetType.Synthetic);
    });

    it('should not be able to open a position with not enough collateral', async () => {
      await expectRevert(
        ctx.arc.openPosition(ArcNumber.new(1), ArcNumber.new(101), minterAccount.wallet),
      );
    });

    it('should not be able to open a position with not enough collateral', async () => {
      await expectRevert(
        ctx.arc.openPosition(ArcNumber.new(0), ArcNumber.new(1), minterAccount.wallet),
      );
    });
  });
});
