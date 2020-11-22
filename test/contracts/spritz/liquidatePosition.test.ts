import 'module-alias/register';

import { expect } from 'chai';

import ArcDecimal from '@src/utils/ArcDecimal';
import ArcNumber from '@src/utils/ArcNumber';
import { BigNumber } from 'ethers';
import { expectRevert } from '@test/helpers/expectRevert';
import { generateContext, ITestContext } from '../context';
import { SpritzTestArc } from '@src/SpritzTestArc';
import { spritzFixture } from '../fixtures';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';

describe('Spritz.operateAction(Liquidation)', () => {
  let ctx: ITestContext;
  let arc: SpritzTestArc;

  async function init(ctx: ITestContext): Promise<void> {
    await ctx.sdks.spritz.updatePrice(ArcDecimal.new(1000).value);

    // The total liquidation premium is 10% in this case
    // 5% is the liquidator reward, 5% is the arc fee
    await ctx.sdks.spritz.state.setMarketParams({
      collateralRatio: { value: ArcNumber.new(2) },
      liquidationUserFee: { value: ArcDecimal.new(0.05).value },
      liquidationArcFee: { value: ArcDecimal.new(0.05).value },
    });

    await ctx.sdks.spritz._borrowSynthetic(
      ArcNumber.new(300),
      ArcNumber.new(1),
      ctx.signers.minter,
    );
  }

  before(async () => {
    ctx = await generateContext(spritzFixture, init);
    arc = ctx.sdks.spritz;
  });

  addSnapshotBeforeRestoreAfterEach();

  it('should not be able to liquidate a collateralised position', async () => {
    const result = await arc._borrowSynthetic(
      ArcNumber.new(200),
      ArcNumber.new(1),
      ctx.signers.minter,
    );
    await expectRevert(arc.liquidatePosition(result.params.id, ctx.signers.liquidator));
  });

  it('should not be able to liquidate a position without a synthetic', async () => {
    const result = await arc._borrowSynthetic(
      ArcNumber.new(200),
      ArcNumber.new(1),
      ctx.signers.minter,
    );
    await arc.oracle.setPrice(ArcDecimal.new(300));
    await expectRevert(arc.liquidatePosition(result.params.id, ctx.signers.liquidator));
  });

  it('should be able to liquidate and make the position healthy', async () => {
    const result = await arc._borrowSynthetic(
      ArcNumber.new(200),
      ArcNumber.new(1),
      ctx.signers.minter,
    );

    await arc.oracle.setPrice(ArcDecimal.new(300));
    await arc._borrowSynthetic(ArcNumber.new(300), ArcNumber.new(2), ctx.signers.liquidator);

    await arc.liquidatePosition(result.params.id, ctx.signers.liquidator);
    await expectRevert(arc.liquidatePosition(result.params.id, ctx.signers.liquidator));

    const expectedReward = BigNumber.from('529629629629629628');
    const expectedCut = BigNumber.from('26481481481481481');

    expect(
      (await arc.collateralAsset.balanceOf(await ctx.signers.liquidator.getAddress())).toString(),
    ).to.equal(expectedReward.sub(expectedCut).toString());

    expect((await arc.collateralAsset.balanceOf(arc.core.address)).toString()).to.equal(
      expectedCut.toString(),
    );
  });

  it('should be able to liquidate a position if the price drops again', async () => {
    const result = await arc._borrowSynthetic(
      ArcNumber.new(200),
      ArcNumber.new(1),
      ctx.signers.minter,
    );

    await arc.oracle.setPrice(ArcDecimal.new(300));
    await arc._borrowSynthetic(ArcNumber.new(300), ArcNumber.new(2), ctx.signers.liquidator);

    await arc.liquidatePosition(result.params.id, ctx.signers.liquidator);

    await arc.oracle.setPrice(ArcDecimal.new(200));
    await arc.liquidatePosition(result.params.id, ctx.signers.liquidator);
    await expectRevert(arc.liquidatePosition(result.params.id, ctx.signers.liquidator));
  });
});
