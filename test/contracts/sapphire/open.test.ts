import { SapphireTestArc } from '@src/SapphireTestArc';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import chai, { expect } from 'chai';
import { BigNumber, constants, utils } from 'ethers';
import { solidity } from 'ethereum-waffle';
import 'module-alias/register';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';
import {
  DEFAULT_COLLATERAL_DECIMALS,
  DEFAULT_PRICE,
  DEFAULT_PROOF_PROTOCOL,
} from '@test/helpers/sapphireDefaults';
import { mintApprovedCollateral } from '@test/helpers/setupBaseVault';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BASE } from '@src/constants';
import { getScoreProof } from '@src/utils/getScoreProof';
import { PassportScore, PassportScoreProof } from '@arc-types/sapphireCore';
import { PassportScoreTree } from '@src/MerkleTree';

chai.use(solidity);

/**
 * When calling open(), it's calling executeActions underneath the hood with borrow and deposit actions.
 * Because borrow is called first time it creates a position for sender, which is connected directly with his address.
 * The two scenarios to test here are for with a valid score proof and one without a valid score proof.
 * You only need a score proof if your address has a store proof in the CreditScore contract.
 */
describe('SapphireCore.open()', () => {
  const COLLATERAL_AMOUNT = utils.parseUnits(
    '100',
    DEFAULT_COLLATERAL_DECIMALS,
  );
  const BORROW_AMOUNT = utils.parseEther('50').mul(DEFAULT_PRICE).div(BASE);

  let ctx: ITestContext;
  let arc: SapphireTestArc;
  let creditScore1: PassportScore;
  let creditScore2: PassportScore;
  let creditScoreTree: PassportScoreTree;

  async function init(ctx: ITestContext): Promise<void> {
    creditScore1 = {
      account: ctx.signers.scoredMinter.address,
      protocol: DEFAULT_PROOF_PROTOCOL,
      score: BigNumber.from(500),
    };
    creditScore2 = {
      account: ctx.signers.interestSetter.address,
      protocol: DEFAULT_PROOF_PROTOCOL,
      score: BigNumber.from(20),
    };
    creditScoreTree = new PassportScoreTree([creditScore1, creditScore2]);
    await setupSapphire(ctx, {
      merkleRoot: creditScoreTree.getHexRoot(),
    });

    await mintApprovedCollateral(
      ctx.sdks.sapphire,
      ctx.signers.minter,
      COLLATERAL_AMOUNT.mul(2),
    );
    await mintApprovedCollateral(
      ctx.sdks.sapphire,
      ctx.signers.scoredMinter,
      COLLATERAL_AMOUNT.mul(2),
    );
  }

  before(async () => {
    ctx = await generateContext(sapphireFixture, init);
    arc = ctx.sdks.sapphire;
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('without score proof', () => {
    it('open at the exact c-ratio', async () => {
      const vault = await arc.open(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        undefined,
        undefined,
        ctx.signers.minter,
      );

      // Ensure the function returned correct information
      expect(vault.borrowedAmount).eq(BORROW_AMOUNT);
      expect(vault.collateralAmount).eq(COLLATERAL_AMOUNT);

      // Check total collateral and borrowed values
      expect(await arc.core().totalCollateral()).eq(COLLATERAL_AMOUNT);
      expect(await arc.core().totalBorrowed()).eq(BORROW_AMOUNT);

      expect(await arc.synth().collateral.balanceOf(arc.coreAddress())).eq(
        COLLATERAL_AMOUNT,
      );
    });

    it('open above the c-ratio', async () => {
      const { borrowedAmount, collateralAmount } = await arc.open(
        COLLATERAL_AMOUNT.mul(2),
        BORROW_AMOUNT,
        undefined,
        undefined,
        ctx.signers.minter,
      );

      expect(collateralAmount).eq(COLLATERAL_AMOUNT.mul(2));
      expect(borrowedAmount).eq(BORROW_AMOUNT);
    });

    it('revert if opened below the c-ratio', async () => {
      const change = utils.parseUnits('1', DEFAULT_COLLATERAL_DECIMALS);
      await expect(
        arc.open(
          COLLATERAL_AMOUNT,
          BORROW_AMOUNT.add(change),
          undefined,
          undefined,
          ctx.signers.minter,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: the vault will become undercollateralized',
      );

      await expect(
        arc.open(
          COLLATERAL_AMOUNT.sub(change),
          BORROW_AMOUNT,
          undefined,
          undefined,
          ctx.signers.minter,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: the vault will become undercollateralized',
      );
    });

    it('revert if proof is not provided', async () => {
      await arc.open(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        getScoreProof(creditScore1, creditScoreTree),
        undefined,
        ctx.signers.scoredMinter,
      );
      await expect(
        arc.open(
          COLLATERAL_AMOUNT,
          BORROW_AMOUNT,
          undefined,
          undefined,
          ctx.signers.scoredMinter,
        ),
      ).to.be.revertedWith(
        'SapphireAssessor: proof should be provided for credit score',
      );
    });

    it('revert if opened below the minimum position amount', async () => {
      await arc
        .core()
        .setLimits(
          BORROW_AMOUNT.add(100),
          BORROW_AMOUNT.add(10),
          BORROW_AMOUNT.add(100),
        );

      await expect(
        arc.open(
          COLLATERAL_AMOUNT,
          BORROW_AMOUNT,
          undefined,
          undefined,
          ctx.signers.minter,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: borrowed amount cannot be less than limit',
      );
    });

    it('revert if opened above the maximum borrowed amount', async () => {
      await arc
        .core()
        .setLimits(BORROW_AMOUNT, BORROW_AMOUNT.sub(100), BORROW_AMOUNT.sub(1));
      await expect(
        arc.open(
          COLLATERAL_AMOUNT,
          BORROW_AMOUNT,
          undefined,
          undefined,
          ctx.signers.minter,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: borrowed amount cannot be greater than vault limit',
      );
    });
  });

  describe('with score proof', () => {
    let creditScoreProof: PassportScoreProof;
    let scoredMinter: SignerWithAddress;
    before(() => {
      creditScoreProof = getScoreProof(creditScore1, creditScoreTree);
      scoredMinter = ctx.signers.scoredMinter;
    });

    it('open at the exact default c-ratio', async () => {
      const { borrowedAmount, collateralAmount } = await arc.open(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        scoredMinter,
      );

      // Check created vault
      expect(borrowedAmount).eq(BORROW_AMOUNT);
      expect(collateralAmount).eq(COLLATERAL_AMOUNT);

      // Check total collateral and borrowed values
      expect(await arc.core().totalCollateral()).eq(COLLATERAL_AMOUNT);
      expect(await arc.core().totalBorrowed()).eq(BORROW_AMOUNT);

      expect(await arc.synth().collateral.balanceOf(arc.coreAddress())).eq(
        COLLATERAL_AMOUNT,
      );
    });

    it('open above the default c-ratio', async () => {
      await arc.open(
        COLLATERAL_AMOUNT.mul(2),
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        scoredMinter,
      );

      const { borrowedAmount, collateralAmount } = await arc.getVault(
        scoredMinter.address,
      );
      expect(collateralAmount).eq(COLLATERAL_AMOUNT.mul(2));
      expect(borrowedAmount).eq(BORROW_AMOUNT);
    });

    it('open below the default c-ratio, but above c-ratio based on credit score', async () => {
      await arc.open(
        COLLATERAL_AMOUNT.sub(1),
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        scoredMinter,
      );

      const { borrowedAmount, collateralAmount } = await arc.getVault(
        scoredMinter.address,
      );
      expect(collateralAmount).eq(COLLATERAL_AMOUNT.sub(1));
      expect(borrowedAmount).eq(BORROW_AMOUNT);
    });

    it('open at the c-ratio based on credit score', async () => {
      //  defaultBorrow * 2 = defaultCollateral
      // 2 => 3/2
      // maxBorrow = defaultCollateral / (3/2)
      // maxBorrow = 2 * 2 * defaultBorrow / 3
      // maxBorrow = 4/3 * defaultBorrow
      const MAX_BORROW_AMOUNT = BORROW_AMOUNT.mul(4).div(3);

      await arc.open(
        COLLATERAL_AMOUNT,
        MAX_BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        scoredMinter,
      );

      const { borrowedAmount, collateralAmount } = await arc.getVault(
        scoredMinter.address,
      );
      expect(collateralAmount).eq(COLLATERAL_AMOUNT);
      expect(borrowedAmount).eq(MAX_BORROW_AMOUNT);
    });

    it('revert if opened below c-ratio based on credit score', async () => {
      await expect(
        arc.open(
          constants.One,
          BORROW_AMOUNT,
          creditScoreProof,
          undefined,
          scoredMinter,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: the vault will become undercollateralized',
      );
    });

    it('open if a score for address exists on-chain', async () => {
      await ctx.contracts.sapphire.passportScores.verifyAndUpdate(
        creditScoreProof,
      );
      await arc.open(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        creditScoreProof,
        undefined,
        scoredMinter,
      );

      const { borrowedAmount, collateralAmount } = await arc.getVault(
        scoredMinter.address,
      );
      expect(collateralAmount).eq(COLLATERAL_AMOUNT);
      expect(borrowedAmount).eq(BORROW_AMOUNT);
    });

    it('revert if opened below the minimum position amount', async () => {
      await arc
        .core()
        .setLimits(
          BORROW_AMOUNT.add(100),
          BORROW_AMOUNT.add(10),
          BORROW_AMOUNT.add(100),
        );
      await expect(
        arc.open(
          COLLATERAL_AMOUNT,
          BORROW_AMOUNT,
          creditScoreProof,
          undefined,
          scoredMinter,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: borrowed amount cannot be less than limit',
      );
    });

    it('revert if opened above the maximum borrowed amount', async () => {
      await arc
        .core()
        .setLimits(BORROW_AMOUNT, BORROW_AMOUNT.sub(100), BORROW_AMOUNT.sub(1));
      await expect(
        arc.open(
          COLLATERAL_AMOUNT,
          BORROW_AMOUNT,
          creditScoreProof,
          undefined,
          scoredMinter,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: borrowed amount cannot be greater than vault limit',
      );
    });

    it('revert if opened above the total maximum borrowed amount', async () => {
      await arc.core().setLimits(BORROW_AMOUNT, 0, BORROW_AMOUNT);

      // random user borrows some amount
      await mintApprovedCollateral(
        arc,
        ctx.signers.interestSetter,
        COLLATERAL_AMOUNT,
      );
      await arc.open(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT.div(2),
        getScoreProof(creditScore2, creditScoreTree),
        undefined,
        ctx.signers.interestSetter,
      );

      // other user borrows more than the total limit
      await expect(
        arc.open(
          COLLATERAL_AMOUNT,
          BORROW_AMOUNT.div(2).add(1),
          creditScoreProof,
          undefined,
          scoredMinter,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: borrowed amount cannot be greater than limit',
      );
    });
  });
});
