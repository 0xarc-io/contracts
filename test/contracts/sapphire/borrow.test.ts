import { CreditScore, CreditScoreProof, Operation } from '@arc-types/sapphireCore';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import chai, { expect } from 'chai';
import { BigNumber, constants, utils } from 'ethers';
import { solidity } from 'ethereum-waffle';
import 'module-alias/register';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';

chai.use(solidity);

/**
 * This is the most crucial function of the system as it's how users actually borrow from a vault.
 * When call borrow the first time, new position is created under the hood.
 * When borrowing, we won't let a user borrow without a credit proof if they're already being tracked
 * in the system. This means that if people can't obtain a credit proof then they can't borrow. The same
 * cannot be said for liquidate and repay since the credit proof is optional. When testing the borrow
 * function we need to make sure that every case of with a credit proof, without a credit proof, price changes,
 * the the first borrow call and follow-up calls is tested.
 */
describe.only('SapphireCore.borrow()', () => {
  const COLLATERAL_AMOUNT = utils.parseEther('100');
  const BORROW_AMOUNT = utils.parseEther('50');

  let ctx: ITestContext;
  let arc: SapphireTestArc;
  let creditScore1: CreditScore;
  let creditScore2: CreditScore;
  let creditScoreTree: CreditScoreTree;

  async function init(ctx: ITestContext): Promise<void> {
    creditScore1 = {
      account: ctx.signers.minter.address,
      amount: BigNumber.from(500),
    };
    creditScore2 = {
      account: ctx.signers.interestSetter.address,
      amount: BigNumber.from(20),
    };
    creditScoreTree = new CreditScoreTree([creditScore1, creditScore2]);
    await setupSapphire(ctx, {
      collateralRatio: constants.WeiPerEther.mul(2),
      merkleRoot: creditScoreTree.getHexRoot(),
    });
  }

  before(async () => {
    ctx = await generateContext(sapphireFixture, init);
    arc = ctx.sdks.sapphire;
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('without score proof', () => {
    it('borrow at the exact c-ratio', async () => {
      const { operation, params, updatedPosition } = await arc.borrow(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        undefined,
        undefined,
        ctx.signers.unauthorised,
      );

      // Ensure the events emitted correct information
      expect(operation).eq(Operation.Borrow, 'Invalid operation emitted');
      expect(params.collateralAmount).eq(COLLATERAL_AMOUNT, 'Invalid collateral amount emitted');
      expect(params.borrowedAmount).eq(BORROW_AMOUNT, 'Invalid borrow amount emitted');
      expect(params.owner).eq(ctx.signers.unauthorised.address);
      expect(updatedPosition.borrowedAmount).eq(BORROW_AMOUNT);
      expect(updatedPosition.collateralAmount).eq(COLLATERAL_AMOUNT);

      // Check created position
      const { borrowedAmount, collateralAmount } = await arc.synth().core.getPosition(params.owner);
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT);

      // Check total collateral and borrowed values
      expect(await arc.core().totalCollateral()).eq(COLLATERAL_AMOUNT);
      expect(await arc.core().totalBorrowed()).eq(BORROW_AMOUNT);

      expect(await arc.synth().collateral.balanceOf(arc.syntheticAddress())).eq(COLLATERAL_AMOUNT);
    });

    it('borrow above the c-ratio', async () => {
      const { params } = await arc.borrow(
        COLLATERAL_AMOUNT.mul(2),
        BORROW_AMOUNT,
        undefined,
        undefined,
        ctx.signers.unauthorised,
      );

      const { borrowedAmount, collateralAmount } = await arc.core().getPosition(params.owner);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT.mul(2));
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
    });

    it('revert if borrowed below the c-ratio', async () => {
      await expect(
        arc.borrow(
          COLLATERAL_AMOUNT,
          BORROW_AMOUNT.add(1),
          undefined,
          undefined,
          ctx.signers.unauthorised,
        ),
      ).to.be.reverted;

      await expect(
        arc.borrow(
          COLLATERAL_AMOUNT.sub(1),
          BORROW_AMOUNT,
          undefined,
          undefined,
          ctx.signers.unauthorised,
        ),
      ).to.be.reverted;
    });

    it('borrow if no assessor is set', async () => {
      await arc.core().setAssessor(constants.AddressZero);
      const { params } = await arc.borrow(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        undefined,
        undefined,
        ctx.signers.unauthorised,
      );

      const { borrowedAmount, collateralAmount } = await arc.synth().core.getPosition(params.owner);
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT);
    });

    it('revert if a score for address exists on-chain', async () => {
      await expect(
        arc.borrow(COLLATERAL_AMOUNT, BORROW_AMOUNT, undefined, undefined, ctx.signers.minter),
      ).to.be.reverted;
    });

    it('revert if borrowed below the minimum position amount', async () => {
      await arc.core().setLimits(0, COLLATERAL_AMOUNT.add(1));
      await expect(
        arc.borrow(COLLATERAL_AMOUNT, BORROW_AMOUNT, undefined, undefined, ctx.signers.unauthorised),
      ).to.be.reverted;
    });
  });

  describe('with score proof', () => {
    let creditScoreProof: CreditScoreProof;

    before(() => {
      creditScoreProof = {
        account: creditScore1.account,
        score: creditScore1.amount,
        merkleProof: creditScoreTree.getProof(creditScore1.account, creditScore1.amount),
      };
    });

    it('borrow at the exact default c-ratio', async () => {
      const { operation, params, updatedPosition } = await arc.borrow(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        ctx.signers.minter,
      );

      // Ensure the events emitted correct information
      expect(operation).eq(Operation.Borrow, 'Invalid operation emitted');
      expect(params.collateralAmount).eq(COLLATERAL_AMOUNT, 'Invalid collateral amount emitted');
      expect(params.borrowedAmount).eq(BORROW_AMOUNT, 'Invalid borrow amount emitted');
      expect(params.owner).eq(ctx.signers.minter.address);
      expect(updatedPosition.borrowedAmount).eq(BORROW_AMOUNT);
      expect(updatedPosition.collateralAmount).eq(COLLATERAL_AMOUNT);

      // Check created position
      const { borrowedAmount, collateralAmount } = await arc.synth().core.getPosition(params.owner);
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT);

      // Check total collateral and borrowed values
      expect(await arc.core().getTotalCollateral()).eq(COLLATERAL_AMOUNT);
      expect(await arc.core().getTotalBorrowed()).eq(BORROW_AMOUNT);

      expect(await arc.synth().collateral.balanceOf(arc.syntheticAddress())).eq(COLLATERAL_AMOUNT);
    });

    it('borrow above the default c-ratio', async () => {
      const { params } = await arc.borrow(
        COLLATERAL_AMOUNT.mul(2),
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        ctx.signers.minter,
      );

      const { borrowedAmount, collateralAmount } = await arc.core().getPosition(params.owner);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT.mul(2));
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);;
    });

    it('borrow below the default c-ratio, but above c-ratio based on credit score', async () => {
      const { params } = await arc.borrow(
        COLLATERAL_AMOUNT.sub(1),
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        ctx.signers.minter,
      );

      const { borrowedAmount, collateralAmount } = await arc.core().getPosition(params.owner);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT.sub(1));
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
    });

    it('borrow at the c-ratio based on credit score', async () => {
      const { params } = await arc.borrow(
        COLLATERAL_AMOUNT.sub(COLLATERAL_AMOUNT.div(2)),
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        ctx.signers.minter,
      );

      const { borrowedAmount, collateralAmount } = await arc.core().getPosition(params.owner);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT.sub(1));
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
    });

    it('revert if borrowed below c-ratio based on credit score', async () => {
      await expect(
        arc.borrow(constants.One, BORROW_AMOUNT, creditScoreProof, undefined, ctx.signers.minter),
      ).to.be.reverted;
    });

    it('ignore proof(behavior based only on high c-ratio value) if no assessor is set', async () => {
      await arc.core().setAssessor(constants.AddressZero);
      await expect(
        arc.borrow(
          COLLATERAL_AMOUNT.sub(1),
          BORROW_AMOUNT,
          creditScoreProof,
          undefined,
          ctx.signers.minter,
        ),
      ).to.be.reverted;

      const { params } = await arc.borrow(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        ctx.signers.minter,
      );

      const { borrowedAmount, collateralAmount } = await arc
        .synth()
        .core.getPosition(params.owner);
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT);
    });

    it('borrow if a score for address exists on-chain', async () => {
      await ctx.contracts.sapphire.creditScore.verifyAndUpdate(creditScoreProof);
      const { params } = await arc.borrow(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        ctx.signers.minter,
      );

      const { borrowedAmount, collateralAmount } = await arc.core().getPosition(params.owner);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT);
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
    });

    it('revert if borrowed below the minimum position amount', async () => {
      await arc.core().setLimits(0, COLLATERAL_AMOUNT.add(1));
      await expect(
        arc.borrow(COLLATERAL_AMOUNT, BORROW_AMOUNT, creditScoreProof, undefined, ctx.signers.minter),
      ).to.be.reverted;
    });
  });
});
