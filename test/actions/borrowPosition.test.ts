import 'jest';

import { Wallet } from 'ethers';
import { ITestContext } from '../arcDescribe';
import initializeArc from '../initializeArc';
import arcDescribe from '../arcDescribe';
import ArcDecimal from '../../src/utils/ArcDecimal';
import ArcNumber from '../../src/utils/ArcNumber';
import { BigNumberish, BigNumber } from 'ethers/utils';
import { expectRevert } from '../../src/utils/expectRevert';
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

arcDescribe('#Actions.borrowPosition()', init, (ctx: ITestContext) => {
  describe('synthetic', () => {
    let positionId: BigNumberish;

    beforeEach(async () => {
      await ctx.arc.oracle.setPrice(ArcDecimal.new(100));

      const result = await ctx.arc._borrowSynthetic(
        ArcNumber.new(1),
        ArcNumber.new(400),
        syntheticMinterWallet,
      );

      positionId = result.params.id;
    });

    it('should not be able to borrow more than it is allowed', async () => {
      await ctx.arc._borrowSynthetic(
        ArcNumber.new(1),
        ArcNumber.new(201),
        syntheticMinterWallet,
        positionId,
      );
    });

    it('should not be able to borrow on behalf of someone else', async () => {
      await expectRevert(
        ctx.arc._borrowSynthetic(
          ArcNumber.new(1),
          ArcNumber.new(200),
          stableShareMinterWallet,
          positionId,
        ),
      );
    });

    it('should be able to borrow more if it has collateral to be used', async () => {
      await ctx.arc._borrowSynthetic(
        ArcNumber.new(1),
        ArcNumber.new(0),
        syntheticMinterWallet,
        positionId,
      );
    });

    it('should be able to borrow more if the price decreases', async () => {
      await ctx.arc.oracle.setPrice(ArcDecimal.new(50));
      await ctx.arc._borrowSynthetic(
        ArcNumber.new(2),
        ArcNumber.new(0),
        syntheticMinterWallet,
        positionId,
      );
    });

    it('should not be able to borrow more if the price decreases, more is borrowed and no extra collateral', async () => {
      await ctx.arc.oracle.setPrice(ArcDecimal.new(150));
      await expectRevert(
        ctx.arc._borrowSynthetic(
          ArcDecimal.new(0.5).value,
          ArcNumber.new(0),
          syntheticMinterWallet,
          positionId,
        ),
      );
    });

    it('should be able to borrow more if the price increases, more is borrowed and more collateral is provided', async () => {
      await ctx.arc.oracle.setPrice(ArcDecimal.new(150));
      await ctx.arc._borrowSynthetic(
        ArcDecimal.new(1).value,
        ArcNumber.new(200),
        syntheticMinterWallet,
        positionId,
      );
    });

    it('should be able to borrow less if the price increases', async () => {
      await ctx.arc.oracle.setPrice(ArcDecimal.new(150));
      await ctx.arc._borrowSynthetic(
        ArcDecimal.new(0.3).value,
        ArcNumber.new(0),
        syntheticMinterWallet,
        positionId,
      );
    });
  });

  describe('stable shares', () => {
    let syntheticPositionId: BigNumberish;
    let stablePositionId: BigNumberish;

    beforeEach(async () => {
      await ctx.arc.oracle.setPrice(ArcDecimal.new(100));

      // 200% Collateralised: $2,000/ (5 * $100 * 2) = 2
      const syntheticResult = await ctx.arc._borrowSynthetic(
        ArcNumber.new(5),
        ArcNumber.new(2000),
        syntheticMinterWallet,
      );

      syntheticPositionId = syntheticResult.params.id;

      await Token.transfer(
        ctx.arc.synthetic.address,
        stableShareMinterWallet.address,
        ArcNumber.new(5),
        syntheticMinterWallet,
      );

      await ctx.arc._supply(ArcNumber.new(1000), lenderWallet);

      // 5 Synthetics at $100 = $500 worth of value = $250 max.
      const stableResult = await ctx.arc._borrowStableShares(
        ArcNumber.new(100),
        ArcNumber.new(5),
        stableShareMinterWallet,
      );

      stablePositionId = stableResult.params.id;
    });

    it('should not be able to borrow more than it is allowed', async () => {
      await expectRevert(
        ctx.arc._borrowStableShares(
          ArcNumber.new(151),
          ArcNumber.new(0),
          stableShareMinterWallet,
          stablePositionId,
        ),
      );
    });

    it('should not be able to borrow on behalf of someone else', async () => {
      await expectRevert(
        ctx.arc._borrowStableShares(
          ArcNumber.new(150),
          ArcNumber.new(0),
          syntheticMinterWallet,
          stablePositionId,
        ),
      );
    });

    it('should be able to borrow the very maximum', async () => {
      await ctx.arc._borrowStableShares(
        ArcNumber.new(149),
        ArcNumber.new(0),
        stableShareMinterWallet,
        stablePositionId,
      );
    });

    it('should not be able to borrow to the very maximum after accruing interest', async () => {
      // This will increase the amount the borrower owes due to interest accruing
      await ctx.evm.increaseTime(60 * 60 * 24);
      await ctx.arc.state.updateIndex();

      await expectRevert(
        ctx.arc._borrowStableShares(
          ArcNumber.new(150),
          ArcNumber.new(0),
          stableShareMinterWallet,
          stablePositionId,
        ),
      );
    });

    it('should be able to borrow less due to interest accruing', async () => {
      // This will increase the amount the borrower owes due to interest accruing
      await ctx.evm.increaseTime(60 * 60 * 24);
      await ctx.arc.state.updateIndex();

      await ctx.arc._borrowStableShares(
        ArcNumber.new(149),
        ArcNumber.new(0),
        stableShareMinterWallet,
        stablePositionId,
      );
    });

    it('should be able to borrow more if the price increases', async () => {
      // 5 Synthetics at $150 = $750 worth of value = $375 max.
      // $100 is already being borrowed. $275 is left.
      await ctx.arc.oracle.setPrice(ArcDecimal.new(150));
      await ctx.arc._borrowStableShares(
        ArcNumber.new(270),
        ArcNumber.new(0),
        stableShareMinterWallet,
        stablePositionId,
      );
    });

    it('should not be able to borrow more than the limit after the price increase', async () => {
      await ctx.arc.oracle.setPrice(ArcDecimal.new(150));
      await expectRevert(
        ctx.arc._borrowStableShares(
          ArcNumber.new(280),
          ArcNumber.new(0),
          stableShareMinterWallet,
          stablePositionId,
        ),
      );
    });
  });
});
