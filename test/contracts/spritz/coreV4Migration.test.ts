import 'module-alias/register';

import { expectRevert } from '@test/helpers/expectRevert';
import { generateContext, ITestContext } from '../context';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';
import { BigNumberish } from 'ethers';
import { SpritzTestArc } from '@src/SpritzTestArc';
import { spritzFixture } from '../fixtures';
import Token from '@src/utils/Token';
import { expect } from 'chai';
import { ArcProxyFactory } from '@src/typings/ArcProxyFactory';

xdescribe('Spritz.coreV4Migration', () => {
  let ctx: ITestContext;
  let arc: SpritzTestArc;
  let positionId: BigNumberish;

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

    await arc.state.setMarketParams({
      collateralRatio: { value: ArcNumber.new(2) },
      liquidationUserFee: { value: ArcDecimal.new(0.05).value },
      liquidationArcFee: { value: ArcDecimal.new(0.05).value },
    });

    await arc.state.setRiskParams({
      collateralLimit: ArcNumber.new(0),
      syntheticLimit: ArcNumber.new(0),
      positionCollateralMinimum: ArcNumber.new(1),
    });

    // Set the current implementation to V4
    await (await new ArcProxyFactory(ctx.signers.admin).attach(arc.core.address)).upgradeTo(
      ctx.contracts.spritz.coreV3.address,
    );

    // Price of LINK collateral = $10
    await arc.updatePrice(ArcDecimal.new(10).value);
  });

  it('should be able to open a position and go into positive debt', async () => {
    const result = await arc._borrowSynthetic(
      ArcNumber.new(100),
      ArcNumber.new(50),
      ctx.signers.minter,
    );
    positionId = result.params.id;

    await arc._borrowSynthetic(ArcNumber.new(500), ArcNumber.new(500), ctx.signers.liquidator);
    await Token.transfer(
      arc.syntheticAsset.address,
      ctx.signers.minter.address,
      ArcNumber.new(200),
      ctx.signers.liquidator,
    );

    // This should put the user's position in positive debt by 200
    const repayResult = await arc.repay(positionId, ArcNumber.new(300), 0, ctx.signers.minter);
    expect(repayResult.updatedPosition.borrowedAmount.sign).to.be.true;
    expect(repayResult.updatedPosition.borrowedAmount.value).to.equal(ArcNumber.new(200));

    // Drop the price so the position is now "under collateralised"
    // 50 LINK * 5 = $250, Borrow = $200 = < 200% c-ratio
    await arc.updatePrice(ArcDecimal.new(5).value);

    const isCollateralised = await arc.state.isCollateralized({
      ...repayResult.updatedPosition,
      collateralAsset: 0,
      borrowedAsset: 1,
    });
    expect(isCollateralised).to.be.false;

    await expectRevert(
      arc._borrowSynthetic(ArcNumber.new(10), ArcNumber.new(100), ctx.signers.minter, positionId),
    );
    await expectRevert(
      arc._borrowSynthetic(ArcNumber.new(200), ArcNumber.new(0), ctx.signers.minter, positionId),
    );

    await expectRevert(arc.liquidatePosition(positionId, ctx.signers.liquidator));
  });

  it('should be able to upgrade to v4 and remove all collateral', async () => {
    await (await new ArcProxyFactory(ctx.signers.admin).attach(arc.core.address)).upgradeTo(
      ctx.contracts.spritz.coreV4.address,
    );

    await expectRevert(arc.liquidatePosition(positionId, ctx.signers.liquidator));

    await expectRevert(
      arc._borrowSynthetic(ArcNumber.new(2000), ArcNumber.new(0), ctx.signers.minter, positionId),
    );

    await expectRevert(
      arc.repay(positionId, ArcNumber.new(200), ArcNumber.new(500), ctx.signers.minter),
    );

    // Withdraw the excess $200 in the system itself
    const borrowResult = await arc._borrowSynthetic(
      ArcNumber.new(200),
      ArcNumber.new(0),
      ctx.signers.minter,
      positionId,
    );

    expect(borrowResult.updatedPosition.borrowedAmount.value).to.equal(ArcNumber.new(0));
    expect(borrowResult.updatedPosition.borrowedAmount.sign).to.be.false;

    // Withdraw the remaining collateral
    const repayResult = await arc.repay(
      positionId,
      ArcNumber.new(0),
      ArcNumber.new(50),
      ctx.signers.minter,
    );

    expect(repayResult.updatedPosition.collateralAmount.value).to.equal(ArcNumber.new(0));
    expect(repayResult.updatedPosition.collateralAmount.sign).to.be.true;

    // Make sure they can't go into positive debt again
    await expectRevert(arc.repay(positionId, ArcNumber.new(100), 0, ctx.signers.minter));
  });
});
