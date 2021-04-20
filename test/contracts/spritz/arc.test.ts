import 'module-alias/register';

import { expect } from 'chai';

import ArcDecimal from '@src/utils/ArcDecimal';
import ArcNumber from '@src/utils/ArcNumber';
import { expectRevert } from '@test/helpers/expectRevert';
import { generateContext, ITestContext } from '../context';
import { SpritzTestArc } from '../../../src/SpritzTestArc';
import { spritzFixture } from '../fixtures';
import { AddressZero } from '@ethersproject/constants';

xdescribe('Spritz', () => {
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
  }

  before(async () => {
    ctx = await generateContext(spritzFixture, init);
    arc = ctx.sdks.spritz;
  });

  describe('#init', () => {
    it('cannot call init if already called', async () => {
      const stateAddress = await arc.core.state();
      expect(stateAddress).not.to.equal(AddressZero);
      await expectRevert(arc.core.init(AddressZero));
    });
  });

  describe('#setPause', () => {
    it('cannot call operate action if contracts are paused', async () => {
      await arc.core.setPause(true);
      expect(await arc.core.paused()).to.be.true;
      await expectRevert(arc._borrowSynthetic(1, 5, ctx.signers.admin));
    });

    it('can unpause contracts', async () => {
      await arc.core.setPause(false);
      expect(await arc.core.paused()).to.be.false;
      await await arc._borrowSynthetic(1, 5, ctx.signers.admin);
    });
  });

  describe('#withdrawTokens', () => {
    beforeEach(async () => {
      await arc.collateralAsset.mintShare(arc.core.address, 5, {});
    });
    it('cannot withdraw as a non-admin', async () => {
      const core = await arc.getCore(ctx.signers.unauthorised);
      await expectRevert(
        core.withdrawTokens(arc.collateralAsset.address, ctx.signers.unauthorised.address, 1),
      );
    });

    it('can withdraw tokens as an admin', async () => {
      const core = await arc.getCore(ctx.signers.admin);
      await core.withdrawTokens(arc.collateralAsset.address, ctx.signers.unauthorised.address, 1);
    });
  });
});
