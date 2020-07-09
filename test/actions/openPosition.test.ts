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
      await ctx.arc.stableShare.mintShare(minterWallet.address, ArcNumber.new(200));

      await Token.approve(
        ctx.arc.stableShare.address,
        minterWallet,
        ctx.arc.core.address,
        ArcNumber.new(200),
      );
    });

    it('should be able to borrow by the exact amout of collateral provided', async () => {
      const mintDate = await (
        await ownerWallet.provider.getBlock(await ownerWallet.provider.getBlockNumber())
      ).timestamp;

      await ctx.arc.openPosition(
        ctx.arc.stableShare.address,
        ArcNumber.new(200),
        ArcNumber.new(1),
        minterWallet,
      );

      const state = await ctx.arc.core.state();
      expect(state.totalPar.supply).toEqual(ArcNumber.new(0));
      expect(state.totalPar.borrow).toEqual(ArcNumber.new(0));
      expect(state.index.borrow).toEqual(ArcNumber.new(1));
      expect(state.index.supply).toEqual(ArcNumber.new(1));
      expect(state.index.lastUpdate).toBeGreaterThanOrEqual(mintDate);

      const position = await ctx.arc.core.positions(0);
      expect(position.collateralAmount.value).toEqual(ArcNumber.new(200));
      expect(position.collateralAmount.sign).toEqual(true);
      expect(position.borrowedAmount.value).toEqual(ArcNumber.new(1));
      expect(position.borrowedAmount.sign).toEqual(false);
      expect(position.collateralAsset).toEqual(ctx.arc.stableShare.address);
      expect(position.borrowedAsset).toEqual(ctx.arc.synthetic.address);
    });

    it('should not be able to open a position with not enough collateral', async () => {
      await expectRevert(
        ctx.arc.openPosition(
          ctx.arc.stableShare.address,
          ArcNumber.new(199),
          ArcNumber.new(1),
          minterWallet,
        ),
      );
    });

    it('should not be able to open a position with anything other than the liquidity asset', async () => {
      await expectRevert(
        ctx.arc.openPosition(
          otherWallet.address,
          ArcNumber.new(200),
          ArcNumber.new(1),
          minterWallet,
        ),
      );
    });

    it('should not be able to open a position of 0', async () => {
      await expectRevert(
        ctx.arc.openPosition(
          otherWallet.address,
          ArcNumber.new(200),
          ArcNumber.new(0),
          minterWallet,
        ),
      );
    });
  });

  describe('with synthetics', () => {
    beforeEach(async () => {
      await ctx.arc._supply(ArcNumber.new(1000), lenderWallet);
      await Token.approve(
        ctx.arc.synthetic.address,
        minterWallet,
        ctx.arc.core.address,
        ArcNumber.new(10),
      );
    });

    it('should be able to borrow by the exact amout of collateral provided', async () => {
      await ctx.arc._mintSynthetic(ArcNumber.new(1), ArcNumber.new(200), minterWallet);

      const mintDate = await (
        await ownerWallet.provider.getBlock(await ownerWallet.provider.getBlockNumber())
      ).timestamp;

      await ctx.arc.openPosition(
        ctx.arc.synthetic.address,
        ArcNumber.new(1),
        ArcNumber.new(50),
        minterWallet,
      );

      const state = await ctx.arc.core.state();
      expect(state.totalPar.supply).toEqual(ArcNumber.new(1000));
      expect(state.totalPar.borrow).toEqual(ArcNumber.new(50));
      expect(state.index.borrow).not.toEqual(ArcNumber.new(0));
      expect(state.index.supply).not.toEqual(ArcNumber.new(0));
      expect(state.index.lastUpdate).toBeGreaterThanOrEqual(mintDate);

      const position = await ctx.arc.core.positions(1);
      expect(position.collateralAmount.value).toEqual(ArcNumber.new(1));
      expect(position.collateralAmount.sign).toEqual(true);
      expect(position.borrowedAmount.value).toEqual(ArcNumber.new(50));
      expect(position.borrowedAmount.sign).toEqual(false);
      expect(position.collateralAsset).toEqual(ctx.arc.synthetic.address);
      expect(position.borrowedAsset).toEqual(ctx.arc.stableShare.address);
    });

    it('should be able to borrow and set the correct interest rates', async () => {
      await ctx.arc._mintSynthetic(ArcNumber.new(1), ArcNumber.new(200), minterWallet);

      await ctx.arc.openPosition(
        ctx.arc.synthetic.address,
        ArcNumber.new(1),
        ArcNumber.new(50),
        minterWallet,
      );

      const state1 = await ctx.arc.core.state();

      await ctx.arc._mintSynthetic(ArcNumber.new(1), ArcNumber.new(200), otherWallet);
      await ctx.arc._borrowStableShares(ArcNumber.new(1), ArcNumber.new(50), otherWallet);

      const state2 = await ctx.arc.core.state();

      expect(state2.totalPar.borrow).toEqual(state1.totalPar.borrow.mul(2));
      expect(state2.totalPar.supply).toEqual(state1.totalPar.supply);

      await ctx.arc._supply(ArcNumber.new(1000), otherWallet);

      const newBalance = await ctx.arc.core.supplyBalances(otherWallet.address);
      expect(newBalance.value).not.toEqual(ArcNumber.new(1000));
    });

    it('should not be able to borrow without enough collateral provided', async () => {
      await ctx.arc._mintSynthetic(ArcNumber.new(1), ArcNumber.new(200), minterWallet);
      await expectRevert(
        ctx.arc.openPosition(
          ctx.arc.synthetic.address,
          ArcNumber.new(1),
          ArcNumber.new(51),
          minterWallet,
        ),
      );
    });

    it('should not be able to borrow without enough liquidity (over collateralisation ratio)', async () => {
      await ctx.arc._mintSynthetic(ArcNumber.new(25), ArcNumber.new(5000), minterWallet);
      await expectRevert(
        ctx.arc.openPosition(
          ctx.arc.synthetic.address,
          ArcNumber.new(25),
          ArcNumber.new(1001),
          minterWallet,
        ),
      );
    });

    it('should not be able to borrow 0', async () => {
      await ctx.arc._mintSynthetic(ArcNumber.new(1), ArcNumber.new(200), minterWallet);
      await expectRevert(
        ctx.arc.openPosition(
          ctx.arc.synthetic.address,
          ArcNumber.new(0),
          ArcNumber.new(100),
          minterWallet,
        ),
      );
    });
  });
});
