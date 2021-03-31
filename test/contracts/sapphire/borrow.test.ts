import { BigNumber, constants, utils } from 'ethers';
import { CreditScore, CreditScoreProof } from '@arc-types/sapphireCore';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import { SapphireTestArc } from '@src/SapphireTestArc';
import {
  addSnapshotBeforeRestoreAfterEach,
  immediatelyUpdateMerkleRoot,
} from '@test/helpers/testingUtils';
import 'module-alias/register';
import { ITestContext, generateContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';
import { BaseERC20Factory } from '@src/typings';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { expect, util } from 'chai';
import { ONE_YEAR_IN_SECONDS } from '@src/constants';

/**
 * This is the most crucial function of the system as it's how users actually borrow from a vault.
 * When borrowing, we won't let a user borrow without a credit proof if they're already being tracked
 * in the system. This means that if people can't obtain a credit proof then they can't borrow. The same
 * cannot be said for liquidate and repay since the credit proof is optional. When testing the borrow
 * function we need to make sure that every case of with a credit proof, without a credit proof, price changes
 * is tested.
 */

describe('SapphireCore.borrow()', () => {
  const COLLATERAL_AMOUNT = utils.parseEther('100');
  const BORROW_AMOUNT = utils.parseEther('50');

  let ctx: ITestContext;
  let arc: SapphireTestArc;
  let creditScore1: CreditScore;
  let creditScore2: CreditScore;
  let creditScoreTree: CreditScoreTree;
  let scoredMinter: SignerWithAddress;
  let creditScoreProof: CreditScoreProof;

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
      collateralRatio: constants.WeiPerEther.mul(2),
      merkleRoot: creditScoreTree.getHexRoot(),
    });
    await arc.deposit(
      ctx.signers.scoredMinter.address,
      COLLATERAL_AMOUNT,
      undefined,
      undefined,
      ctx.signers.scoredMinter,
    );
  }

  before(async () => {
    ctx = await generateContext(sapphireFixture, init);
    arc = ctx.sdks.sapphire;
    scoredMinter = ctx.signers.scoredMinter;
    creditScoreProof = {
      account: creditScore1.account,
      score: creditScore1.amount,
      merkleProof: creditScoreTree.getProof(creditScore1.account, creditScore1.amount),
    };
  });

  addSnapshotBeforeRestoreAfterEach();

  it('borrows the correct amount for collateral tokens that have other than 18 decimal places', async () => {
    const collateralAddress = await arc.core().collateralAsset();
    const collateralContract = BaseERC20Factory.connect(collateralAddress, ctx.signers.minter);
    const collateralDecimals = await collateralContract.decimals();

    expect(collateralDecimals).not.eq(18);

    await arc.borrow(
      scoredMinter.address,
      BORROW_AMOUNT,
      creditScoreProof,
      undefined,
      scoredMinter,
    );
    const { collateralAmount, borrowedAmount } = await arc.getVault(scoredMinter.address);
    expect(collateralAmount).eq(COLLATERAL_AMOUNT);
    expect(borrowedAmount).eq(BORROW_AMOUNT);
  });

  it('borrows with exact c-ratio', async () => {
    await arc.borrow(scoredMinter.address, BORROW_AMOUNT, undefined, undefined, scoredMinter);
    const { borrowedAmount } = await arc.getVault(scoredMinter.address);
    expect(borrowedAmount).eq(BORROW_AMOUNT);
  });

  it('borrows more if more collateral is provided', async () => {
    await arc.borrow(scoredMinter.address, BORROW_AMOUNT, undefined, undefined, scoredMinter);
    const { borrowedAmount } = await arc.getVault(scoredMinter.address);

    expect(borrowedAmount).eq(BORROW_AMOUNT);
    await expect(
      arc.borrow(scoredMinter.address, BORROW_AMOUNT, undefined, undefined, scoredMinter),
    ).to.be.reverted;

    await arc.deposit(
      ctx.signers.scoredMinter.address,
      COLLATERAL_AMOUNT,
      undefined,
      undefined,
      ctx.signers.scoredMinter,
    );
    await arc.borrow(scoredMinter.address, BORROW_AMOUNT, undefined, undefined, scoredMinter);
    const { borrowedAmount: updatedBorrowedAmount } = await arc.getVault(scoredMinter.address);

    expect(updatedBorrowedAmount).eq(BORROW_AMOUNT.mul(2));
  });

  it('borrows more if a valid score proof is provided', async () => {
    // With the credit score user can borrow more than amount based default collateral ratio
    const expectedBorrowAmount = BORROW_AMOUNT.add(BORROW_AMOUNT.div(2).mul(3));
    const { borrowedAmount } = await arc.borrow(
      scoredMinter.address,
      expectedBorrowAmount,
      creditScoreProof,
      undefined,
      scoredMinter,
    );
    expect(borrowedAmount).eq(expectedBorrowAmount);

    const { borrowedAmount: vaultBorrowAmount } = await arc.getVault(scoredMinter.address);
    expect(vaultBorrowAmount).eq(expectedBorrowAmount);
  });

  it('borrows more if the credit score increases', async () => {
    // The user's existing credit score is updated and increases letting them borrow more
    const expectedBorrowAmount = BORROW_AMOUNT.add(BORROW_AMOUNT.div(2).mul(3));
    await arc.borrow(
      scoredMinter.address,
      expectedBorrowAmount,
      creditScoreProof,
      undefined,
      scoredMinter,
    );

    await expect(
      arc.borrow(scoredMinter.address, constants.One, creditScoreProof, undefined, scoredMinter),
      'User should not be able to borrow more',
    ).to.be.reverted;

    // Prepare the new root hash with the increased credit score for minter
    const creditScore = {
      account: scoredMinter.address,
      amount: BigNumber.from(800),
    };
    creditScoreTree = new CreditScoreTree([creditScore, creditScore2]);
    await immediatelyUpdateMerkleRoot(
      ctx.contracts.sapphire.creditScore,
      creditScoreTree.getHexRoot(),
    );

    await arc.borrow(
      scoredMinter.address,
      constants.One,
      {
        account: creditScore.account,
        score: creditScore.amount,
        merkleProof: creditScoreTree.getProof(creditScore.account, creditScore.amount),
      },
      undefined,
      scoredMinter,
    );

    const { borrowedAmount: vaultBorrowAmount } = await arc.getVault(scoredMinter.address);
    expect(vaultBorrowAmount).eq(expectedBorrowAmount.add(1));
  });

  it('borrows less if the credit score decreases', async () => {
    // The user's existing credit score is updated and decreases letting them borrow less

    // Prepare the new root hash with the decreased credit score for minter
    const creditScore = {
      account: scoredMinter.address,
      amount: BigNumber.from(100),
    };
    creditScoreTree = new CreditScoreTree([creditScore, creditScore2]);
    await immediatelyUpdateMerkleRoot(
      ctx.contracts.sapphire.creditScore,
      creditScoreTree.getHexRoot(),
    );

    // Shouldn't be able to borrow the same as with credit score equals 500
    const expectedBorrowAmount = BORROW_AMOUNT.add(BORROW_AMOUNT.div(2).mul(3));
    await expect(
      arc.borrow(
        scoredMinter.address,
        expectedBorrowAmount,
        creditScoreProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.reverted;
  });

  it('updates the total borrowed amount correctly', async () => {
    const borrowedAmount1 = BORROW_AMOUNT.add(BORROW_AMOUNT.div(2).mul(3));
    const { borrowedAmount } = await arc.borrow(
      scoredMinter.address,
      borrowedAmount1,
      creditScoreProof,
      undefined,
      scoredMinter,
    );
    expect(borrowedAmount).eq(borrowedAmount1);
    expect(await ctx.contracts.sapphire.core.totalBorrowed()).eq(borrowedAmount1);

    await arc.deposit(
      ctx.signers.minter.address,
      COLLATERAL_AMOUNT,
      undefined,
      undefined,
      ctx.signers.minter,
    );

    await arc.borrow(
      ctx.signers.minter.address,
      BORROW_AMOUNT,
      undefined,
      undefined,
      ctx.signers.minter,
    );
    expect(await ctx.contracts.sapphire.core.totalBorrowed()).eq(
      borrowedAmount1.add(BORROW_AMOUNT),
    );
  });

  it(`should not borrow if the price from the oracle is 0`, async () => {
    await ctx.contracts.oracle.setPrice({ value: 0 });
    await expect(
      arc.borrow(scoredMinter.address, BORROW_AMOUNT, creditScoreProof, undefined, scoredMinter),
    ).to.be.reverted;
  });

  it('should not borrow with a score proof if no assessor is set', async () => {
    // You can't borrow with a credit score if no assesor is set in the Core
    await arc.core().setAssessor(constants.AddressZero);
    await expect(
      arc.borrow(scoredMinter.address, BORROW_AMOUNT, creditScoreProof, undefined, scoredMinter),
    ).to.be.reverted;
  });

  it('should not borrow without a credit proof if a score exists on-chain', async () => {
    await arc.borrow(
      scoredMinter.address,
      constants.One,
      creditScoreProof,
      undefined,
      scoredMinter,
    );
    await expect(
      arc.borrow(scoredMinter.address, constants.One, undefined, undefined, scoredMinter),
    ).to.be.reverted;
  });

  it('should not borrow more if the c-ratio is at the minimum', async () => {
    await arc.borrow(scoredMinter.address, BORROW_AMOUNT, undefined, undefined, scoredMinter);
    const { borrowedAmount } = await arc.getVault(scoredMinter.address);
    expect(borrowedAmount).eq(BORROW_AMOUNT);
    await expect(
      arc.borrow(scoredMinter.address, BORROW_AMOUNT, undefined, undefined, scoredMinter),
    ).to.be.reverted;
  });

  it("should not borrow from someone else's account", async () => {
    await expect(
      arc.borrow(ctx.signers.minter.address, BORROW_AMOUNT, undefined, undefined, scoredMinter),
    ).to.be.reverted;
  });

  it('should not borrow more if the price decreases', async () => {
    await arc.borrow(
      scoredMinter.address,
      BORROW_AMOUNT.div(2),
      creditScoreProof,
      undefined,
      scoredMinter,
    );
    await ctx.contracts.oracle.setPrice({ value: utils.parseEther('0.1') });
    await expect(
      arc.borrow(
        scoredMinter.address,
        BORROW_AMOUNT.div(2),
        creditScoreProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.reverted;
  });

  it('should not borrow more if more interest has accrued', async () => {
    const secondBorrowAmount = BigNumber.from(10);
    const firstBorrowAmount = BORROW_AMOUNT.sub(secondBorrowAmount);

    await arc.borrow(scoredMinter.address, firstBorrowAmount, undefined, undefined, scoredMinter);
    const { borrowedAmount } = await arc.getVault(scoredMinter.address);
    expect(borrowedAmount).eq(firstBorrowAmount);

    const currentTimeStamp = await arc.core().currentTimestamp();
    await arc.core().setInterestRate(constants.WeiPerEther);
    await arc.core().setCurrentTimestamp(currentTimeStamp.add(ONE_YEAR_IN_SECONDS));

    await expect(
      arc.borrow(scoredMinter.address, BORROW_AMOUNT, undefined, undefined, scoredMinter),
    ).to.be.reverted;
  });

  it('should not borrow less than the minimum borrow limit', async () => {
    await arc.core().setLimits(BORROW_AMOUNT, 0, 0);
    await expect(
      arc.borrow(
        scoredMinter.address,
        BORROW_AMOUNT.sub(1),
        creditScoreProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.reverted;
  });

  it('should not borrow more than the maximum amount', async () => {
    await arc.core().setLimits(0, BORROW_AMOUNT, 0);
    await arc.borrow(
      scoredMinter.address,
      BORROW_AMOUNT.div(2),
      creditScoreProof,
      undefined,
      scoredMinter,
    );
    await expect(
      arc.borrow(
        scoredMinter.address,
        BORROW_AMOUNT.div(2).add(1),
        creditScoreProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.reverted;
  });

  it('should not borrow if contract is paused', async () => {
    await arc.core().setPause(true);
    await expect(
      arc.borrow(scoredMinter.address, BORROW_AMOUNT, creditScoreProof, undefined, scoredMinter),
    ).to.be.reverted;
  });

  it('should not borrow if oracle is not set', async () => {
    await arc.core().setOracle(constants.AddressZero);
    await expect(
      arc.borrow(scoredMinter.address, BORROW_AMOUNT, creditScoreProof, undefined, scoredMinter),
    ).to.be.reverted;
  });
});
