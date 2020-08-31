import 'jest';

import { Wallet } from 'ethers';
import { ITestContext } from '@test/helpers/arcDescribe';
import initializeArc from '@test/helpers/initializeArc';
import arcDescribe from '@test/helpers/arcDescribe';
import ArcDecimal from '@src/utils/ArcDecimal';
import ArcNumber from '@src/utils/ArcNumber';
import { BigNumberish, BigNumber } from 'ethers/utils';
import { expectRevert } from '@src/utils/expectRevert';
import { MockOracle } from '@src/typings';

let ownerWallet: Wallet;
let lenderWallet: Wallet;
let syntheticMinterWallet: Wallet;
let stableShareMinterWallet: Wallet;
let liquidatorWallet: Wallet;

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);

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
      const oracle = await MockOracle.at(ownerWallet, ctx.arc.oracle.address);
      await oracle.setPrice(ArcDecimal.new(1000));

      // The total liquidation premium is 10% in this case
      // 5% is the liquidator reward, 5% is the arc fee
      await ctx.arc.state.setMarketParams({
        collateralRatio: { value: ArcNumber.new(2) },
        liquidationUserFee: { value: ArcDecimal.new(0.05).value },
        liquidationArcFee: { value: ArcDecimal.new(0.05).value },
      });

      const result = await ctx.arc._borrowSynthetic(
        ArcNumber.new(300),
        ArcNumber.new(1),
        syntheticMinterWallet,
      );

      positionId = result.params.id;
    });

    it('should not be able to borrow more than it is allowed', async () => {
      await ctx.arc._borrowSynthetic(
        ArcNumber.new(201),
        ArcNumber.new(1),
        syntheticMinterWallet,
        positionId,
      );
    });

    it('should not be able to borrow on behalf of someone else', async () => {
      await expectRevert(
        ctx.arc._borrowSynthetic(
          ArcNumber.new(199),
          ArcNumber.new(1),
          stableShareMinterWallet,
          positionId,
        ),
      );
    });

    it('should be able to borrow more if it has collateral to be used', async () => {
      await ctx.arc._borrowSynthetic(
        ArcNumber.new(199),
        ArcNumber.new(0),
        syntheticMinterWallet,
        positionId,
      );
    });

    it('should be able to borrow more if the price increases', async () => {
      await ctx.arc.oracle.setPrice(ArcDecimal.new(1500));
      await ctx.arc._borrowSynthetic(
        ArcNumber.new(450),
        ArcNumber.new(0),
        syntheticMinterWallet,
        positionId,
      );
    });

    it('should not be able to borrow more if the price decreases, more is borrowed and no extra collateral', async () => {
      await ctx.arc.oracle.setPrice(ArcDecimal.new(750));
      await expectRevert(
        ctx.arc._borrowSynthetic(
          ArcNumber.new(76),
          ArcNumber.new(0),
          syntheticMinterWallet,
          positionId,
        ),
      );
    });

    it('should be able to borrow more if the price increases, more is borrowed and more collateral is provided', async () => {
      await ctx.arc.oracle.setPrice(ArcDecimal.new(1500));
      await ctx.arc._borrowSynthetic(
        ArcDecimal.new(1200).value,
        ArcNumber.new(1),
        syntheticMinterWallet,
        positionId,
      );
    });

    it('should be able to borrow less if the price decreases', async () => {
      await ctx.arc.oracle.setPrice(ArcDecimal.new(750));
      await ctx.arc._borrowSynthetic(
        ArcNumber.new(25),
        ArcDecimal.new(0).value,
        syntheticMinterWallet,
        positionId,
      );
    });
  });
});
