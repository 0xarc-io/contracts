import 'module-alias/register';

import { Signer, Wallet } from 'ethers';
import { expect } from 'chai';

import ArcDecimal from '@src/utils/ArcDecimal';
import ArcNumber from '@src/utils/ArcNumber';
import { BigNumberish, BigNumber } from 'ethers';
import { expectRevert } from '@test/helpers/expectRevert';
import { generateContext, ITestContext } from '../context';
import { SpritzTestArc } from '@src/SpritzTestArc';
import { spritzFixture } from '../fixtures';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';
import Token from '@src/utils/Token';
import { AssetType } from '@arc-types/core';

describe('Spritz.operatePosition(open)', () => {
  let positionId: BigNumberish;
  let ctx: ITestContext;
  let arc: SpritzTestArc;

  async function init(ctx: ITestContext): Promise<void> {
    await ctx.sdks.spritz.oracle.setPrice(ArcDecimal.new(200));
    await ctx.sdks.spritz.collateralAsset.mintShare(ctx.signers.minter.address, ArcNumber.new(1));

    await Token.approve(
      ctx.sdks.spritz.collateralAsset.address,
      ctx.signers.minter,
      ctx.sdks.spritz.core.address,
      ArcNumber.new(1),
    );
  }

  before(async () => {
    ctx = await generateContext(spritzFixture, init);
    arc = ctx.sdks.spritz;
  });

  it('should be able to borrow by the exact amout of collateral provided', async () => {
    await arc.openPosition(ArcNumber.new(1), ArcNumber.new(100), ctx.signers.minter);

    const supply = await arc.state.totalSupplied();
    expect(supply).to.equal(ArcNumber.new(1));

    const position = await arc.state.positions(0);
    expect(position.collateralAmount.value).to.equal(ArcNumber.new(1));
    expect(position.collateralAmount.sign).to.equal(true);
    expect(position.borrowedAmount.value).to.equal(ArcNumber.new(100));
    expect(position.borrowedAmount.sign).to.equal(false);
    expect(position.collateralAsset).to.equal(AssetType.Collateral);
    expect(position.borrowedAsset).to.equal(AssetType.Synthetic);
  });

  it('should not be able to open a position with not enough collateral', async () => {
    await expectRevert(arc.openPosition(ArcNumber.new(1), ArcNumber.new(101), ctx.signers.minter));
  });

  it('should not be able to open a position with not enough collateral', async () => {
    await expectRevert(arc.openPosition(ArcNumber.new(0), ArcNumber.new(1), ctx.signers.minter));
  });
});
