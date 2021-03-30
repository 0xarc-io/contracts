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

  it(`borrows from someone else's vault if called by the global operator`);

  it(`borrows from someone else's vault if called by an approved position operator`);

  it('updates the total borrowed amount correctly');

  it(`should not borrow if the price from the oracle is 0`);

  it(`should not borrow from someone else's vault if called by a position operator, but on an unapproved vault`, async () => {
    // 1. User A opens vault X
    // 2. Position operator P is approved on vault Y
    // 3. P tries to borrow on X -> expect revert
  });

  it('should not borrow with a score proof if no assesor is set', async () => {
    // You can't borrow with a credit score if no assesor is set in the Core
  });

  it('should not borrow without a credit proof if a score exists on-chain', async () => {
    // You cannot borrow without a credit proof if one exists on-chain
  });

  it('should not borrow more if the c-ratio is at the minimum', async () => {});

  it("should not borrow from someone else's account", async () => {});

  it('should not borrow without enough collateral', async () => {});

  it('should not borrow more if the price decreases', async () => {});

  it('should not borrow more if more interest has accrued', async () => {});

  it('should not borrow more than the collateral limit', async () => {});

  it('should not borrow more than the maximum amount', async () => {
    // 1. Borrow half of allowed amount
    // 2. Borrow another half + 1 -> expect revert
  });

  it('should not borrow from an inexistent vault');

  it('should not borrow more than the liquidity of the borrow asset');

  it('should not borrow if contract is paused');

  it('should not borrow if oracle is not set');
});
