import 'module-alias/register';

import { Signer } from 'ethers';
import { expect } from 'chai';

import ArcDecimal from '@src/utils/ArcDecimal';
import ArcNumber from '@src/utils/ArcNumber';
import { expectRevert } from '@test/helpers/expectRevert';
import { generateContext, ITestContext } from '../context';
import { SpritzTestArc } from '@src/SpritzTestArc';
import { spritzFixture } from '../fixtures';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';
import { StateV1Factory } from '@src/typings/StateV1Factory';
import { StateV1 } from '@src/typings/StateV1';

describe('Spritz.StateV1', () => {
  let ctx: ITestContext;
  let arc: SpritzTestArc;

  async function init(ctx: ITestContext): Promise<void> {
    await ctx.sdks.spritz.oracle.setPrice(ArcDecimal.new(400));
  }

  before(async () => {
    ctx = await generateContext(spritzFixture, init);
    arc = ctx.sdks.spritz;
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#setLimits', () => {
    it('should not be able to set limits as non-admin', async () => {
      const contract = await new StateV1Factory(ctx.signers.unauthorised).attach(arc.state.address);
      await expectRevert(
        contract.setRiskParams({
          collateralLimit: 0,
          syntheticLimit: 0,
          positionCollateralMinimum: 0,
        }),
      );
    });

    it('should be able to set limits as the admin', async () => {
      const contract = await new StateV1Factory(ctx.signers.admin).attach(arc.state.address);
      await contract.setRiskParams({
        collateralLimit: 0,
        syntheticLimit: 500,
        positionCollateralMinimum: 0,
      });
    });
  });

  describe('#limits', () => {
    it('should not be able to mint less than the minimum position amount', async () => {
      await arc.state.setRiskParams({
        collateralLimit: ArcNumber.new(10000),
        syntheticLimit: ArcNumber.new(10000),
        positionCollateralMinimum: ArcNumber.new(300),
      });
      await expectRevert(
        arc._borrowSynthetic(ArcNumber.new(1), ArcNumber.new(200), ctx.signers.admin),
      );
    });

    it('should not be able to mint more than the collateral limit', async () => {
      await arc.state.setRiskParams({
        collateralLimit: ArcNumber.new(100),
        syntheticLimit: ArcNumber.new(10000),
        positionCollateralMinimum: ArcNumber.new(1),
      });

      await expectRevert(
        arc._borrowSynthetic(ArcNumber.new(1), ArcNumber.new(200), ctx.signers.admin),
      );
    });

    it('should be able to mint the synthetic limit', async () => {
      await arc.state.setRiskParams({
        collateralLimit: ArcNumber.new(1000),
        syntheticLimit: ArcNumber.new(1),
        positionCollateralMinimum: ArcNumber.new(1),
      });

      await expectRevert(
        arc._borrowSynthetic(ArcNumber.new(2), ArcNumber.new(500), ctx.signers.admin),
      );
    });
  });

  describe('#onlyAdmin', () => {
    it('should not be able to set the market params as non-admin', async () => {
      const state = await arc.getState(ctx.signers.unauthorised);
      await expectRevert(
        state.setMarketParams({
          collateralRatio: ArcDecimal.new(0),
          liquidationArcFee: ArcDecimal.new(0),
          liquidationUserFee: ArcDecimal.new(0),
        }),
      );
    });

    it('should be able to set the market as admin', async () => {
      const state = await arc.getState(ctx.signers.admin);

      await state.setMarketParams({
        collateralRatio: ArcDecimal.new(1),
        liquidationArcFee: ArcDecimal.new(1),
        liquidationUserFee: ArcDecimal.new(1),
      });

      const currentMarket = await state.market();
      expect(currentMarket.collateralRatio.value).to.equal(ArcNumber.new(1));
      expect(currentMarket.liquidationArcFee.value).to.equal(ArcNumber.new(1));
      expect(currentMarket.liquidationUserFee.value).to.equal(ArcNumber.new(1));
    });

    it('should not be able to set the risk params as non-admin', async () => {
      const state = await arc.getState(ctx.signers.unauthorised);
      await expectRevert(
        state.setRiskParams({
          syntheticLimit: ArcNumber.new(100),
          collateralLimit: ArcNumber.new(100),
          positionCollateralMinimum: ArcNumber.new(100),
        }),
      );
    });

    it('should be able to set the risk params as admin', async () => {
      const state = await arc.getState(ctx.signers.admin);
      await state.setRiskParams({
        syntheticLimit: ArcNumber.new(100),
        collateralLimit: ArcNumber.new(100),
        positionCollateralMinimum: ArcNumber.new(100),
      });

      const currentRisk = await state.risk();
      expect(currentRisk.syntheticLimit).to.equal(ArcNumber.new(100));
      expect(currentRisk.collateralLimit).to.equal(ArcNumber.new(100));
      expect(currentRisk.positionCollateralMinimum).to.equal(ArcNumber.new(100));
    });

    it('should not be able to set the oracle as non-admin', async () => {
      const state = await arc.getState(ctx.signers.unauthorised);
      await expectRevert(state.setOracle(await ctx.signers.unauthorised.address));
    });

    it('should be able to set the oracle as admin', async () => {
      const state = await arc.getState(ctx.signers.admin);
      await state.setOracle(await ctx.signers.admin.address);
      expect(await state.oracle()).to.equal(await ctx.signers.admin.address);
    });
  });

  describe('#onlyCore', () => {
    let isolatedStateAddress: string;

    beforeEach(async () => {
      const ownerWalletAddress = await ctx.signers.admin.address;
      const contract = await new StateV1Factory(ctx.signers.admin).deploy(
        ownerWalletAddress,
        ownerWalletAddress,
        ownerWalletAddress,
        ownerWalletAddress,
        {
          collateralRatio: ArcDecimal.new(1),
          liquidationUserFee: ArcDecimal.new(1),
          liquidationArcFee: ArcDecimal.new(1),
        },
        {
          syntheticLimit: 0,
          collateralLimit: 0,
          positionCollateralMinimum: 0,
        },
      );
      isolatedStateAddress = contract.address;
    });

    async function getIsolatedState(caller: Signer) {
      return await new StateV1Factory(caller).attach(isolatedStateAddress);
    }

    async function saveNewPosition(state: StateV1) {
      return await state.savePosition({
        owner: await ctx.signers.admin.address,
        collateralAsset: 0,
        borrowedAmount: {
          sign: true,
          value: 0,
        },
        borrowedAsset: 0,
        collateralAmount: {
          sign: true,
          value: 0,
        },
      });
    }

    it('should not be able to save a new position as non-core', async () => {
      const state = await getIsolatedState(ctx.signers.unauthorised);
      await expectRevert(saveNewPosition(state));
    });

    it('should not be able to set the amount as non-core', async () => {
      const ownerState = await getIsolatedState(ctx.signers.admin);
      await saveNewPosition(ownerState);

      const otherState = await getIsolatedState(ctx.signers.unauthorised);
      await expectRevert(otherState.setAmount(0, 0, { sign: true, value: 0 }));
    });

    it('should not be able to update the position as non-core', async () => {
      const ownerState = await getIsolatedState(ctx.signers.admin);
      await saveNewPosition(ownerState);

      const otherState = await getIsolatedState(ctx.signers.unauthorised);
      await expectRevert(otherState.updatePositionAmount(0, 0, { sign: true, value: 0 }));
    });

    it('should not be able to set the supply balance as non-core', async () => {
      const state = await getIsolatedState(ctx.signers.unauthorised);
      await expectRevert(state.updateTotalSupplied(1));
    });

    it('should be able to save a new position as core', async () => {
      const state = await getIsolatedState(ctx.signers.admin);
      await saveNewPosition(state);
    });

    it('should be able to set the amount as core', async () => {
      const ownerState = await getIsolatedState(ctx.signers.admin);
      await saveNewPosition(ownerState);
      await ownerState.setAmount(0, 0, { sign: true, value: 0 });
    });

    it('should be able to update the position as core', async () => {
      const ownerState = await getIsolatedState(ctx.signers.admin);
      await saveNewPosition(ownerState);
      await ownerState.updatePositionAmount(0, 0, { sign: true, value: 0 });
    });

    it('should be able to set the supply balance as core', async () => {
      const state = await getIsolatedState(ctx.signers.admin);
      await state.updateTotalSupplied(1);
    });
  });
});
