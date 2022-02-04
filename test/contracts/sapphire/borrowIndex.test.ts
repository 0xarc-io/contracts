/**
 * This file contains integration tests regarding the calculation of the interest
 * on the borrowed amounts. An accompanying Google Sheet can be found at
 * https://docs.google.com/spreadsheets/d/1rmFbUxnM4gyi1xhcYKBwcdadvXrHBPKbeX7DLk8KQgE
 * at the "Borrow index" tab
 */

import { PassportScore } from '@arc-types/sapphireCore';
import { TestingSigners } from '@arc-types/testing';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { approve } from '@src/utils/approve';
import { BASE, ONE_YEAR_IN_SECONDS } from '@src/constants';
import { PassportScoreTree } from '@src/MerkleTree';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { getScoreProof } from '@src/utils/getScoreProof';
import {
  DEFAULT_COLLATERAL_DECIMALS,
  DEFAULT_PROOF_PROTOCOL,
} from '@test/helpers/sapphireDefaults';
import { setupBaseVault } from '@test/helpers/setupBaseVault';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber, BigNumberish, utils } from 'ethers';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';
import { roundUpDiv, roundUpMul } from '@test/helpers/roundUpOperations';
import { TestToken } from '@src/typings';

const COLLATERAL_AMOUNT = utils.parseUnits('1000', DEFAULT_COLLATERAL_DECIMALS);
const BORROW_AMOUNT = utils.parseEther('500');

const SECONDS_PER_MONTH = BigNumber.from(30 * 24 * 60 * 60);

// Set interest rate for a 5% APY. Calculated using
// https://www.wolframalpha.com/input/?i=31536000th+root+of+1.05
const INTEREST_RATE = BigNumber.from(1547125957);

