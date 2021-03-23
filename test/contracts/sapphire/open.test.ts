import { Operation } from '@arc-types/core';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import chai, { expect } from 'chai';
import { utils } from 'ethers';
import { solidity } from 'ethereum-waffle';
import 'module-alias/register';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

chai.use(solidity);

/**
 * When calling open(), it's calling borrow underneath the hood but just creates a new position
 * so that no custom logic is used for open versus borrow. The two scenarios to test here are for
 * for with a valid score proof and one without a valid score proof. You only need a score proof
 * if your address has a store proof in the CreditScore contract.
 */
describe.only('SapphireCore.open()', () => {
  const COLLATERAL_AMOUNT = utils.parseEther('100');
  const BORROW_AMOUNT = utils.parseEther('50');

  let ctx: ITestContext;
  let arc: SapphireTestArc;

  async function init(ctx: ITestContext): Promise<void> {
    await setupSapphire(ctx, {
    });
  }

  before(async () => {
    ctx = await generateContext(sapphireFixture, init);
    arc = ctx.sdks.sapphire;
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('without score proof', () => {
    it('open at the exact c-ratio', async () => {
      const { operation, params, updatedPosition } = await ctx.sdks.sapphire.open(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        undefined,
        undefined,
        ctx.signers.minter,
      );

      // Ensure the events emitted correct information
      expect(operation).eq(Operation.Open, 'Invalid operation emitted');
      expect(params.amountOne).eq(COLLATERAL_AMOUNT, 'Invalid collateral amount emitted');
      expect(params.amountTwo).eq(BORROW_AMOUNT, 'Invalid borrow amount emitted');
      expect(params.id).eq(0);
      expect(updatedPosition.borrowedAmount).eq(BORROW_AMOUNT);
      expect(updatedPosition.collateralAmount).eq(COLLATERAL_AMOUNT);

      // Check created position
      const { borrowedAmount, collateralAmount } = await arc.synth().core.getPosition(0);
      expect(borrowedAmount).eq(BORROW_AMOUNT);
      expect(collateralAmount).eq(COLLATERAL_AMOUNT);

      // Check total collateral and borrowed values
      expect(await arc.core().getTotalCollateral()).eq(COLLATERAL_AMOUNT);
      expect(await arc.core().getTotalBorrowed()).eq(BORROW_AMOUNT);

      expect(await arc.synth().collateral.balanceOf(arc.syntheticAddress())).eq(COLLATERAL_AMOUNT);
    });

    it('open above the c-ratio', async () => {});

    it('revert if opened below the c-ratio', async () => {});

    it('open if no assessor is set', async () => {});

    it('revert if a score for address exists on-chain', async () => {});

    it('revert if opened below the minimum position amount', async () => {});
  });

  describe('with score proof', () => {
    it('open at the exact c-ratio', async () => {});

    it('open above the c-ratio', async () => {});

    it('revert if opened below the c-ratio', async () => {});

    it('ignore proof(behavior based only on high c-ratio value) if no assessor is set', async () => {});

    it('open if a score for address exists on-chain', async () => {});

    it('revert if opened below the minimum position amount', async () => {});
  });
});
