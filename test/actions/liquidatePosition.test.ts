import { Wallet } from 'ethers';
import { ITestContext } from '../helpers/arcDescribe';
import initializeArc from '../helpers/initializeArc';
import arcDescribe from '../helpers/arcDescribe';
import ArcDecimal from '../../src/utils/ArcDecimal';
import ArcNumber from '../../src/utils/ArcNumber';
import { expectRevert } from '../../src/utils/expectRevert';
import { BigNumber } from 'ethers/utils';
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

arcDescribe('#Actions.liquidatePosition()', init, (ctx: ITestContext) => {
  beforeEach(async () => {
    const oracle = await MockOracle.at(ownerWallet, ctx.arc.oracle.address);
    await oracle.setPrice(ArcDecimal.new(1000));

    // The total liquidation premium is 10% in this case
    // 5% is the liquidator reward, 5% is the arc fee
    await ctx.arc.state.setMarketParams({
      collateralRatio: { value: ArcNumber.new(2) },
      liquidationUserFee: { value: ArcDecimal.new(0.05).value },
      liquidationArcFee: { value: ArcDecimal.new(0.05).value },
      interestRate: { value: ArcNumber.new(0) },
    });
  });

  it('should not be able to liquidate a collateralised position', async () => {
    const result = await ctx.arc._borrowSynthetic(
      ArcNumber.new(200),
      ArcNumber.new(1),
      syntheticMinterWallet,
    );
    await expectRevert(ctx.arc.liquidatePosition(result.params.id, liquidatorWallet));
  });

  it('should not be able to liquidate a position without a synthetic', async () => {
    const result = await ctx.arc._borrowSynthetic(
      ArcNumber.new(200),
      ArcNumber.new(1),
      syntheticMinterWallet,
    );
    await ctx.arc.oracle.setPrice(ArcDecimal.new(300));
    await expectRevert(ctx.arc.liquidatePosition(result.params.id, liquidatorWallet));
  });

  it('should be able to liquidate and make the position healthy', async () => {
    const result = await ctx.arc._borrowSynthetic(
      ArcNumber.new(200),
      ArcNumber.new(1),
      syntheticMinterWallet,
    );

    await ctx.arc.oracle.setPrice(ArcDecimal.new(300));
    await ctx.arc._borrowSynthetic(ArcNumber.new(300), ArcNumber.new(2), liquidatorWallet);

    await ctx.arc.liquidatePosition(result.params.id, liquidatorWallet);
    await expectRevert(ctx.arc.liquidatePosition(result.params.id, liquidatorWallet));

    const expectedReward = new BigNumber('529629629629629628');

    expect(await ctx.arc.collateralAsset.balanceOf(liquidatorWallet.address)).toEqual(
      expectedReward.div(2),
    );

    expect(await ctx.arc.collateralAsset.balanceOf(ctx.arc.core.address)).toEqual(
      expectedReward.div(2),
    );
  });

  it('should be able to liquidate a position if the price drops again', async () => {
    const result = await ctx.arc._borrowSynthetic(
      ArcNumber.new(200),
      ArcNumber.new(1),
      syntheticMinterWallet,
    );

    await ctx.arc.oracle.setPrice(ArcDecimal.new(300));
    await ctx.arc._borrowSynthetic(ArcNumber.new(300), ArcNumber.new(2), liquidatorWallet);

    await ctx.arc.liquidatePosition(result.params.id, liquidatorWallet);

    await ctx.arc.oracle.setPrice(ArcDecimal.new(200));
    await ctx.arc.liquidatePosition(result.params.id, liquidatorWallet);
    await expectRevert(ctx.arc.liquidatePosition(result.params.id, liquidatorWallet));
  });
});
