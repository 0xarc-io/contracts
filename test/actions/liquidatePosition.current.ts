import { Wallet } from 'ethers';
import { ITestContext } from '../arcDescribe';
import initializeArc from '../initializeArc';
import ArcDecimal from '../../src/utils/ArcDecimal';
import arcDescribe from '../arcDescribe';
import ArcNumber from '../../src/utils/ArcNumber';
import { expectRevert } from '../../src/utils/expectRevert';
import { BigNumber } from 'ethers/utils';
import Token from '../../src/utils/Token';

let ownerWallet: Wallet;
let lenderWallet: Wallet;
let syntheticMinterWallet: Wallet;
let stableShareMinterWallet: Wallet;
let liquidatorWallet: Wallet;

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);
  await ctx.arc.oracle.setPrice(ArcDecimal.new(100));

  ownerWallet = ctx.wallets[0];
  lenderWallet = ctx.wallets[1];
  syntheticMinterWallet = ctx.wallets[2];
  stableShareMinterWallet = ctx.wallets[3];
  liquidatorWallet = ctx.wallets[4];
}

jest.setTimeout(30000);

arcDescribe('#Actions.liquidatePosition()', init, (ctx: ITestContext) => {
  describe('synthetic', () => {
    it('should not be able to liquidate a collateralised position', async () => {
      await ctx.arc._mintSynthetic(ArcNumber.new(1), ArcNumber.new(200), syntheticMinterWallet);
      await expectRevert(ctx.arc.liquidatePosition(0, liquidatorWallet));
    });

    it('should not be able to liquidate a position without a synthetic', async () => {
      await ctx.arc._mintSynthetic(ArcNumber.new(1), ArcNumber.new(200), syntheticMinterWallet);
      await ctx.arc.oracle.setPrice(ArcDecimal.new(150));
      await expectRevert(ctx.arc.liquidatePosition(0, liquidatorWallet));
    });

    it('should be able to liquidate', async () => {
      await ctx.arc._mintSynthetic(ArcNumber.new(1), ArcNumber.new(200), syntheticMinterWallet);
      await ctx.arc.oracle.setPrice(ArcDecimal.new(150));
      await ctx.arc._mintSynthetic(ArcDecimal.new(1).value, ArcNumber.new(300), liquidatorWallet);

      await ctx.arc.liquidatePosition(0, liquidatorWallet);

      expect(await ctx.arc.stableShare.balanceOf(liquidatorWallet.address)).toEqual(
        new BigNumber('90909090909090909090'),
      );
    });
  });

  describe('stable shares', () => {
    beforeEach(async () => {
      // Open a 400% collateralised position (short)
      await ctx.arc._mintSynthetic(ArcNumber.new(1), ArcNumber.new(400), syntheticMinterWallet);

      // Transfer the synthetic to the stable share minter (long)
      await Token.transfer(
        ctx.arc.synthetic.address,
        stableShareMinterWallet.address,
        ArcNumber.new(1),
        syntheticMinterWallet,
      );

      // Ensure there's enough liquidity for the long to borrow against
      await ctx.arc._supply(ArcNumber.new(1000), lenderWallet);

      // Give approval to transfer stable shares
      await Token.approve(
        ctx.arc.stableShare.address,
        liquidatorWallet,
        ctx.arc.core.address,
        ArcNumber.new(1000),
      );
    });

    it('should not be able to liquidate a collateralised position', async () => {
      await ctx.arc._borrowStableShares(
        ArcNumber.new(50),
        ArcNumber.new(1),
        stableShareMinterWallet,
      );
      await ctx.arc.stableShare.mintShare(liquidatorWallet.address, ArcNumber.new(100));
      await expectRevert(ctx.arc.liquidatePosition(1, liquidatorWallet));
    });

    it('should not be able to liquidate a position without stable shares', async () => {
      await ctx.arc._borrowStableShares(
        ArcNumber.new(50),
        ArcNumber.new(1),
        stableShareMinterWallet,
      );
      await ctx.arc.oracle.setPrice(ArcDecimal.new(50));
      await expectRevert(ctx.arc.liquidatePosition(1, liquidatorWallet));
    });

    it('should be able to liquidate', async () => {
      await ctx.arc._borrowStableShares(
        ArcNumber.new(50),
        ArcNumber.new(1),
        stableShareMinterWallet,
      );
      await ctx.arc.oracle.setPrice(ArcDecimal.new(75));
      await ctx.arc.stableShare.mintShare(liquidatorWallet.address, ArcNumber.new(100));
      await ctx.arc.liquidatePosition(1, liquidatorWallet);
    });
  });
});
