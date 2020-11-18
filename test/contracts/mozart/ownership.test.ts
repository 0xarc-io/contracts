import 'module-alias/register';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';

import { expect } from 'chai';
import { mozartFixture } from '../fixtures';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';
import { generateContext, ITestContext } from '../context';
import { setupMozart } from '../setup';
import { MozartTestArc } from '@src/MozartTestArc';

import { TEN_PERCENT } from '@src/constants';
import { BigNumberish } from '@ethersproject/bignumber';
import Token from '@src/utils/Token';

describe('MozartV1.ownership', () => {
  const COLLATERAL_AMOUNT = ArcNumber.new(100);
  const BORROW_AMOUNT = ArcNumber.new(50);

  let ctx: ITestContext;
  let arc: MozartTestArc;

  async function init(ctx: ITestContext): Promise<void> {
    await setupMozart(ctx, {
      oraclePrice: ArcDecimal.new(1).value,
      collateralRatio: ArcDecimal.new(2).value,
      interestRate: TEN_PERCENT,
    });
  }

  before(async () => {
    ctx = await generateContext(mozartFixture, init);
    arc = ctx.sdks.mozart;
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#setGlobalOperator', () => {
    it('should not be able to set as a non-admin', async () => {
      await expect(
        arc.setGlobalOperatorStatus(
          ctx.signers.globalOperator.address,
          true,
          ctx.signers.unauthorised,
        ),
      ).to.be.reverted;
    });

    it('should be able to set as an admin', async () => {
      await expect(
        arc.setGlobalOperatorStatus(ctx.signers.globalOperator.address, true, ctx.signers.admin),
      )
        .to.be.emit(arc.core(), 'GlobalOperatorSet')
        .withArgs(ctx.signers.globalOperator.address, true);
      expect(await arc.core().isGlobalOperator(ctx.signers.globalOperator.address)).to.be.true;
    });

    it('should be able to remove as an admin', async () => {
      await arc.setGlobalOperatorStatus(
        ctx.signers.globalOperator.address,
        true,
        ctx.signers.admin,
      );
      expect(await arc.core().isGlobalOperator(ctx.signers.globalOperator.address)).to.be.true;
      await expect(
        arc.setGlobalOperatorStatus(ctx.signers.globalOperator.address, false, ctx.signers.admin),
      )
        .to.be.emit(arc.core(), 'GlobalOperatorSet')
        .withArgs(ctx.signers.globalOperator.address, false);
      expect(await arc.core().isGlobalOperator(ctx.signers.globalOperator.address)).to.be.false;
    });

    it('should not be able to set as a global operator', async () => {
      await arc.setGlobalOperatorStatus(
        ctx.signers.globalOperator.address,
        true,
        ctx.signers.admin,
      );
      await expect(
        arc.setGlobalOperatorStatus(
          ctx.signers.unauthorised.address,
          true,
          ctx.signers.globalOperator,
        ),
      ).to.be.reverted;
    });

    it('should be able to borrow & repay as a global operator', async () => {
      const startingCollatBalance = await arc
        .synth()
        .collateral.balanceOf(ctx.signers.globalOperator.address);
      await arc.openPosition(COLLATERAL_AMOUNT.mul(2), BORROW_AMOUNT, ctx.signers.minter);
      await arc.setGlobalOperatorStatus(
        ctx.signers.globalOperator.address,
        true,
        ctx.signers.admin,
      );

      expect(await arc.synthetic().balanceOf(ctx.signers.globalOperator.address)).to.equal(0);

      await arc.borrow(0, 0, BORROW_AMOUNT, ctx.signers.globalOperator);

      expect(await arc.synthetic().balanceOf(ctx.signers.globalOperator.address)).to.equal(
        BORROW_AMOUNT,
      );

      await arc.repay(0, BORROW_AMOUNT, 0, ctx.signers.globalOperator);

      expect(await arc.synthetic().balanceOf(ctx.signers.globalOperator.address)).to.equal(0);

      await Token.transfer(
        arc.syntheticAddress(),
        ctx.signers.globalOperator.address,
        BORROW_AMOUNT,
        ctx.signers.minter,
      );

      await arc.repay(0, BORROW_AMOUNT, COLLATERAL_AMOUNT.mul(2), ctx.signers.globalOperator);

      expect(await arc.synth().collateral.balanceOf(ctx.signers.globalOperator.address)).to.equal(
        startingCollatBalance.add(COLLATERAL_AMOUNT.mul(2)),
      );
    });
  });

  describe('#transferOwnership', () => {
    let currentPosition: BigNumberish;

    beforeEach(async () => {
      await arc.setGlobalOperatorStatus(ctx.signers.globalOperator.address, true);
      const result = await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.minter);
      currentPosition = result.params.id;
    });

    it('should not be able to transfer ownership as a non-owner', async () => {
      await expect(
        arc.transferOwnership(
          currentPosition,
          ctx.signers.unauthorised.address,
          ctx.signers.unauthorised,
        ),
      ).to.be.reverted;
    });

    it('should not be able to transfer ownership as an operator', async () => {
      await expect(
        arc.transferOwnership(
          currentPosition,
          ctx.signers.unauthorised.address,
          ctx.signers.globalOperator,
        ),
      ).to.be.reverted;
    });

    it('should be able to transfer ownership as the owner', async () => {
      await arc.transferOwnership(
        currentPosition,
        ctx.signers.unauthorised.address,
        ctx.signers.minter,
      );
      const position = await arc.getPosition(currentPosition);
      expect(position.owner).to.equal(ctx.signers.unauthorised.address);

      // ensure that the original owner can't do shiet
    });
  });

  describe('#setPositionOperatorStatus', () => {
    let currentPosition: BigNumberish;

    beforeEach(async () => {
      await arc.setGlobalOperatorStatus(ctx.signers.globalOperator.address, true);

      const result = await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.minter);
      currentPosition = result.params.id;
    });

    it('should not be able to set authorized position operator as a non-owner', async () => {
      const core = await ctx.contracts.mozart.coreV1.connect(ctx.signers.unauthorised);
      await expect(
        core.setPositionOperatorStatus(currentPosition, ctx.signers.unauthorised.address, true),
      ).to.be.reverted;
    });

    it('should be able to set an authorized position operator as the global operator', async () => {
      const globalOperatorContract = await ctx.contracts.mozart.coreV1.connect(
        ctx.signers.globalOperator,
      );
      await expect(
        globalOperatorContract.setPositionOperatorStatus(
          currentPosition,
          ctx.signers.positionOperator.address,
          true,
        ),
      )
        .to.emit(globalOperatorContract, 'PositionOperatorSet')
        .withArgs(currentPosition, ctx.signers.positionOperator.address, true);

      expect(
        await globalOperatorContract.isPositionOperator(
          currentPosition,
          ctx.signers.positionOperator.address,
        ),
      ).to.be.true;
    });

    it('should be able to remove an authorized position operator as the global operator', async () => {
      const globalOperatorContract = await ctx.contracts.mozart.coreV1.connect(
        ctx.signers.globalOperator,
      );
      await expect(
        globalOperatorContract.setPositionOperatorStatus(
          currentPosition,
          ctx.signers.positionOperator.address,
          true,
        ),
      )
        .to.emit(globalOperatorContract, 'PositionOperatorSet')
        .withArgs(currentPosition, ctx.signers.positionOperator.address, true);

      expect(
        await globalOperatorContract.isPositionOperator(
          currentPosition,
          ctx.signers.positionOperator.address,
        ),
      ).to.be.true;

      await expect(
        globalOperatorContract.setPositionOperatorStatus(
          currentPosition,
          ctx.signers.positionOperator.address,
          false,
        ),
      )
        .to.emit(globalOperatorContract, 'PositionOperatorSet')
        .withArgs(currentPosition, ctx.signers.positionOperator.address, false);

      expect(
        await globalOperatorContract.isPositionOperator(
          currentPosition,
          ctx.signers.positionOperator.address,
        ),
      ).to.be.false;
    });

    it('should be able to set an authorized  operator as the global operator', async () => {
      const globalOperatorContract = await ctx.contracts.mozart.coreV1.connect(
        ctx.signers.globalOperator,
      );
      await globalOperatorContract.setPositionOperatorStatus(
        currentPosition,
        ctx.signers.positionOperator.address,
        true,
      );
      expect(
        await globalOperatorContract.isPositionOperator(
          currentPosition,
          ctx.signers.positionOperator.address,
        ),
      ).to.be.true;
    });

    it('should be able to borrow & repay as an operator', async () => {
      const startingOpereatorBalance = await arc
        .synth()
        .collateral.balanceOf(ctx.signers.positionOperator.address);

      await arc.borrow(0, COLLATERAL_AMOUNT, 0, ctx.signers.minter);

      await arc.setPositionOperatorStatus(
        0,
        ctx.signers.positionOperator.address,
        true,
        ctx.signers.minter,
      );

      expect(await arc.synthetic().balanceOf(ctx.signers.positionOperator.address)).to.equal(0);

      await arc.borrow(0, 0, BORROW_AMOUNT, ctx.signers.positionOperator);

      expect(await arc.synthetic().balanceOf(ctx.signers.positionOperator.address)).to.equal(
        BORROW_AMOUNT,
      );

      await arc.repay(0, BORROW_AMOUNT, 0, ctx.signers.positionOperator);

      expect(await arc.synthetic().balanceOf(ctx.signers.positionOperator.address)).to.equal(0);

      await Token.transfer(
        arc.syntheticAddress(),
        ctx.signers.positionOperator.address,
        BORROW_AMOUNT,
        ctx.signers.minter,
      );

      await arc.repay(0, BORROW_AMOUNT, COLLATERAL_AMOUNT.mul(2), ctx.signers.positionOperator);

      expect(await arc.synth().collateral.balanceOf(ctx.signers.positionOperator.address)).to.equal(
        startingOpereatorBalance.add(COLLATERAL_AMOUNT.mul(2)),
      );
    });
  });
});
