import 'module-alias/register';

import ArcDecimal from '@src/utils/ArcDecimal';
import ArcNumber from '@src/utils/ArcNumber';
import { BigNumberish } from 'ethers';
import { expectRevert } from '@test/helpers/expectRevert';
import { generateContext, ITestContext } from '../context';
import { SpritzTestArc } from '@src/SpritzTestArc';
import { spritzFixture } from '../fixtures';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';

xdescribe('Spritz.operateAction(Repay)', () => {
  let positionId: BigNumberish;
  let ctx: ITestContext;
  let arc: SpritzTestArc;

  async function init(ctx: ITestContext): Promise<void> {
    await ctx.sdks.spritz.oracle.setPrice(ArcDecimal.new(400));
    const result = await ctx.sdks.spritz._borrowSynthetic(
      ArcNumber.new(200),
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

  it('should not be able to deposit someone elses position', async () => {
    await expectRevert(
      arc._repay(
        positionId,
        ArcDecimal.new(0.5).value,
        0,
        ctx.signers.unauthorized,
      ),
    );
  });

  it('should be able to repay the synthetic and withdraw an equal amount', async () => {
    await arc._repay(
      positionId,
      ArcNumber.new(100),
      ArcDecimal.new(0.5).value,
      ctx.signers.minter,
    );
  });

  it('should be able to deposit synthetic to increase the collateral ratio', async () => {
    await arc._repay(
      positionId,
      ArcNumber.new(100),
      ArcDecimal.new(0).value,
      ctx.signers.minter,
    );
  });

  it('should be able to repay synthetic then withdraw the excess', async () => {
    await arc._repay(
      positionId,
      ArcNumber.new(200),
      ArcDecimal.new(0).value,
      ctx.signers.minter,
    );

    await arc._repay(
      positionId,
      ArcNumber.new(0),
      ArcDecimal.new(1).value,
      ctx.signers.minter,
    );
  });

  it('should be able to repay if undercollateralised', async () => {
    await arc.oracle.setPrice(ArcDecimal.new(200));
    await arc._repay(
      positionId,
      ArcNumber.new(200),
      ArcNumber.new(0),
      ctx.signers.minter,
    );
  });

  it('should not be able to withdraw anything if undercollateralised', async () => {
    await arc.oracle.setPrice(ArcDecimal.new(200));
    await expectRevert(
      arc.repay(
        positionId,
        ArcNumber.new(0),
        ArcNumber.new(1),
        ctx.signers.minter,
      ),
    );
  });

  it('should not be able to withdraw more than it is allowed', async () => {
    await expectRevert(
      arc._repay(
        positionId,
        ArcNumber.new(0),
        ArcDecimal.new(0.0001).value,
        ctx.signers.minter,
      ),
    );
  });
});
