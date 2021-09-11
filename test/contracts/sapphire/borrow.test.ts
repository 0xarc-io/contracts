import { BigNumber, utils } from 'ethers';
import { SapphireTestArc } from '@src/SapphireTestArc';
import {
  addSnapshotBeforeRestoreAfterEach,
  immediatelyUpdateMerkleRoot,
} from '@test/helpers/testingUtils';
import 'module-alias/register';
import { ITestContext, generateContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';
import { BaseERC20Factory, TestTokenFactory } from '@src/typings';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { expect } from 'chai';
import { ONE_YEAR_IN_SECONDS } from '@src/constants';
import {
  DEFAULT_COLLATERAL_DECIMALS,
  DEFAULT_HiGH_C_RATIO,
  DEFAULT_LOW_C_RATIO,
  DEFAULT_PRICE,
} from '@test/helpers/sapphireDefaults';
import { getScoreProof } from '@src/utils/getScoreProof';
import { roundUpDiv, roundUpMul } from '@test/helpers/roundUpOperations';
import { PassportScore, PassportScoreProof } from '@arc-types/sapphireCore';
import { PassportScoreTree } from '@src/MerkleTree';

/**
 * This is the most crucial function of the system as it's how users actually borrow from a vault.
 * When borrowing, we won't let a user borrow without a credit proof if they're already being tracked
 * in the system. This means that if people can't obtain a credit proof then they can't borrow. The same
 * cannot be said for liquidate and repay since the credit proof is optional. When testing the borrow
 * function we need to make sure that every case of with a credit proof, without a credit proof, price changes
 * is tested.
 */

const NORMALIZED_COLLATERAL_AMOUNT = utils.parseEther('100');
const COLLATERAL_AMOUNT = utils.parseUnits('100', DEFAULT_COLLATERAL_DECIMALS);
const BORROW_AMOUNT = NORMALIZED_COLLATERAL_AMOUNT.mul(DEFAULT_PRICE).div(
  DEFAULT_HiGH_C_RATIO,
);
// for credit score equals 500 what is the a half of max credit score
const MAX_BORROW_AMOUNT = NORMALIZED_COLLATERAL_AMOUNT.mul(DEFAULT_PRICE).div(
  DEFAULT_LOW_C_RATIO.add(DEFAULT_HiGH_C_RATIO).div(2),
);

describe('SapphireCore.borrow()', () => {
  let ctx: ITestContext;
  let arc: SapphireTestArc;
  let creditScore1: PassportScore;
  let creditScore2: PassportScore;
  let creditScoreTree: PassportScoreTree;
  let scoredMinter: SignerWithAddress;
  let minter: SignerWithAddress;
  let creditScoreProof: PassportScoreProof;

  /**
   * Mints `amount` of collateral tokens to the `caller` and approves it on the core
   */
  async function mintAndApproveCollateral(
    caller: SignerWithAddress,
    amount = COLLATERAL_AMOUNT,
  ) {
    const collateral = TestTokenFactory.connect(
      arc.collateral().address,
      minter,
    );

    await collateral.mintShare(caller.address, amount);
    await collateral.approveOnBehalf(caller.address, arc.coreAddress(), amount);
  }

  async function init(ctx: ITestContext): Promise<void> {
    creditScore1 = {
      account: ctx.signers.scoredMinter.address,
      protocol: 'arcx.creditscore',
      score: BigNumber.from(500),
    };
    creditScore2 = {
      account: ctx.signers.interestSetter.address,
      protocol: 'arcx.creditscore',
      score: BigNumber.from(1000),
    };
    creditScoreTree = new PassportScoreTree([creditScore1, creditScore2]);
    creditScoreProof = getScoreProof(creditScore1, creditScoreTree);
    return setupSapphire(ctx, {
      merkleRoot: creditScoreTree.getHexRoot(),
    });
  }

  /**
   * Returns the converted principal, as calculated by the smart contract:
   * `principal * BASE / borrowIndex`
   * @param principal principal amount to convert
   */
  async function convertPrincipal(principal: BigNumber) {
    const borrowIndex = await arc.core().borrowIndex();
    return roundUpDiv(principal, borrowIndex);
  }

  /**
   * Returns `amount * borrowIndex`, as calculated by the contract
   */
  async function denormalizeBorrowAmount(amount: BigNumber) {
    const borrowIndex = await arc.core().borrowIndex();
    return roundUpMul(amount, borrowIndex);
  }

  before(async () => {
    ctx = await generateContext(sapphireFixture, init);
    arc = ctx.sdks.sapphire;
    scoredMinter = ctx.signers.scoredMinter;
    minter = ctx.signers.minter;

    // mint and approve token
    await mintAndApproveCollateral(minter, COLLATERAL_AMOUNT.mul(2));
    await mintAndApproveCollateral(scoredMinter, COLLATERAL_AMOUNT);

    await arc.deposit(
      COLLATERAL_AMOUNT,
      creditScoreProof,
      undefined,
      scoredMinter,
    );
    await arc.deposit(COLLATERAL_AMOUNT, undefined, undefined, minter);
  });

  addSnapshotBeforeRestoreAfterEach();

  it('borrows the correct amount for collateral tokens that have other than 18 decimal places', async () => {
    const collateralAddress = await arc.core().collateralAsset();
    const collateralContract = BaseERC20Factory.connect(
      collateralAddress,
      ctx.signers.minter,
    );
    const collateralDecimals = await collateralContract.decimals();

    expect(collateralDecimals).not.eq(18);

    await arc.borrow(
      MAX_BORROW_AMOUNT,
      creditScoreProof,
      undefined,
      scoredMinter,
    );

    const { collateralAmount, borrowedAmount } = await arc.getVault(
      scoredMinter.address,
    );

    expect(collateralAmount, 'collateral amt').eq(COLLATERAL_AMOUNT);
    expect(borrowedAmount, 'borrow amt').eq(MAX_BORROW_AMOUNT);
  });

  it('borrows with the highest c-ratio if proof is not provided', async () => {
    let vault = await arc.getVault(scoredMinter.address);
    expect(vault.borrowedAmount).to.eq(0);

    await arc.borrow(BORROW_AMOUNT, undefined, undefined, scoredMinter);

    vault = await arc.getVault(scoredMinter.address);
    expect(vault.borrowedAmount).to.eq(BORROW_AMOUNT);

    await expect(
      arc.borrow(BigNumber.from(1), undefined, undefined, scoredMinter),
    ).to.be.revertedWith(
      'SapphireCoreV1: the vault will become undercollateralized',
    );
  });

  it('borrows with exact c-ratio', async () => {
    await arc.borrow(BORROW_AMOUNT, undefined, undefined, minter);
    const { borrowedAmount } = await arc.getVault(minter.address);
    expect(borrowedAmount).eq(BORROW_AMOUNT);
  });

  it('reverts if borrower cross the c-ratio', async () => {
    const { borrowedAmount, collateralAmount } = await arc.getVault(
      minter.address,
    );

    expect(borrowedAmount).eq(0);
    expect(collateralAmount).eq(COLLATERAL_AMOUNT);

    await expect(
      arc.borrow(BORROW_AMOUNT.mul(10), undefined, undefined, minter),
    ).to.be.revertedWith(
      'SapphireCoreV1: the vault will become undercollateralized',
    );
  });

  it('borrows more if more collateral is provided', async () => {
    await arc.borrow(BORROW_AMOUNT, undefined, undefined, minter);
    const { borrowedAmount } = await arc.getVault(minter.address);

    expect(borrowedAmount).eq(BORROW_AMOUNT);
    await expect(arc.borrow(BORROW_AMOUNT, undefined, undefined, minter)).to.be
      .reverted;

    await mintAndApproveCollateral(minter);

    await arc.deposit(COLLATERAL_AMOUNT, undefined, undefined, minter);
    /**
     * -1 because of rounding.
     * The contract will calculate the c-ratio to 199.99..% otherwise and the tx will
     * be reverted
     */
    await arc.borrow(BORROW_AMOUNT, undefined, undefined, minter);
    const { borrowedAmount: updatedBorrowedAmount } = await arc.getVault(
      minter.address,
    );

    expect(updatedBorrowedAmount).eq(BORROW_AMOUNT.mul(2));
  });

  it('borrows more if a valid score proof is provided', async () => {
    // With the credit score user can borrow more than amount based default collateral ratio
    await arc.borrow(
      MAX_BORROW_AMOUNT,
      creditScoreProof,
      undefined,
      scoredMinter,
    );

    const { borrowedAmount } = await arc.getVault(scoredMinter.address);

    expect(borrowedAmount).eq(MAX_BORROW_AMOUNT);
  });

  it('borrows more if the credit score increases', async () => {
    // The user's existing credit score is updated and increases letting them borrow more
    await arc.borrow(
      MAX_BORROW_AMOUNT,
      creditScoreProof,
      undefined,
      scoredMinter,
    );

    const additionalBorrowAmount = utils.parseEther('0.01');

    // Borrowing BASE rather than BigNumber.from(1), because that number is too small adn won't cause a reversal
    // due to rounding margins
    await expect(
      arc.borrow(
        additionalBorrowAmount,
        creditScoreProof,
        undefined,
        scoredMinter,
      ),
      'User should not be able to borrow more',
    ).to.be.revertedWith(
      'SapphireCoreV1: the vault will become undercollateralized',
    );

    // Prepare the new root hash with the increased credit score for minter
    const creditScore = {
      account: scoredMinter.address,
      protocol: 'arcx.creditscore',
      score: BigNumber.from(800),
    };
    const newPassportScoreTree = new PassportScoreTree([
      creditScore,
      creditScore2,
    ]);

    await immediatelyUpdateMerkleRoot(
      ctx.contracts.sapphire.passportScores.connect(ctx.signers.interestSetter),
      newPassportScoreTree.getHexRoot(),
    );

    await arc.borrow(
      additionalBorrowAmount,
      getScoreProof(creditScore, newPassportScoreTree),
      undefined,
      scoredMinter,
    );

    const { borrowedAmount: vaultBorrowAmount } = await arc.getVault(
      scoredMinter.address,
    );
    const expectedVaultBorrowAmt = await convertPrincipal(
      (await denormalizeBorrowAmount(MAX_BORROW_AMOUNT)).add(
        additionalBorrowAmount,
      ),
    );
    expect(vaultBorrowAmount).eq(expectedVaultBorrowAmt);
  });

  it('borrows less if the credit score decreases', async () => {
    // The user's existing credit score is updated and decreases letting them borrow less

    // Prepare the new root hash with the decreased credit score for minter
    const creditScore = {
      account: scoredMinter.address,
      protocol: 'arcx.creditscore',
      score: BigNumber.from(100),
    };
    const newPassportScoreTree = new PassportScoreTree([
      creditScore,
      creditScore2,
    ]);
    await immediatelyUpdateMerkleRoot(
      ctx.contracts.sapphire.passportScores.connect(ctx.signers.interestSetter),
      newPassportScoreTree.getHexRoot(),
    );

    // Shouldn't be able to borrow the same as with credit score equals 500
    await expect(
      arc.borrow(
        MAX_BORROW_AMOUNT,
        getScoreProof(creditScore, newPassportScoreTree),
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith(
      'SapphireCoreV1: the vault will become undercollateralized',
    );
  });

  it('updates the total borrowed amount correctly', async () => {
    await arc.borrow(
      MAX_BORROW_AMOUNT,
      creditScoreProof,
      undefined,
      scoredMinter,
    );

    const { borrowedAmount } = await arc.getVault(scoredMinter.address);

    expect(borrowedAmount).eq(MAX_BORROW_AMOUNT);
    expect(await ctx.contracts.sapphire.core.totalBorrowed()).eq(
      MAX_BORROW_AMOUNT,
    );

    await arc.deposit(
      COLLATERAL_AMOUNT,
      undefined,
      undefined,
      ctx.signers.minter,
    );

    await arc.borrow(BORROW_AMOUNT, undefined, undefined, ctx.signers.minter);
    expect(await ctx.contracts.sapphire.core.totalBorrowed()).eq(
      MAX_BORROW_AMOUNT.add(BORROW_AMOUNT),
    );
  });

  it(`should not borrow if the price from the oracle is 0`, async () => {
    await ctx.contracts.sapphire.oracle.setPrice(0);
    await expect(
      arc.borrow(BORROW_AMOUNT, creditScoreProof, undefined, scoredMinter),
    ).to.be.revertedWith('SapphireCoreV1: the oracle returned a price of 0');
  });

  it('should not borrow more if the c-ratio is at the minimum', async () => {
    await arc.borrow(BORROW_AMOUNT, undefined, undefined, minter);
    const { borrowedAmount } = await arc.getVault(minter.address);
    expect(borrowedAmount).eq(BORROW_AMOUNT);
    await expect(
      arc.borrow(utils.parseEther('0.01'), undefined, undefined, minter),
    ).to.be.revertedWith(
      'SapphireCoreV1: the vault will become undercollateralized',
    );
  });

  it('should not borrow more if the price decreases', async () => {
    await arc.borrow(
      MAX_BORROW_AMOUNT.div(2),
      creditScoreProof,
      undefined,
      scoredMinter,
    );
    await arc.borrow(
      MAX_BORROW_AMOUNT.div(4),
      creditScoreProof,
      undefined,
      scoredMinter,
    );
    await arc.updatePrice(utils.parseEther('0.99'));
    await expect(
      arc.borrow(
        MAX_BORROW_AMOUNT.div(4),
        creditScoreProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith(
      'SapphireCoreV1: the vault will become undercollateralized',
    );
  });

  it(`should not borrow if using someone else's score proof`, async () => {
    await arc.borrow(
      MAX_BORROW_AMOUNT,
      creditScoreProof,
      undefined,
      scoredMinter,
    );

    const interestSetterScoreProof = getScoreProof(
      creditScore2,
      creditScoreTree,
    );
    expect(interestSetterScoreProof.score).to.eq(1000);

    await expect(
      arc.borrow(
        utils.parseEther('1'),
        interestSetterScoreProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith('SapphireCoreV1: proof.account must match msg.sender');
  });

  it('should not borrow more if more interest has accrued', async () => {
    const secondBorrowAmount = BigNumber.from(10);
    const firstBorrowAmount = BORROW_AMOUNT.sub(secondBorrowAmount);

    await arc.borrow(
      firstBorrowAmount,
      creditScoreProof,
      undefined,
      scoredMinter,
    );
    const { borrowedAmount } = await arc.getVault(scoredMinter.address);
    expect(borrowedAmount).eq(firstBorrowAmount);

    const currentTimeStamp = await arc.core().currentTimestamp();
    await arc
      .core()
      .connect(ctx.signers.interestSetter)
      .setInterestRate('21820606488');
    await arc.updateTime(currentTimeStamp.add(ONE_YEAR_IN_SECONDS));

    await expect(
      arc.borrow(BORROW_AMOUNT, creditScoreProof, undefined, scoredMinter),
    ).to.be.revertedWith(
      'SapphireCoreV1: the vault will become undercollateralized',
    );
  });

  it('should not borrow less than the minimum borrow limit', async () => {
    const totalBorrowLimit = await arc.core().totalBorrowLimit();
    const vaultBorrowMaximum = await arc.core().vaultBorrowMaximum();
    await arc
      .core()
      .setLimits(totalBorrowLimit, BORROW_AMOUNT, vaultBorrowMaximum);
    await expect(
      arc.borrow(
        BORROW_AMOUNT.sub(10),
        creditScoreProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith(
      'SapphireCoreV1: borrowed amount cannot be less than limit',
    );
  });

  it('should not borrow more than the maximum amount', async () => {
    const totalBorrowLimit = await arc.core().totalBorrowLimit();
    const vaultBorrowMinimum = await arc.core().vaultBorrowMinimum();
    // Only update the vault borrow maximum
    await arc
      .core()
      .setLimits(totalBorrowLimit, vaultBorrowMinimum, BORROW_AMOUNT);

    await arc.borrow(
      BORROW_AMOUNT.div(2),
      creditScoreProof,
      undefined,
      scoredMinter,
    );
    await expect(
      arc.borrow(
        BORROW_AMOUNT.div(2).add(1),
        creditScoreProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith(
      'SapphireCoreV1: borrowed amount cannot be greater than vault limit',
    );
  });

  it('should not borrow if contract is paused', async () => {
    await arc.core().connect(ctx.signers.pauseOperator).setPause(true);
    await expect(
      arc.borrow(BORROW_AMOUNT, creditScoreProof, undefined, scoredMinter),
    ).to.be.revertedWith('SapphireCoreV1: the contract is paused');
  });

  it('should not borrow if the collateral price is stale', async () => {
    const now = BigNumber.from(Date.now());

    // Set the core timestamp to now
    await arc.updateTime(now);

    // Set the oracle timestamp to > half a day
    await arc.setOracleTimestamp(now.sub(60 * 60 * 12 + 1));

    await expect(
      arc.borrow(BORROW_AMOUNT, creditScoreProof, undefined, scoredMinter),
    ).to.be.revertedWith('SapphireCoreV1: the oracle has stale prices');
  });

  it('emits ActionsOperated event when a borrow occurs', async () => {
    await expect(
      arc.borrow(BORROW_AMOUNT, creditScoreProof, undefined, scoredMinter),
    ).to.emit(arc.core(), 'ActionsOperated');
    // .withArgs([[BORROW_AMOUNT, 2]], creditScoreProof, scoredMinter.address);
  });
});
