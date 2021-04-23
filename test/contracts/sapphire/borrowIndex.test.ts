/**
 * This file contains integration tests regarding the calculation of the interest
 * on the borrowed amounts. An accompanying Google Sheet can be found at
 * https://docs.google.com/spreadsheets/d/1rmFbUxnM4gyi1xhcYKBwcdadvXrHBPKbeX7DLk8KQgE
 * at the "Borrow index" tab
 */

import { CreditScore } from '@arc-types/sapphireCore';
import { TestingSigners } from '@arc-types/testing';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { approve } from '@src/utils/approve';
import { BASE, ONE_YEAR_IN_SECONDS } from '@src/constants';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { getScoreProof } from '@src/utils/getScoreProof';
import { DEFAULT_COLLATERAL_DECIMALS } from '@test/helpers/sapphireDefaults';
import { setupBaseVault } from '@test/helpers/setupBaseVault';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber, BigNumberish, utils } from 'ethers';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

const COLLATERAL_AMOUNT = utils.parseUnits('1000', DEFAULT_COLLATERAL_DECIMALS);
const BORROW_AMOUNT = utils.parseEther('500');

const SECONDS_PER_MONTH = BigNumber.from(30 * 24 * 60 * 60);

// Set interest rate for a 5% APY. Calculated using
// https://www.wolframalpha.com/input/?i=31536000th+root+of+1.05
const INTEREST_RATE = BigNumber.from(1547125957);

