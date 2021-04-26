import 'module-alias/register';

import ArcDecimal from '@src/utils/ArcDecimal';
import ArcNumber from '@src/utils/ArcNumber';
import { BigNumberish } from 'ethers';
import { expectRevert } from '@test/helpers/expectRevert';
import { generateContext, ITestContext } from '../context';
import { SpritzTestArc } from '@src/SpritzTestArc';
import { spritzFixture } from '../fixtures';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';

xdescribe('Spritz.operateAction(Borrow)', () => {
  let positionId: BigNumberish;
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

    const result = await ctx.sdks.spritz._borrowSynthetic(
      ArcNumber.new(300),
      ArcNumber.new(1),
      ctx.signers.minter,
    );
    positionId = result.params.id;
  }

  before(async () => {
    ctx = await generateContext(spritzFixture, init);
    arc = ctx.sdks.spritz;
  });

  addSnapshotBeforeRestoreAfterEach();

  it('should not be able to borrow more than it is allowed', async () => {
    await arc._borrowSynthetic(
      ArcNumber.new(201),
      ArcNumber.new(1),
      ctx.signers.minter,
      positionId,
    );
  });

  it('should not be able to borrow on behalf of someone else', async () => {
    await expectRevert(
      arc._borrowSynthetic(
        ArcNumber.new(199),
        ArcNumber.new(1),
        ctx.signers.unauthorised,
        positionId,
      ),
    );
  });

  it('should be able to borrow more if it has collateral to be used', async () => {
    await arc._borrowSynthetic(
      ArcNumber.new(199),
      ArcNumber.new(0),
      ctx.signers.minter,
      positionId,
    );
  });

  it('should be able to borrow more if the price increases', async () => {
    await arc.oracle.setPrice(ArcDecimal.new(1500));
    await arc._borrowSynthetic(
      ArcNumber.new(450),
      ArcNumber.new(0),
      ctx.signers.minter,
      positionId,
    );
  });

  it('should not be able to borrow more if the price decreases, more is borrowed and no extra collateral', async () => {
    await arc.oracle.setPrice(ArcDecimal.new(750));
    await expectRevert(
      arc._borrowSynthetic(ArcNumber.new(76), ArcNumber.new(0), ctx.signers.minter, positionId),
    );
  });

  it('should be able to borrow more if the price increases, more is borrowed and more collateral is provided', async () => {
    await arc.oracle.setPrice(ArcDecimal.new(1500));
    await arc._borrowSynthetic(
      ArcDecimal.new(1200).value,
      ArcNumber.new(1),
      ctx.signers.minter,
      positionId,
    );
  });

  it('should be able to borrow less if the price decreases', async () => {
    await arc.oracle.setPrice(ArcDecimal.new(750));
    await arc._borrowSynthetic(
      ArcNumber.new(25),
      ArcDecimal.new(0).value,
      ctx.signers.minter,
      positionId,
    );
  });
});
