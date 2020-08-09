import { Wallet } from 'ethers';
import { ITestContext } from '../arcDescribe';
import initializeArc from '../initializeArc';
import ArcDecimal from '../../src/utils/ArcDecimal';
import arcDescribe from '../arcDescribe';
import ArcNumber from '../../src/utils/ArcNumber';
import { expectRevert } from '../../src/utils/expectRevert';
import { getConfig } from '../../src/addresses/Config';
import ArcDecimal from '../../dist/src/utils/ArcDecimal';

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
    await ctx.arc.oracle.setPrice(ArcDecimal.new(100));
    const testConfig = getConfig(50);
    testConfig.liquidationArcFee = ArcDecimal.new(5).value;
    testConfig.liquidationUserFee = ArcDecimal.new(10).value;
    await ctx.arc.state.setGlobalParams({
      collateralRatio: { value: ArcNumber.new(2) },
      liquidationUserFee: { value: ArcNumber.new(5) },
      liquidationArcFee: { value: ArcNumber.new(5) },
      originationFee: { value: ArcNumber.new(5) },
    });
  });

  it('should not be able to liquidate a collateralised position', async () => {
    await ctx.arc._borrowSynthetic(ArcNumber.new(1), ArcNumber.new(200), syntheticMinterWallet);
    await expectRevert(ctx.arc.liquidatePosition(0, liquidatorWallet));
  });

  it('should not be able to liquidate a position without a synthetic', async () => {
    await ctx.arc._borrowSynthetic(ArcNumber.new(1), ArcNumber.new(200), syntheticMinterWallet);
    await ctx.arc.oracle.setPrice(ArcDecimal.new(150));
    await expectRevert(ctx.arc.liquidatePosition(0, liquidatorWallet));
  });

  it('should be able to liquidate and make the position healthy', async () => {
    await ctx.arc._borrowSynthetic(ArcNumber.new(1), ArcNumber.new(200), syntheticMinterWallet);
    await ctx.arc.oracle.setPrice(ArcDecimal.new(150));
    await ctx.arc._borrowSynthetic(ArcDecimal.new(2).value, ArcNumber.new(600), liquidatorWallet);

    await ctx.arc.liquidatePosition(0, liquidatorWallet);
    await expectRevert(ctx.arc.liquidatePosition(0, liquidatorWallet));

    expect(await ctx.arc.collateralAsset.balanceOf(liquidatorWallet.address)).toEqual(
      ArcNumber.new(130),
    );
  });
});