describe('borrow index (integration)', () => {
  let arc: SapphireTestArc;
  let signers: TestingSigners;
  let minterCreditScore: PassportScore;
  let creditScoreTree: PassportScoreTree;
  let minter1: SignerWithAddress;
  let minter2: SignerWithAddress;
  let stableCoin: TestToken;

  async function init(ctx: ITestContext): Promise<void> {
    minterCreditScore = {
      account: ctx.signers.scoredMinter.address,
      protocol: utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
      score: BigNumber.from(500),
    };
    const creditScore2 = {
      account: ctx.signers.interestSetter.address,
      protocol: utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
      score: BigNumber.from(20),
    };
    creditScoreTree = new PassportScoreTree([minterCreditScore, creditScore2]);
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
    return roundUpDiv(principal, borrowIndex);
  }

  /**
   * Returns `amount * borrowIndex`, as calculated by the contract
   */
  async function denormalizeBorrowAmount(amount: BigNumber) {
    const borrowIndex = await arc.core().borrowIndex();
    return roundUpMul(amount, borrowIndex);
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
    stableCoin = ctx.contracts.stableCoin;
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
      const { borrowedAmount, principal } = await arc.getVault(minter1.address);
      expect(borrowedAmount).eq(BORROW_AMOUNT);
      expect(principal).eq(BORROW_AMOUNT);
    });

    it('for one and half years', async () => {
      await setupBaseVault(arc, minter1, COLLATERAL_AMOUNT, BORROW_AMOUNT);
      await advanceNMonths(18);
      const currentBorrowIndex = await arc.core().currentBorrowIndex();
      expect(currentBorrowIndex).eq(
        SECONDS_PER_MONTH.mul(18).mul(INTEREST_RATE).add(BASE),
      );
      await arc.core().updateIndex();

      const { borrowedAmount, principal } = await arc.getVault(minter1.address);
      expect(borrowedAmount).eq(BORROW_AMOUNT);
      expect(principal).eq(BORROW_AMOUNT);
    });

    it('for two years', async () => {
      await setupBaseVault(arc, minter1, COLLATERAL_AMOUNT, BORROW_AMOUNT);
      await advanceNYears(2);
      const currentBorrowIndex = await arc.core().currentBorrowIndex();
      expect(currentBorrowIndex).eq(
        ONE_YEAR_IN_SECONDS.mul(2).mul(INTEREST_RATE).add(BASE),
      );
      await arc.core().updateIndex();

      const { borrowedAmount, principal } = await arc.getVault(minter1.address);
      expect(borrowedAmount).eq(BORROW_AMOUNT);
      expect(principal).eq(BORROW_AMOUNT);
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

      const { borrowedAmount, principal } = await arc.getVault(minter2.address);
      expect(borrowedAmount).eq(roundUpDiv(BORROW_AMOUNT, borrowIndex6));
      expect(principal).eq(BORROW_AMOUNT);

      // actual borrowed amount is different than requested BORROW_AMOUNT
      expect(actualBorrowedAmountByMinter2).eq(BORROW_AMOUNT.sub(1));
      await advanceNMonths(6);
      const indexLastUpdate = await arc.core().indexLastUpdate();
      await arc.core().updateIndex();

      const borrowIndex12 = await arc.core().currentBorrowIndex();
      expect(borrowIndex12).eq(
        await getBorrowIndex(indexLastUpdate, borrowIndex6, INTEREST_RATE),
      );
      
      const vault1 = await arc.getVault(minter1.address);
      expect(vault1.borrowedAmount).eq(BORROW_AMOUNT);
      expect(vault1.principal).eq(BORROW_AMOUNT);

      const vault2 = await arc.getVault(minter2.address);
      expect(vault2.borrowedAmount).eq(
        roundUpDiv(BORROW_AMOUNT, borrowIndex6),
      );
      expect(vault2.principal).eq(BORROW_AMOUNT);
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
      const normalizedBorrowAmount2 = roundUpDiv(BORROW_AMOUNT, borrowIndex);
      expect(await getVaultBorrowAmount(minter2)).eq(normalizedBorrowAmount2);

      await advanceNMonths(3);

      await arc.core().updateIndex();

      expect(await getVaultBorrowAmount(minter1)).eq(BORROW_AMOUNT);

      const { borrowedAmount, principal } = await arc.getVault(minter2.address);
      expect(borrowedAmount).eq(normalizedBorrowAmount2);
      expect(principal).eq(BORROW_AMOUNT);
    });

    it('the first for two years, the second for one and half years', async () => {
      await setupBaseVault(arc, minter1, COLLATERAL_AMOUNT, BORROW_AMOUNT);
      await advanceNMonths(6);

      await setupBaseVault(arc, minter2, COLLATERAL_AMOUNT, BORROW_AMOUNT);

      const borrowIndex = await arc.core().currentBorrowIndex();
      const indexLastUpdate = await arc.core().indexLastUpdate();
      const normalizedBorrowAmount2 = roundUpDiv(BORROW_AMOUNT, borrowIndex);

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

      const originalAmtInVault = await convertPrincipal(BORROW_AMOUNT);

      await advanceNMonths(12);
      const borrowIndexFor12Months = await arc.core().currentBorrowIndex();

      await setupBaseVault(
        arc,
        signers.minter,
        COLLATERAL_AMOUNT.mul(borrowIndexFor12Months),
        BORROW_AMOUNT,
      );

      const indexLastUpdate = await arc.core().indexLastUpdate();

      const expectedNormalizedAmountInVault = await convertPrincipal(
        (await denormalizeBorrowAmount(originalAmtInVault)).add(BORROW_AMOUNT),
      );
      BORROW_AMOUNT
      const {borrowedAmount, principal} = await arc.getVault(minter1.address);
      expect(borrowedAmount).eq(
        expectedNormalizedAmountInVault,
      );
      expect(principal).eq(BORROW_AMOUNT.mul(2));
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

    it('open for 1 year and liquidate after this year');

    it('open for 1 year and repay partially after this year', async () => {
      await setupBaseVault(arc, minter1, COLLATERAL_AMOUNT, BORROW_AMOUNT);
      expect(await arc.core().totalBorrowed()).eq(BORROW_AMOUNT);

      await advanceNMonths(12);
      const borrowIndexFor12Months = await arc.core().currentBorrowIndex();

      const repayAmount = roundUpMul(
        BORROW_AMOUNT.div(2),
        borrowIndexFor12Months,
      );
      await approve(
        repayAmount,
        arc.syntheticAddress(),
        arc.coreAddress(),
        minter1,
      );
      // repay a half accumulated debt
      await arc.repay(repayAmount, undefined, undefined, minter1);
      const borrowIndexAfterRepay = await arc.core().currentBorrowIndex();

      const {principal: principalRightAfterRepay} = await arc.getVault(minter1.address);

      const actualBorrowedAmountAfterRepay = BORROW_AMOUNT.mul(borrowIndexAfterRepay).div(BASE);
      const expectedPrincipal = actualBorrowedAmountAfterRepay.sub(repayAmount);
      // check if repayed amount repays not only interest
      expect(expectedPrincipal).lt(BORROW_AMOUNT);
      // should repay accumulated interest first
      expect(principalRightAfterRepay).eq(expectedPrincipal);

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
      const {borrowedAmount, principal} = await arc.getVault(minter1.address);
      // principal shouldn't change, if there is no borrow/repay actions durring accumulating period
      expect(principal).eq(expectedPrincipal);
      expect(borrowedAmount).eq(accumulatedBorrowAmount);
      expect(await arc.core().totalBorrowed()).eq(BORROW_AMOUNT.div(2));
    });

    it('open for 1 year and repay fully after this year', async () => {
      await setupBaseVault(arc, minter1, COLLATERAL_AMOUNT, BORROW_AMOUNT);
      expect(await arc.core().totalBorrowed()).eq(BORROW_AMOUNT);

      await advanceNMonths(12);
      await arc.core().updateIndex();
      const borrowIndexFor12Months = await arc.core().currentBorrowIndex();

      const borrowedAmount = roundUpMul(BORROW_AMOUNT, borrowIndexFor12Months);
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
      const normalizedBorrowed = await convertPrincipal(BORROW_AMOUNT);
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
        stableCoin.address,
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.scoredMinter,
      );

      totalBorrowed = await arc.core().totalBorrowed();
      let expectedAmountInVault = await convertPrincipal(
        (await denormalizeBorrowAmount(normalizedBorrowed)).add(
          utils.parseEther('100'),
        ),
      );

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
      expectedAmountInVault = await convertPrincipal(
        (await denormalizeBorrowAmount(expectedAmountInVault)).sub(repayAmount),
      );

      expect(await getVaultBorrowAmount(signers.scoredMinter)).eq(
        expectedAmountInVault,
      );
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

      // Repay remaining interest
      const outstandingRepayAmt = roundUpMul(
        await getVaultBorrowAmount(signers.scoredMinter),
        borrowIndex,
      );

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
      const normalizedVaultABorrowedAmount = roundUpDiv(
        BORROW_AMOUNT,
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
      const normalizedVaultBBorrowedAmount = roundUpDiv(
        BORROW_AMOUNT,
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

      const normalizedVaultABorrowedAfterRepay = await convertPrincipal(
        roundUpMul(normalizedVaultABorrowedAmount, borrowIndex).sub(
          BORROW_AMOUNT,
        ),
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
      const outstandingBalance = roundUpMul(
        await getVaultBorrowAmount(signers.minter),
        borrowIndex,
      );

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

      expect(await getVaultBorrowAmount(signers.minter));

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
