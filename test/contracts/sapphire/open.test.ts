import { CreditScore, CreditScoreProof } from '@arc-types/sapphireCore';
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
 * When calling open(), it's calling executeActions underneath the hood with borrow and deposit actions. 
 * Because borrow is called first time it creates a position for sender, which is connected directly with his address. 
 * The two scenarios to test here are for with a valid score proof and one without a valid score proof. 
 * You only need a score proof if your address has a store proof in the CreditScore contract.
 */
describe('SapphireCore.open()', () => {
  const COLLATERAL_AMOUNT = utils.parseEther('100');
  const BORROW_AMOUNT = utils.parseEther('50');

  let ctx: ITestContext;
  let arc: SapphireTestArc;
  let creditScore1: CreditScore;
  let creditScore2: CreditScore;
  let creditScoreTree: CreditScoreTree;

  async function init(ctx: ITestContext): Promise<void> {
    creditScore1 = {
      account: ctx.signers.scoredMinter.address,
      amount: BigNumber.from(500),
    };
    creditScore2 = {
      account: ctx.signers.interestSetter.address,
      amount: BigNumber.from(20),
    };
    creditScoreTree = new CreditScoreTree([creditScore1, creditScore2]);
    await setupSapphire(ctx, {
      lowCollateralRatio: constants.WeiPerEther.mul(2),
      highCollateralRatio: constants.WeiPerEther.mul(2),
      merkleRoot: creditScoreTree.getHexRoot(),
    });
  }

  before(async () => {
    ctx = await generateContext(sapphireFixture, init);
    arc = ctx.sdks.sapphire;
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('without score proof', () => {
    let unauthorisedAddress: string;

    before(() => {
      unauthorisedAddress = ctx.signers.unauthorised.address;
    });

    it('open at the exact c-ratio', async () => {
      const vault = await arc.open(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        undefined,
        undefined,
        ctx.signers.minter,
      );

      // Ensure the events emitted correct information
      expect(vault.borrowedAmount).eq(BORROW_AMOUNT);
      expect(vault.collateralAmount).eq(COLLATERAL_AMOUNT);

      // Check created vault
      const { borrowedAmount, collateralAmount } = await arc
        .synth()
        .core.getVault(unauthorisedAddress);
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT);

      // Check total collateral and borrowed values
      expect(await arc.core().totalCollateral()).eq(COLLATERAL_AMOUNT);
      expect(await arc.core().totalBorrowed()).eq(BORROW_AMOUNT);

      expect(await arc.synth().collateral.balanceOf(arc.syntheticAddress())).eq(COLLATERAL_AMOUNT);
    });

    it('open above the c-ratio', async () => {
      await arc.open(
        COLLATERAL_AMOUNT.mul(2),
        BORROW_AMOUNT,
        undefined,
        undefined,
        ctx.signers.minter,
      );

      const { borrowedAmount, collateralAmount } = await arc.core().getVault(unauthorisedAddress);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT.mul(2));
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
    });

    it('revert if opened below the c-ratio', async () => {
      await expect(
        arc.open(
          COLLATERAL_AMOUNT,
          BORROW_AMOUNT.add(1),
          undefined,
          undefined,
          ctx.signers.minter,
        ),
      ).to.be.reverted;

      await expect(
        arc.open(
          COLLATERAL_AMOUNT.sub(1),
          BORROW_AMOUNT,
          undefined,
          undefined,
          ctx.signers.minter,
        ),
      ).to.be.reverted;
    });

    it('open if no assessor is set', async () => {
      await arc.core().setAssessor(constants.AddressZero);
      await arc.open(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        undefined,
        undefined,
        ctx.signers.minter,
      );

      const { borrowedAmount, collateralAmount } = await arc
        .synth()
        .core.getVault(unauthorisedAddress);
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT);
    });

    it('revert if a score for address exists on-chain', async () => {
      await expect(
        arc.open(COLLATERAL_AMOUNT, BORROW_AMOUNT, undefined, undefined, ctx.signers.scoredMinter),
      ).to.be.reverted;
    });

    it('revert if opened below the minimum position amount', async () => {
      await arc.core().setLimits(0, BORROW_AMOUNT.add(1), 0);
      await expect(
        arc.open(COLLATERAL_AMOUNT, BORROW_AMOUNT, undefined, undefined, ctx.signers.minter),
      ).to.be.reverted;
    });
  
    it('revert if opened above the maximum borrowed amount', async () => {
      await arc.core().setLimits(0, 0, BORROW_AMOUNT.sub(1));
      await expect(
        arc.open(COLLATERAL_AMOUNT, BORROW_AMOUNT, undefined, undefined, ctx.signers.minter),
      ).to.be.reverted;
    });
  });

  describe('with score proof', () => {
    let creditScoreProof: CreditScoreProof;
    let minterAddress: string;
    before(() => {
      creditScoreProof = {
        account: creditScore1.account,
        score: creditScore1.amount,
        merkleProof: creditScoreTree.getProof(creditScore1.account, creditScore1.amount),
      };
      minterAddress = ctx.signers.minter.address;
    });

    it('open at the exact default c-ratio', async () => {
      const vault = await arc.open(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        ctx.signers.scoredMinter,
      );

      // Check created vault
      const { borrowedAmount, collateralAmount } = await arc
        .synth()
        .core.getVault(minterAddress);
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT);

      // Check total collateral and borrowed values
      expect(await arc.core().getTotalCollateral()).eq(COLLATERAL_AMOUNT);
      expect(await arc.core().getTotalBorrowed()).eq(BORROW_AMOUNT);

      expect(await arc.synth().collateral.balanceOf(arc.syntheticAddress())).eq(COLLATERAL_AMOUNT);
    });

    it('open above the default c-ratio', async () => {
      await arc.open(
        COLLATERAL_AMOUNT.mul(2),
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        ctx.signers.scoredMinter,
      );

      const { borrowedAmount, collateralAmount } = await arc.core().getVault(minterAddress);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT.mul(2));
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
    });

    it('open below the default c-ratio, but above c-ratio based on credit score', async () => {
      await arc.open(
        COLLATERAL_AMOUNT.sub(1),
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        ctx.signers.scoredMinter,
      );

      const { borrowedAmount, collateralAmount } = await arc.core().getVault(minterAddress);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT.sub(1));
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
    });

    it('open at the c-ratio based on credit score', async () => {
      await arc.open(
        COLLATERAL_AMOUNT.sub(COLLATERAL_AMOUNT.div(2)),
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        ctx.signers.scoredMinter,
      );

      const { borrowedAmount, collateralAmount } = await arc.core().getVault(minterAddress);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT.sub(1));
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
    });

    it('revert if opened below c-ratio based on credit score', async () => {
      await expect(
        arc.open(constants.One, BORROW_AMOUNT, creditScoreProof, undefined, ctx.signers.scoredMinter),
      ).to.be.reverted;
    });

    it('ignore proof(behavior based only on high c-ratio value) if no assessor is set', async () => {
      await arc.core().setAssessor(constants.AddressZero);
      await expect(
        arc.open(
          COLLATERAL_AMOUNT.sub(1),
          BORROW_AMOUNT,
          creditScoreProof,
          undefined,
          ctx.signers.scoredMinter,
        ),
      ).to.be.reverted;

      await arc.open(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        ctx.signers.scoredMinter,
      );

      const { borrowedAmount, collateralAmount } = await arc
        .synth()
        .core.getVault(minterAddress);
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT);
    });

    it('open if a score for address exists on-chain', async () => {
      await ctx.contracts.sapphire.creditScore.verifyAndUpdate(creditScoreProof);
      await arc.open(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        ctx.signers.scoredMinter,
      );

      const { borrowedAmount, collateralAmount } = await arc.core().getVault(minterAddress);
      expect(collateralAmount.value).eq(COLLATERAL_AMOUNT);
      expect(borrowedAmount.value).eq(BORROW_AMOUNT);
    });

    it('revert if opened below the minimum position amount', async () => {
      await arc.core().setLimits(0, BORROW_AMOUNT.add(1), 0);
      await expect(
        arc.open(COLLATERAL_AMOUNT, BORROW_AMOUNT, creditScoreProof, undefined, ctx.signers.scoredMinter),
      ).to.be.reverted;
    });

    it('revert if opened above the maximum borrowed amount', async () => {
      await arc.core().setLimits(0, 0, BORROW_AMOUNT.sub(1));
      await expect(
        arc.open(COLLATERAL_AMOUNT, BORROW_AMOUNT, creditScoreProof, undefined, ctx.signers.scoredMinter),
      ).to.be.reverted;
    });

    it('revert if opened above the total maximum borrowed amount', async () => {
      await arc.core().setLimits(BORROW_AMOUNT.sub(1), 0, 0);
      await expect(
        arc.open(COLLATERAL_AMOUNT, BORROW_AMOUNT, creditScoreProof, undefined, ctx.signers.scoredMinter),
      ).to.be.reverted;
    });
  });
});
