import 'module-alias/register';

import { Wallet } from 'ethers';
import { ITestContext } from '@test/helpers/d1ArcDescribe';
import initializeArc from '@test/helpers/initializeArc';
import d1ArcDescribe from '@test/helpers/d1ArcDescribe';
import ArcDecimal from '@src/utils/ArcDecimal';
import ArcNumber from '@src/utils/ArcNumber';
import { expectRevert } from '@src/utils/expectRevert';
import { BigNumber } from 'ethers/utils';
import { MockOracle } from '@src/typings';
import { getWaffleExpect } from '../../helpers/testingUtils';

let ownerWallet: Wallet;
let lenderWallet: Wallet;
let syntheticMinterWallet: Wallet;
let stableShareMinterWallet: Wallet;
let liquidatorWallet: Wallet;

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);

  ownerWallet = ctx.accounts[0].wallet;
  lenderWallet = ctx.accounts[1].wallet;
  syntheticMinterWallet = ctx.accounts[2].wallet;
  stableShareMinterWallet = ctx.accounts[3].wallet;
  liquidatorWallet = ctx.accounts[4].wallet;
}

const expect = getWaffleExpect();

d1ArcDescribe('#Actions.liquidatePosition()', init, (ctx: ITestContext) => {
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
    const expectedCut = new BigNumber('26481481481481481');

    expect(
      (await ctx.arc.collateralAsset.balanceOf(await liquidatorWallet.getAddress())).toString(),
    ).to.equal(expectedReward.sub(expectedCut).toString());

    expect((await ctx.arc.collateralAsset.balanceOf(ctx.arc.core.address)).toString()).to.equal(
      expectedCut.toString(),
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