describe.only('borrowed index (integration)', () => {
  let arc: SapphireTestArc;
  let signers: TestingSigners;
  let minterCreditScore: CreditScore;
  let creditScoreTree: CreditScoreTree;
  let minter1: SignerWithAddress;
  let minter2: SignerWithAddress;

  async function init(ctx: ITestContext): Promise<void> {
    minterCreditScore = {
      account: ctx.signers.scoredMinter.address,
      amount: BigNumber.from(500),
    };
    const creditScore2 = {
      account: ctx.signers.interestSetter.address,
      amount: BigNumber.from(20),
    };
    creditScoreTree = new CreditScoreTree([minterCreditScore, creditScore2]);
    await setupSapphire(ctx, {
      interestRate: INTEREST_RATE,
      merkleRoot: creditScoreTree.getHexRoot(),
    });
  }

  /**
   * Returns the expected borrow index to be if core is about to update
   * its index
   * @param prevBorrowIndex the current borrow index (before updating it)
   */
  async function getBorrowIndex(
    lastUpdateIndex: BigNumber,
    prevBorrowIndex: BigNumber,
    interestRate = INTEREST_RATE,
  ) {
    const currentTimestamp = await arc.core().currentTimestamp();
    const accumulatedInterest = interestRate.mul(
      currentTimestamp.sub(lastUpdateIndex),
    );
    return prevBorrowIndex
      .mul(accumulatedInterest)
      .div(BASE)
      .add(prevBorrowIndex);
  }

  /**
   * Returns the converted principal, as calculated by the smart contract:
   * `principal * BASE / borrowIndex`
   * @param principal principal amount to convert
   */
  async function convertPrincipal(principal: BigNumber) {
    const borrowIndex = await arc.core().borrowIndex();
    return principal.mul(BASE).div(borrowIndex);
  }

  /**
   * Advance the time by n years
   * @param years number of months to advance the time by
   */
  async function advanceNYears(years: BigNumberish) {
    return arc.updateTime(
      (await arc.core().currentTimestamp()).add(ONE_YEAR_IN_SECONDS.mul(years)),
    );
  }

  /**
   * Advance the time by n months
   * @param months number of months to advance the time by
   */
  async function advanceNMonths(months: BigNumberish) {
    return arc.updateTime(
      (await arc.core().currentTimestamp()).add(SECONDS_PER_MONTH.mul(months)),
    );
  }

  async function getVaultBorrowAmount(minter: SignerWithAddress) {
    return (await arc.getVault(minter.address)).borrowedAmount;
  }

  before(async () => {
    const ctx = await generateContext(sapphireFixture, init);
    signers = ctx.signers;
    arc = ctx.sdks.sapphire;
    minter1 = signers.minter;
    minter2 = signers.scoredMinter;
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('calculate the index for opening a position', () => {
    it('for one year', async () => {
      await setupBaseVault(arc, minter1, COLLATERAL_AMOUNT, BORROW_AMOUNT);
      await advanceNYears(1);
      const currentBorrowIndex = await arc.core().currentBorrowIndex();
      // 10^18 + 1547125957 * 365 * 24 * 60 * 60
      expect(currentBorrowIndex).eq('1048790164179952000');
      expect(currentBorrowIndex).eq(
        ONE_YEAR_IN_SECONDS.mul(INTEREST_RATE).add(BASE),
      );
      await arc.core().updateIndex();
      expect(await getVaultBorrowAmount(minter1)).eq(BORROW_AMOUNT);
    });

    it('for one and half years', async () => {
      await setupBaseVault(arc, minter1, COLLATERAL_AMOUNT, BORROW_AMOUNT);
      await advanceNMonths(18);
      const currentBorrowIndex = await arc.core().currentBorrowIndex();
      expect(currentBorrowIndex).eq(
        SECONDS_PER_MONTH.mul(18).mul(INTEREST_RATE).add(BASE),
      );
      await arc.core().updateIndex();

      expect(await getVaultBorrowAmount(minter1)).eq(BORROW_AMOUNT);
    });

    it('for two years', async () => {
      await setupBaseVault(arc, minter1, COLLATERAL_AMOUNT, BORROW_AMOUNT);
      await advanceNYears(2);
      const currentBorrowIndex = await arc.core().currentBorrowIndex();
      expect(currentBorrowIndex).eq(
        ONE_YEAR_IN_SECONDS.mul(2).mul(INTEREST_RATE).add(BASE),
      );
      await arc.core().updateIndex();

      expect(await getVaultBorrowAmount(minter1)).eq(BORROW_AMOUNT);
    });
  });

  describe('calculate the index for opening two positions', () => {
    it('the first for one year, the second for half a year', async () => {
      await setupBaseVault(arc, minter1, COLLATERAL_AMOUNT, BORROW_AMOUNT);
      await advanceNMonths(6);
      await setupBaseVault(arc, minter2, COLLATERAL_AMOUNT, BORROW_AMOUNT);

      const borrowIndex6 = await arc.core().currentBorrowIndex();
      expect(borrowIndex6).eq(
        SECONDS_PER_MONTH.mul(6).mul(INTEREST_RATE).add(BASE),
      );

      expect(await getVaultBorrowAmount(minter1)).eq(BORROW_AMOUNT);
      const actualBorrowedAmountByMinter2 = BORROW_AMOUNT.mul(BASE)
        .div(borrowIndex6)
        .mul(borrowIndex6)
        .div(BASE);
      expect(await getVaultBorrowAmount(minter2)).eq(
        BORROW_AMOUNT.mul(BASE).div(borrowIndex6),
      );
      // actual borrowed amount is different than requested BORROW_AMOUNT
      expect(actualBorrowedAmountByMinter2).eq(BORROW_AMOUNT.sub(1));
      await advanceNMonths(6);
      const indexLastUpdate = await arc.core().indexLastUpdate();
      await arc.core().updateIndex();

      const borrowIndex12 = await arc.core().currentBorrowIndex();
      expect(borrowIndex12).eq(
        await getBorrowIndex(indexLastUpdate, borrowIndex6, INTEREST_RATE),
      );
      expect(await getVaultBorrowAmount(minter1)).eq(BORROW_AMOUNT);
      expect(await getVaultBorrowAmount(minter2)).eq(
        BORROW_AMOUNT.mul(BASE).div(borrowIndex6),
      );
    });

    it('the first for one and a half years, the second for 3 months', async () => {
      await setupBaseVault(arc, minter1, COLLATERAL_AMOUNT, BORROW_AMOUNT);
      await advanceNMonths(18);
      await setupBaseVault(arc, minter2, COLLATERAL_AMOUNT, BORROW_AMOUNT);

      // check the borrow index
      const borrowIndex = await arc.core().currentBorrowIndex();
      expect(borrowIndex).eq(
        SECONDS_PER_MONTH.mul(18).mul(INTEREST_RATE).add(BASE),
      );

      // check vault amounts
      expect(await getVaultBorrowAmount(minter1)).eq(BORROW_AMOUNT);
      const normalizedBorrowAmount2 = BORROW_AMOUNT.mul(BASE).div(borrowIndex);
      expect(await getVaultBorrowAmount(minter2)).eq(normalizedBorrowAmount2);

      await advanceNMonths(3);

      await arc.core().updateIndex();

      expect(await getVaultBorrowAmount(minter1)).eq(BORROW_AMOUNT);

      expect(await getVaultBorrowAmount(minter2)).eq(normalizedBorrowAmount2);
    });

    it('the first for two years, the second for one and half years', async () => {
      await setupBaseVault(arc, minter1, COLLATERAL_AMOUNT, BORROW_AMOUNT);
      await advanceNMonths(6);

      await setupBaseVault(arc, minter2, COLLATERAL_AMOUNT, BORROW_AMOUNT);

      const borrowIndex = await arc.core().currentBorrowIndex();
      const indexLastUpdate = await arc.core().indexLastUpdate();
      const normalizedBorrowAmount2 = BORROW_AMOUNT.mul(BASE).div(borrowIndex);

      expect(borrowIndex).eq(
        SECONDS_PER_MONTH.mul(6).mul(INTEREST_RATE).add(BASE),
      );
      expect(await getVaultBorrowAmount(minter1)).eq(BORROW_AMOUNT);
      expect(await getVaultBorrowAmount(minter2)).eq(normalizedBorrowAmount2);

      await advanceNMonths(18);
      await arc.core().updateIndex();

      const borrowIndex24 = await arc.core().currentBorrowIndex();
      expect(borrowIndex24).eq(
        await getBorrowIndex(indexLastUpdate, borrowIndex, INTEREST_RATE),
      );

      expect(await getVaultBorrowAmount(minter1)).eq(BORROW_AMOUNT);

      expect(await getVaultBorrowAmount(minter2)).eq(normalizedBorrowAmount2);
    });
  });

  describe('calculate the index for 2 years for opening and updating a position', () => {
    it('open for 1 year and borrow more after this year', async () => {
      await setupBaseVault(
        arc,
        signers.minter,
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );

      await advanceNMonths(12);
      const borrowIndexFor12Months = await arc.core().currentBorrowIndex();

      await setupBaseVault(
        arc,
        signers.minter,
        COLLATERAL_AMOUNT.mul(borrowIndexFor12Months),
        BORROW_AMOUNT,
      );

      const indexLastUpdate = await arc.core().indexLastUpdate();

      const normalizedBorrowedAmount = await convertPrincipal(BORROW_AMOUNT);
      let expectedNormalizedAmountInVault = BORROW_AMOUNT.add(
        normalizedBorrowedAmount,
      );

      expect(await getVaultBorrowAmount(minter1)).eq(
        expectedNormalizedAmountInVault,
      );
      expect(await arc.core().totalBorrowed()).to.eq(
        expectedNormalizedAmountInVault,
      );

      await advanceNMonths(12);
      await arc.core().updateIndex();

      const currentBorrowIndex = await arc.core().currentBorrowIndex();

      expect(currentBorrowIndex).eq(
        await getBorrowIndex(
          indexLastUpdate,
          borrowIndexFor12Months,
          INTEREST_RATE,
        ),
      );

      expect(await getVaultBorrowAmount(minter1)).eq(
        expectedNormalizedAmountInVault,
      );
      expect(await arc.core().totalBorrowed()).eq(
        expectedNormalizedAmountInVault,
      );
    });

    it.skip('open for 1 year and liquidate after this year', () => {});

    it('open for 1 year and repay partially after this year', async () => {
      await setupBaseVault(arc, minter1, COLLATERAL_AMOUNT, BORROW_AMOUNT);
      expect(await arc.core().totalBorrowed()).eq(BORROW_AMOUNT);

      await advanceNMonths(12);
      const borrowIndexFor12Months = await arc.core().currentBorrowIndex();

      const repayAmount = BORROW_AMOUNT.div(2)
        .mul(borrowIndexFor12Months)
        .div(BASE);
      await approve(
        repayAmount,
        arc.syntheticAddress(),
        arc.coreAddress(),
        minter1,
      );
      // repay a half accumulated debt
      await arc.repay(repayAmount, undefined, undefined, minter1);

      const indexLastUpdate = await arc.core().indexLastUpdate();
      await advanceNMonths(12);
      await arc.core().updateIndex();
      const currentBorrowIndex = await arc.core().currentBorrowIndex();

      expect(currentBorrowIndex).eq(
        await getBorrowIndex(
          indexLastUpdate,
          borrowIndexFor12Months,
          INTEREST_RATE,
        ),
      );

      const accumulatedBorrowAmount = BORROW_AMOUNT.div(2);
      expect(await getVaultBorrowAmount(minter1)).eq(accumulatedBorrowAmount);
      expect(await arc.core().totalBorrowed()).eq(BORROW_AMOUNT.div(2));
    });

    it('open for 1 year and repay fully after this year', async () => {
      await setupBaseVault(arc, minter1, COLLATERAL_AMOUNT, BORROW_AMOUNT);
      expect(await arc.core().totalBorrowed()).eq(BORROW_AMOUNT);

      await advanceNMonths(12);
      await arc.core().updateIndex();
      const borrowIndexFor12Months = await arc.core().currentBorrowIndex();

      const borrowedAmount = BORROW_AMOUNT.mul(borrowIndexFor12Months).div(
        BASE,
      );
      expect(await getVaultBorrowAmount(minter1)).eq(BORROW_AMOUNT);

      // mint accrued interest rate
      await arc
        .synthetic()
        .mint(minter1.address, borrowedAmount.sub(BORROW_AMOUNT));
      await approve(
        borrowedAmount,
        arc.syntheticAddress(),
        arc.coreAddress(),
        minter1,
      );

      // repay a whole accumulated debt
      await arc.repay(borrowedAmount, undefined, undefined, minter1);
      expect(await arc.core().totalBorrowed()).eq(0);

      await advanceNMonths(12);
      await arc.core().updateIndex();

      expect(await getVaultBorrowAmount(minter1)).eq(0);
      expect(await arc.core().totalBorrowed()).eq(0);
    });
  });

  describe('Scenarios', () => {
    // Scenario 1 in the Google SpreadSheet (see link at the top of this file)
    it('calculates the interest amount correctly for one user', async () => {
      await arc.core().connect(signers.interestSetter).setInterestRate(0);

      await arc.updateTime(1);

      await arc
        .core()
        .connect(signers.interestSetter)
        .setInterestRate(INTEREST_RATE);

      // User A opens position of n tokens and $500 debt
      await arc.updateTime(2);
      await setupBaseVault(
        arc,
        signers.scoredMinter,
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );

      let borrowIndex = await arc.core().borrowIndex();
      let totalBorrowed = await arc.core().totalBorrowed();
      const normalizedBorrowed = BORROW_AMOUNT.mul(BASE).div(borrowIndex);
      expect(totalBorrowed).to.eq(normalizedBorrowed);
      expect(await getVaultBorrowAmount(signers.scoredMinter)).to.eq(
        normalizedBorrowed,
      );

      // Update time to 6 months
      await advanceNMonths(6);
      let lastUpdateIndex = await arc.core().indexLastUpdate();
      let prevBorrowIndex = await arc.core().borrowIndex();
      await arc.core().updateIndex();

      borrowIndex = await arc.core().borrowIndex();
      let newLastUpdateIndex = await arc.core().indexLastUpdate();
      expect(borrowIndex).to.eq(
        await getBorrowIndex(lastUpdateIndex, prevBorrowIndex),
      );
      expect(newLastUpdateIndex).to.eq(
        lastUpdateIndex.add(SECONDS_PER_MONTH.mul(6)),
      );

      // Borrow $100 more
      await arc.borrow(
        utils.parseEther('100'),
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.scoredMinter,
      );

      totalBorrowed = await arc.core().totalBorrowed();
      const convertedPrincipal100 = await convertPrincipal(
        utils.parseEther('100'),
      );
      let expectedAmountInVault = normalizedBorrowed.add(convertedPrincipal100);

      expect(totalBorrowed).to.eq(expectedAmountInVault);

      // Update time to 3 months
      await advanceNMonths(3);
      lastUpdateIndex = await arc.core().indexLastUpdate();
      prevBorrowIndex = await arc.core().borrowIndex();
      await arc.core().updateIndex();

      borrowIndex = await arc.core().borrowIndex();
      newLastUpdateIndex = await arc.core().indexLastUpdate();
      expect(borrowIndex).to.eq(
        await getBorrowIndex(lastUpdateIndex, prevBorrowIndex),
      );
      expect(newLastUpdateIndex).to.eq(
        lastUpdateIndex.add(SECONDS_PER_MONTH.mul(3)),
      );

      // Repay principal of $600
      const repayAmount = utils.parseEther('600');
      await approve(
        repayAmount,
        arc.synthetic().address,
        arc.coreAddress(),
        signers.scoredMinter,
      );
      await arc.repay(
        repayAmount,
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.scoredMinter,
      );

      totalBorrowed = await arc.core().totalBorrowed();
      borrowIndex = await arc.core().borrowIndex();
      const normalizedRepayAmount = await convertPrincipal(repayAmount);
      const expectedNormalizedAmountInVault = normalizedBorrowed // initial normalized borrowed amount
        .add(convertedPrincipal100) // newly added amount - normalized
        .sub(normalizedRepayAmount); // remove repayed amount - normalized

      expect(await getVaultBorrowAmount(signers.scoredMinter)).eq(
        expectedNormalizedAmountInVault,
      );
      expect(totalBorrowed).to.eq(expectedNormalizedAmountInVault);
      // Update time to 3 months
      await advanceNMonths(3);
      lastUpdateIndex = await arc.core().indexLastUpdate();
      prevBorrowIndex = await arc.core().borrowIndex();
      await arc.core().updateIndex();

      borrowIndex = await arc.core().borrowIndex();
      newLastUpdateIndex = await arc.core().indexLastUpdate();
      expect(borrowIndex).to.eq(
        await getBorrowIndex(lastUpdateIndex, prevBorrowIndex),
      );
      expect(newLastUpdateIndex).to.eq(
        lastUpdateIndex.add(SECONDS_PER_MONTH.mul(3)),
      );

      // Repay remaining interest
      // TODO: resolve rounding - that's why I added 1
      const outstandingRepayAmt = (
        await getVaultBorrowAmount(signers.scoredMinter)
      )
        .mul(borrowIndex)
        .div(BASE)
        .add(1);

      // Owner doesn't have enough money to repay all debt because of interest rate
      await arc
        .synthetic()
        .mint(signers.scoredMinter.address, outstandingRepayAmt);
      await approve(
        outstandingRepayAmt,
        arc.synthetic().address,
        arc.coreAddress(),
        signers.scoredMinter,
      );
      await arc.repay(
        outstandingRepayAmt,
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.scoredMinter,
      );
      expect(await getVaultBorrowAmount(signers.scoredMinter)).to.eq(0);
      expect(await arc.core().totalBorrowed()).to.eq(0);
    });

    it('calculates the interest amount correctly for two users when a repayment happens in between', async () => {
      await arc.updateTime(1);

      // Set interest rate for a 5% APY. Calculated using
      // https://www.wolframalpha.com/input/?i=31536000th+root+of+1.05
      const interestRate = BigNumber.from(1547125957);
      await arc
        .core()
        .connect(signers.interestSetter)
        .setInterestRate(interestRate);

      // User A opens position of 1000 tokens at $1 and $500 debt
      await arc.updateTime(2);
      await setupBaseVault(
        arc,
        signers.scoredMinter,
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );
      const borrowIndex2 = await arc.core().currentBorrowIndex();
      const normalizedVaultABorrowedAmount = BORROW_AMOUNT.mul(BASE).div(
        borrowIndex2,
      );

      // Update time to 6 months and update index
      await advanceNMonths(6);
      let lastUpdateIndex = await arc.core().indexLastUpdate();
      let prevBorrowIndex = await arc.core().borrowIndex();
      await arc.core().updateIndex();

      let borrowIndex = await arc.core().borrowIndex();
      let newLastUpdateIndex = await arc.core().indexLastUpdate();
      expect(borrowIndex).to.eq(
        await getBorrowIndex(lastUpdateIndex, prevBorrowIndex),
      );
      expect(newLastUpdateIndex).to.eq(
        lastUpdateIndex.add(SECONDS_PER_MONTH.mul(6)),
      );

      // User B opens position at 1000 tokens at $1 and $500 debt
      await setupBaseVault(
        arc,
        signers.minter,
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );
      const normalizedVaultBBorrowedAmount = BORROW_AMOUNT.mul(BASE).div(
        borrowIndex,
      );

      expect(await getVaultBorrowAmount(signers.scoredMinter)).eq(
        normalizedVaultABorrowedAmount,
      );

      expect(await getVaultBorrowAmount(signers.minter)).eq(
        normalizedVaultBBorrowedAmount,
      );

      expect(await arc.core().totalBorrowed()).to.eq(
        normalizedVaultABorrowedAmount.add(normalizedVaultBBorrowedAmount),
      );

      // Update time to 3 months and update index
      await advanceNMonths(3);
      lastUpdateIndex = await arc.core().indexLastUpdate();
      prevBorrowIndex = await arc.core().borrowIndex();
      await arc.core().updateIndex();

      borrowIndex = await arc.core().borrowIndex();
      newLastUpdateIndex = await arc.core().indexLastUpdate();
      expect(borrowIndex).to.eq(
        await getBorrowIndex(lastUpdateIndex, prevBorrowIndex),
      );
      expect(newLastUpdateIndex).to.eq(
        lastUpdateIndex.add(SECONDS_PER_MONTH.mul(3)),
      );

      // User A repays his initial debt ($500). His vault should contain the accumulated interest
      await approve(
        BORROW_AMOUNT,
        arc.syntheticAddress(),
        arc.coreAddress(),
        signers.scoredMinter,
      );
      await arc.repay(
        BORROW_AMOUNT,
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.scoredMinter,
      );

      const normalizedRepayAmount = await convertPrincipal(BORROW_AMOUNT);
      const normalizedVaultABorrowedAfterRepay = normalizedVaultABorrowedAmount.sub(
        normalizedRepayAmount,
      );
      expect(await getVaultBorrowAmount(signers.scoredMinter)).eq(
        normalizedVaultABorrowedAfterRepay,
      );

      expect(await getVaultBorrowAmount(signers.minter)).eq(
        normalizedVaultBBorrowedAmount,
      );

      expect(await arc.core().totalBorrowed()).to.eq(
        normalizedVaultABorrowedAfterRepay.add(normalizedVaultBBorrowedAmount),
      );

      // Update time to 3 months and update index
      await advanceNMonths(3);
      lastUpdateIndex = await arc.core().indexLastUpdate();
      prevBorrowIndex = await arc.core().borrowIndex();
      await arc.core().updateIndex();

      borrowIndex = await arc.core().borrowIndex();
      newLastUpdateIndex = await arc.core().indexLastUpdate();
      expect(borrowIndex).to.eq(
        await getBorrowIndex(lastUpdateIndex, prevBorrowIndex),
      );
      expect(newLastUpdateIndex).to.eq(
        lastUpdateIndex.add(SECONDS_PER_MONTH.mul(3)),
      );

      // User B repays his entire debt and interest
      // TO DO: SHOULD BE FIXED!!! because of rounding add 1
      const outstandingBalance = (await getVaultBorrowAmount(signers.minter))
        .mul(borrowIndex)
        .div(BASE)
        .add(1);

      await arc
        .synthetic()
        .mint(signers.minter.address, outstandingBalance.sub(BORROW_AMOUNT));
      await approve(
        outstandingBalance,
        arc.syntheticAddress(),
        arc.coreAddress(),
        signers.minter,
      );
      await arc.repay(outstandingBalance, undefined, undefined, signers.minter);

      expect(await getVaultBorrowAmount(signers.scoredMinter)).eq(
        normalizedVaultABorrowedAfterRepay,
      );

      expect(await getVaultBorrowAmount(signers.minter)).eq(0);

      expect(await arc.core().totalBorrowed()).to.eq(
        normalizedVaultABorrowedAfterRepay,
      );
      // Update time to 1 month and update index
      await advanceNMonths(1);
      lastUpdateIndex = await arc.core().indexLastUpdate();
      prevBorrowIndex = await arc.core().borrowIndex();
      await arc.core().updateIndex();

      borrowIndex = await arc.core().borrowIndex();
      newLastUpdateIndex = await arc.core().indexLastUpdate();
      expect(borrowIndex).to.eq(
        await getBorrowIndex(lastUpdateIndex, prevBorrowIndex),
      );
      expect(newLastUpdateIndex).to.eq(lastUpdateIndex.add(SECONDS_PER_MONTH));

      // User A should just have the accumulated interest,
      // which is equal to the totalBorrowed amount of the system
    });

    // TODO develop spreadsheet scenarios for the following cases:
    xit('2 users borrow, then interest is set to 0');
    xit('3 users borrow, then halfway the interest rate increases');
    xit('2 users borrow, then one is liquidated');
    xit('User repays more than the debt amount');
  });
});
