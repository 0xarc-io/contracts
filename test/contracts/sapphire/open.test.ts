import { CreditScore, Operation } from '@arc-types/core';
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
import { CreditScoreProof } from '@src/SapphireArc';

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
  let creditScore1: CreditScore;
  let creditScore2: CreditScore;
  let creditScoreTree: CreditScoreTree;

  async function init(ctx: ITestContext): Promise<void> {
    creditScore1 = {
      account: ctx.signers.minter.address,
      amount: BigNumber.from(50),
    };
    creditScore2 = {
      account: ctx.signers.unauthorised.address,
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
    it('open at the exact c-ratio', async () => {
      const { operation, params, updatedPosition } = await arc.open(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        undefined,
        undefined,
        ctx.signers.unauthorised,
      );

      // Ensure the events emitted correct information
      expect(operation).eq(Operation.Open, 'Invalid operation emitted');
      expect(params.amountOne).eq(COLLATERAL_AMOUNT, 'Invalid collateral amount emitted');
      expect(params.amountTwo).eq(BORROW_AMOUNT, 'Invalid borrow amount emitted');
      expect(params.id).eq(0);
      expect(updatedPosition.borrowedAmount).eq(BORROW_AMOUNT);
      expect(updatedPosition.collateralAmount).eq(COLLATERAL_AMOUNT);

      // Check created position
      const { borrowedAmount, collateralAmount, owner } = await arc.synth().core.getPosition(0);
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT);
      expect(owner).to.equal(ctx.signers.unauthorised.address);

      // Check total collateral and borrowed values
      expect(await arc.core().getTotalCollateral()).eq(COLLATERAL_AMOUNT);
      expect(await arc.core().getTotalBorrowed()).eq(BORROW_AMOUNT);

      expect(await arc.synth().collateral.balanceOf(arc.syntheticAddress())).eq(COLLATERAL_AMOUNT);
    });

    it('open above the c-ratio', async () => {
      const { params } = await arc.open(
        COLLATERAL_AMOUNT.mul(2),
        BORROW_AMOUNT,
        undefined,
        undefined,
        ctx.signers.unauthorised,
      );

      const { borrowedAmount, collateralAmount, owner } = await arc.core().getPosition(params.id);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT.mul(2));
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
      expect(owner).to.equal(ctx.signers.unauthorised.address);
    });

    it('revert if opened below the c-ratio', async () => {
      await expect(
        arc.open(
          COLLATERAL_AMOUNT,
          BORROW_AMOUNT.add(1),
          undefined,
          undefined,
          ctx.signers.unauthorised,
        ),
      ).to.be.reverted;

      await expect(
        arc.open(
          COLLATERAL_AMOUNT.sub(1),
          BORROW_AMOUNT,
          undefined,
          undefined,
          ctx.signers.unauthorised,
        ),
      ).to.be.reverted;
    });

    it('open if no assessor is set', async () => {
      await arc.core().setAssessor(constants.AddressZero);
      const { params } = await arc.open(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        undefined,
        undefined,
        ctx.signers.unauthorised,
      );

      const { borrowedAmount, collateralAmount, owner } = await arc
        .synth()
        .core.getPosition(params.id);
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT);
      expect(owner).to.equal(ctx.signers.unauthorised.address);
    });

    it('revert if a score for address exists on-chain', async () => {
      await expect(
        arc.open(COLLATERAL_AMOUNT, BORROW_AMOUNT, undefined, undefined, ctx.signers.minter),
      ).to.be.reverted;
    });

    it('revert if opened below the minimum position amount', async () => {
      await arc.core().setLimits(0, COLLATERAL_AMOUNT.add(1));
      await expect(
        arc.open(COLLATERAL_AMOUNT, BORROW_AMOUNT, undefined, undefined, ctx.signers.unauthorised),
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

    it('open at the exact c-ratio', async () => {
      const { operation, params, updatedPosition } = await arc.open(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        creditScoreProof,
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
      const { borrowedAmount, collateralAmount, owner } = await arc.synth().core.getPosition(0);
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT);
      expect(owner).to.equal(ctx.signers.minter.address);

      // Check total collateral and borrowed values
      expect(await arc.core().getTotalCollateral()).eq(COLLATERAL_AMOUNT);
      expect(await arc.core().getTotalBorrowed()).eq(BORROW_AMOUNT);

      expect(await arc.synth().collateral.balanceOf(arc.syntheticAddress())).eq(COLLATERAL_AMOUNT);
    });

    it('open above the c-ratio', async () => {
      const { params } = await arc.open(
        COLLATERAL_AMOUNT.mul(2),
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        ctx.signers.unauthorised,
      );

      const { borrowedAmount, collateralAmount, owner } = await arc.core().getPosition(params.id);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT.mul(2));
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
      expect(owner).to.equal(ctx.signers.unauthorised.address);
    });

    it('revert if opened below the c-ratio', async () => {
      await expect(
        arc.open(
          constants.One,
          BORROW_AMOUNT,
          creditScoreProof,
          undefined,
          ctx.signers.unauthorised,
        ),
      ).to.be.reverted;
    });

    it('ignore proof(behavior based only on high c-ratio value) if no assessor is set', async () => {
      await arc.core().setAssessor(constants.AddressZero);
      const { params } = await arc.open(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        ctx.signers.unauthorised,
      );

      const { borrowedAmount, collateralAmount, owner } = await arc
        .synth()
        .core.getPosition(params.id);
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT);
      expect(owner).to.equal(ctx.signers.unauthorised.address);
    });

    it('open if a score for address exists on-chain', async () => {
      await ctx.contracts.sapphire.creditScore.verifyAndUpdate(creditScoreProof);
      const { params } = await arc.open(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        ctx.signers.unauthorised,
      );

      const { borrowedAmount, collateralAmount, owner } = await arc.core().getPosition(params.id);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT);
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
      expect(owner).to.equal(ctx.signers.unauthorised.address);
    });

    it('revert if opened below the minimum position amount', async () => {
      await arc.core().setLimits(0, COLLATERAL_AMOUNT.add(1));
      await expect(
        arc.open(
          COLLATERAL_AMOUNT,
          BORROW_AMOUNT,
          creditScoreProof,
          undefined,
          ctx.signers.unauthorised,
        ),
      ).to.be.reverted;
    });
  });
});
