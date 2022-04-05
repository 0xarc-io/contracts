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
import { getEmptyScoreProof, getScoreProof } from '@src/utils/getScoreProof';
import {
  DEFAULT_COLLATERAL_DECIMALS,
  DEFAULT_STABLE_COIN_PRECISION_SCALAR,
} from '@test/helpers/sapphireDefaults';
import {
  CREDIT_PROOF_PROTOCOL,
  BORROW_LIMIT_PROOF_PROTOCOL,
} from '@src/constants';
import {
  mintApprovedCollateral,
  setupBaseVault,
} from '@test/helpers/setupBaseVault';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber, BigNumberish, utils } from 'ethers';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';
import { roundUpDiv, roundUpMul } from '@test/helpers/roundUpOperations';
import { TestToken } from '@src/typings';
import { deployTestToken } from '../deployers';

const COLLATERAL_AMOUNT = utils.parseUnits('1000', DEFAULT_COLLATERAL_DECIMALS);
const BORROW_AMOUNT = utils.parseEther('500');

const SECONDS_PER_MONTH = BigNumber.from(30 * 24 * 60 * 60);

// Set interest rate for a 5% APY. Calculated using
// https://www.wolframalpha.com/input/?i=31536000th+root+of+1.05
const INTEREST_RATE = BigNumber.from(1547125957);

describe('borrow index (integration)', () => {
  let arc: SapphireTestArc;
  let signers: TestingSigners;
  let borrowerCreditScore: PassportScore;
  let borrower1CreditScore: PassportScore;
  let borrowerBorrowLimitScore: PassportScore;
  let borrowLimitScore1: PassportScore;
  let creditScoreTree: PassportScoreTree;
  let borrower1: SignerWithAddress;
  let borrower2: SignerWithAddress;
  let stablecoin: TestToken;

  async function init(ctx: ITestContext): Promise<void> {
    borrowerCreditScore = {
      account: ctx.signers.scoredBorrower.address,
      protocol: utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
      score: BigNumber.from(500),
    };
    borrower1CreditScore = {
      account: ctx.signers.borrower.address,
      protocol: utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
      score: BigNumber.from(500),
    };
    borrowerBorrowLimitScore = {
      account: ctx.signers.scoredBorrower.address,
      protocol: utils.formatBytes32String(BORROW_LIMIT_PROOF_PROTOCOL),
      score: BORROW_AMOUNT.mul(2),
    };
    borrowLimitScore1 = {
      account: ctx.signers.borrower.address,
      protocol: utils.formatBytes32String(BORROW_LIMIT_PROOF_PROTOCOL),
      score: BORROW_AMOUNT.mul(3),
    };
    const creditScore2 = {
      account: ctx.signers.interestSetter.address,
      protocol: utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
      score: BigNumber.from(20),
    };
    creditScoreTree = new PassportScoreTree([
      borrowerCreditScore,
      creditScore2,
      borrowerBorrowLimitScore,
      borrowLimitScore1,
      borrower1CreditScore,
    ]);
    await setupSapphire(ctx, {
      interestRate: INTEREST_RATE,
      merkleRoot: creditScoreTree.getHexRoot(),
      poolDepositBorrowAmount: BORROW_AMOUNT.mul(3),
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

  async function getVaultBorrowAmount(borrower: SignerWithAddress) {
    return (await arc.getVault(borrower.address)).normalizedBorrowedAmount;
  }

  before(async () => {
    const ctx = await generateContext(sapphireFixture, init, {
      stablecoinDecimals: 18,
    });
    signers = ctx.signers;
    arc = ctx.sdks.sapphire;
    borrower1 = signers.borrower;
    borrower2 = signers.scoredBorrower;
    stablecoin = ctx.contracts.stablecoin;
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('calculate the index for opening a position', () => {
    it('for one year', async () => {
      await setupBaseVault(
        arc,
        borrower1,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );
      await advanceNYears(1);
      const currentBorrowIndex = await arc.core().currentBorrowIndex();
      // 10^18 + 1547125957 * 365 * 24 * 60 * 60
      expect(currentBorrowIndex).eq('1048790164179952000');
      expect(currentBorrowIndex).eq(
        ONE_YEAR_IN_SECONDS.mul(INTEREST_RATE).add(BASE),
      );
      await arc.core().updateIndex();
      const { normalizedBorrowedAmount, principal } = await arc.getVault(
        borrower1.address,
      );
      expect(normalizedBorrowedAmount).eq(BORROW_AMOUNT);
      expect(principal).eq(BORROW_AMOUNT);
    });

    it('for one and half years', async () => {
      await setupBaseVault(
        arc,
        borrower1,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );
      await advanceNMonths(18);
      const currentBorrowIndex = await arc.core().currentBorrowIndex();
      expect(currentBorrowIndex).eq(
        SECONDS_PER_MONTH.mul(18).mul(INTEREST_RATE).add(BASE),
      );
      await arc.core().updateIndex();

      const { normalizedBorrowedAmount, principal } = await arc.getVault(
        borrower1.address,
      );
      expect(normalizedBorrowedAmount).eq(BORROW_AMOUNT);
      expect(principal).eq(BORROW_AMOUNT);
    });

    it('for two years', async () => {
      await setupBaseVault(
        arc,
        borrower1,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );
      await advanceNYears(2);
      const currentBorrowIndex = await arc.core().currentBorrowIndex();
      expect(currentBorrowIndex).eq(
        ONE_YEAR_IN_SECONDS.mul(2).mul(INTEREST_RATE).add(BASE),
      );
      await arc.core().updateIndex();

      const { normalizedBorrowedAmount, principal } = await arc.getVault(
        borrower1.address,
      );
      expect(normalizedBorrowedAmount).eq(BORROW_AMOUNT);
      expect(principal).eq(BORROW_AMOUNT);
    });

    it('for one and half years for 6 decimal borrow asset', async () => {
      // setup additional stablecoin
      const anotherStablecoin = await deployTestToken(
        signers.admin,
        'Another Stablecoin',
        'ASTABLE',
        6,
      );
      const borrowAmount = utils.parseUnits(
        utils.formatEther(BORROW_AMOUNT),
        6,
      );
      await arc.pool().setDepositLimit(anotherStablecoin.address, borrowAmount);
      await anotherStablecoin.mintShare(arc.pool().address, borrowAmount);
      await mintApprovedCollateral(arc, borrower1, COLLATERAL_AMOUNT);

      await advanceNMonths(6);
      await arc.core().updateIndex();
      const borrowIndex6months = await arc.core().currentBorrowIndex();
      const lastUpdateIndex6months = await arc.core().indexLastUpdate();

      await arc.depositAndBorrow(
        COLLATERAL_AMOUNT,
        borrowAmount,
        anotherStablecoin.address,
        getEmptyScoreProof(
          undefined,
          utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
        ),
        getScoreProof(borrowLimitScore1, creditScoreTree),
        undefined,
        borrower1,
      );
      await advanceNMonths(18);
      const currentBorrowIndex = await arc.core().currentBorrowIndex();
      expect(currentBorrowIndex).eq(
        await getBorrowIndex(lastUpdateIndex6months, borrowIndex6months),
      );
      await arc.core().updateIndex();

      const vault = await arc.getVault(signers.borrower.address);
      expect(vault.normalizedBorrowedAmount).eq(
        roundUpDiv(BORROW_AMOUNT, borrowIndex6months),
      );
      expect(vault.principal).eq(BORROW_AMOUNT);

      const accumulatedInterest = BORROW_AMOUNT.mul(INTEREST_RATE)
        .mul(SECONDS_PER_MONTH)
        .mul(18)
        .div(BASE);
      const borrowAmountBasedOnIndex = vault.normalizedBorrowedAmount
        .mul(currentBorrowIndex)
        .div(BASE);
      const borrowAmountBasedOnCalculations = BORROW_AMOUNT.add(
        accumulatedInterest,
      );
      // divided by CALCULATION_PRECISION because of dividing loses in contract
      const CALCULATION_PRECISION = utils.parseUnits('1', 7);
      expect(borrowAmountBasedOnIndex.div(CALCULATION_PRECISION)).eq(
        borrowAmountBasedOnCalculations.div(CALCULATION_PRECISION),
      );
    });
  });

  describe('calculate the index for opening two positions', () => {
    it('the first for one year, the second for half a year', async () => {
      await setupBaseVault(
        arc,
        borrower1,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );
      await advanceNMonths(6);
      await setupBaseVault(
        arc,
        borrower2,
        getScoreProof(borrowerBorrowLimitScore, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );

      const borrowIndex6 = await arc.core().currentBorrowIndex();
      expect(borrowIndex6).eq(
        SECONDS_PER_MONTH.mul(6).mul(INTEREST_RATE).add(BASE),
      );

      expect(await getVaultBorrowAmount(borrower1)).eq(BORROW_AMOUNT);
      const actualBorrowedAmountByBorrower2 = BORROW_AMOUNT.mul(BASE)
        .div(borrowIndex6)
        .mul(borrowIndex6)
        .div(BASE);

      const { normalizedBorrowedAmount, principal } = await arc.getVault(
        borrower2.address,
      );
      expect(normalizedBorrowedAmount).eq(
        roundUpDiv(BORROW_AMOUNT, borrowIndex6),
      );
      expect(principal).eq(BORROW_AMOUNT);

      // actual borrowed amount is different than requested BORROW_AMOUNT
      expect(actualBorrowedAmountByBorrower2).eq(BORROW_AMOUNT.sub(1));
      await advanceNMonths(6);
      const indexLastUpdate = await arc.core().indexLastUpdate();
      await arc.core().updateIndex();

      const borrowIndex12 = await arc.core().currentBorrowIndex();
      expect(borrowIndex12).eq(
        await getBorrowIndex(indexLastUpdate, borrowIndex6, INTEREST_RATE),
      );

      const vault1 = await arc.getVault(borrower1.address);
      expect(vault1.normalizedBorrowedAmount).eq(BORROW_AMOUNT);
      expect(vault1.principal).eq(BORROW_AMOUNT);

      const vault2 = await arc.getVault(borrower2.address);
      expect(vault2.normalizedBorrowedAmount).eq(
        roundUpDiv(BORROW_AMOUNT, borrowIndex6),
      );
      expect(vault2.principal).eq(BORROW_AMOUNT);
    });

    it('the first for one and a half years, the second for 3 months', async () => {
      await setupBaseVault(
        arc,
        borrower1,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );
      await advanceNMonths(18);
      await setupBaseVault(
        arc,
        borrower2,
        getScoreProof(borrowerBorrowLimitScore, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );

      // check the borrow index
      const borrowIndex = await arc.core().currentBorrowIndex();
      expect(borrowIndex).eq(
        SECONDS_PER_MONTH.mul(18).mul(INTEREST_RATE).add(BASE),
      );

      // check vault amounts
      expect(await getVaultBorrowAmount(borrower1)).eq(BORROW_AMOUNT);
      const normalizedBorrowAmount2 = roundUpDiv(BORROW_AMOUNT, borrowIndex);
      expect(await getVaultBorrowAmount(borrower2)).eq(normalizedBorrowAmount2);

      await advanceNMonths(3);

      await arc.core().updateIndex();

      expect(await getVaultBorrowAmount(borrower1)).eq(BORROW_AMOUNT);

      const { normalizedBorrowedAmount, principal } = await arc.getVault(
        borrower2.address,
      );
      expect(normalizedBorrowedAmount).eq(normalizedBorrowAmount2);
      expect(principal).eq(BORROW_AMOUNT);
    });

    it('the first for two years, the second for one and half years', async () => {
      await setupBaseVault(
        arc,
        borrower1,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );
      await advanceNMonths(6);

      await setupBaseVault(
        arc,
        borrower2,
        getScoreProof(borrowerBorrowLimitScore, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );

      const borrowIndex = await arc.core().currentBorrowIndex();
      const indexLastUpdate = await arc.core().indexLastUpdate();
      const normalizedBorrowAmount2 = roundUpDiv(BORROW_AMOUNT, borrowIndex);

      expect(borrowIndex).eq(
        SECONDS_PER_MONTH.mul(6).mul(INTEREST_RATE).add(BASE),
      );
      expect(await getVaultBorrowAmount(borrower1)).eq(BORROW_AMOUNT);
      expect(await getVaultBorrowAmount(borrower2)).eq(normalizedBorrowAmount2);

      await advanceNMonths(18);
      await arc.core().updateIndex();

      const borrowIndex24 = await arc.core().currentBorrowIndex();
      expect(borrowIndex24).eq(
        await getBorrowIndex(indexLastUpdate, borrowIndex, INTEREST_RATE),
      );

      expect(await getVaultBorrowAmount(borrower1)).eq(BORROW_AMOUNT);

      expect(await getVaultBorrowAmount(borrower2)).eq(normalizedBorrowAmount2);
    });
  });

  describe('calculate the index for 2 years for opening and updating a position', () => {
    it('open for 1 year and borrow more after this year', async () => {
      await setupBaseVault(
        arc,
        borrower1,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );

      const originalAmtInVault = await convertPrincipal(BORROW_AMOUNT);

      await advanceNMonths(12);
      const borrowIndexFor12Months = await arc.core().currentBorrowIndex();

      await setupBaseVault(
        arc,
        borrower1,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        COLLATERAL_AMOUNT.mul(borrowIndexFor12Months),
        BORROW_AMOUNT,
      );

      const indexLastUpdate = await arc.core().indexLastUpdate();

      const expectedNormalizedAmountInVault = await convertPrincipal(
        (await denormalizeBorrowAmount(originalAmtInVault)).add(BORROW_AMOUNT),
      );

      const { normalizedBorrowedAmount, principal } = await arc.getVault(
        borrower1.address,
      );
      expect(normalizedBorrowedAmount).eq(expectedNormalizedAmountInVault);
      expect(principal).eq(BORROW_AMOUNT.mul(2));
      expect(await arc.core().normalizedTotalBorrowed()).to.eq(
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

      expect(await getVaultBorrowAmount(borrower1)).eq(
        expectedNormalizedAmountInVault,
      );
      expect(await arc.core().normalizedTotalBorrowed()).eq(
        expectedNormalizedAmountInVault,
      );
    });

    it('open for 1 year and liquidate after this year', async () => {
      const COLLATERAL_PRICE = utils.parseEther('1');
      // Sets up a basic vault
      await setupBaseVault(
        arc,
        borrower1,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );

      await stablecoin.mintShare(signers.liquidator.address, BORROW_AMOUNT);
      await approve(
        BORROW_AMOUNT,
        stablecoin.address,
        arc.coreAddress(),
        signers.liquidator,
      );
      expect(await stablecoin.balanceOf(signers.liquidator.address)).to.be.eq(
        BORROW_AMOUNT,
      );

      await advanceNYears(1);
      // Drop the price by half to make the vault under-collateralized
      const newPrice = COLLATERAL_PRICE.div(2);
      await arc.updatePrice(newPrice);
      expect(await arc.core().borrowIndex()).eq(utils.parseEther('1'));
      const {
        principal: prePrincipal,
        normalizedBorrowedAmount: preNormalizedBorrowedAmount,
      } = await arc.getVault(borrower1.address);
      expect(prePrincipal).eq(BORROW_AMOUNT);
      expect(preNormalizedBorrowedAmount).eq(BORROW_AMOUNT);
      // Liquidate vault
      await arc.liquidate(
        signers.borrower.address,
        stablecoin.address,
        getScoreProof(borrower1CreditScore, creditScoreTree),
        undefined,
        signers.liquidator,
      );

      const borrowIndexAfterLiquidation = await arc.core().borrowIndex();
      expect(borrowIndexAfterLiquidation).eq('1048790164179952000');
      expect(borrowIndexAfterLiquidation).eq(
        ONE_YEAR_IN_SECONDS.mul(INTEREST_RATE).add(BASE),
      );

      expect(await stablecoin.balanceOf(signers.liquidator.address)).to.eq(0);
      expect(
        await arc.collateral().balanceOf(signers.liquidator.address),
      ).to.eq(
        utils
          .parseUnits('500', DEFAULT_COLLATERAL_DECIMALS)
          .mul(BASE)
          .div(COLLATERAL_PRICE.div(2)),
      );
      const { principal, normalizedBorrowedAmount } = await arc.getVault(
        borrower1.address,
      );
      expect(principal).eq(0);
      expect(normalizedBorrowedAmount).eq(0);
    });

    it('open for 1 year and repay partially after this year', async () => {
      await setupBaseVault(
        arc,
        borrower1,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );
      expect(await arc.core().normalizedTotalBorrowed()).eq(BORROW_AMOUNT);

      await advanceNMonths(12);
      const borrowIndexFor12Months = await arc.core().currentBorrowIndex();

      const repayAmount = roundUpMul(
        BORROW_AMOUNT.div(2),
        borrowIndexFor12Months,
      );
      await approve(
        repayAmount,
        stablecoin.address,
        arc.coreAddress(),
        borrower1,
      );
      // repay a half accumulated debt
      await arc.repay(
        repayAmount,
        stablecoin.address,
        undefined,
        undefined,
        borrower1,
      );
      const borrowIndexAfterRepay = await arc.core().currentBorrowIndex();

      const { principal: principalRightAfterRepay } = await arc.getVault(
        borrower1.address,
      );

      const actualBorrowedAmountAfterRepay = BORROW_AMOUNT.mul(
        borrowIndexAfterRepay,
      ).div(BASE);
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
      const { normalizedBorrowedAmount, principal } = await arc.getVault(
        borrower1.address,
      );
      // principal shouldn't change, if there is no borrow/repay actions durring accumulating period
      expect(principal).eq(expectedPrincipal);
      expect(normalizedBorrowedAmount).eq(accumulatedBorrowAmount);
      expect(await arc.core().normalizedTotalBorrowed()).eq(
        BORROW_AMOUNT.div(2),
      );
    });

    it('open for 1 year and repay fully after this year', async () => {
      await setupBaseVault(
        arc,
        borrower1,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );
      expect(await arc.core().normalizedTotalBorrowed()).eq(BORROW_AMOUNT);

      await advanceNMonths(12);
      await arc.core().updateIndex();
      const borrowIndexFor12Months = await arc.core().currentBorrowIndex();

      const normalizedBorrowedAmount = roundUpMul(
        BORROW_AMOUNT,
        borrowIndexFor12Months,
      );
      expect(await getVaultBorrowAmount(borrower1)).eq(BORROW_AMOUNT);

      // mint accrued interest rate
      await stablecoin.mintShare(
        borrower1.address,
        normalizedBorrowedAmount.sub(BORROW_AMOUNT),
      );
      await approve(
        normalizedBorrowedAmount,
        stablecoin.address,
        arc.coreAddress(),
        borrower1,
      );

      // repay a whole accumulated debt
      await arc.repay(
        normalizedBorrowedAmount,
        stablecoin.address,
        undefined,
        undefined,
        borrower1,
      );
      expect(await arc.core().normalizedTotalBorrowed()).eq(0);

      await advanceNMonths(12);
      await arc.core().updateIndex();

      expect(await getVaultBorrowAmount(borrower1)).eq(0);
      expect(await arc.core().normalizedTotalBorrowed()).eq(0);
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
        signers.scoredBorrower,
        getScoreProof(borrowerBorrowLimitScore, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );

      let borrowIndex = await arc.core().borrowIndex();
      let totalBorrowed = await arc.core().normalizedTotalBorrowed();
      const normalizedBorrowed = await convertPrincipal(BORROW_AMOUNT);
      expect(totalBorrowed).to.eq(normalizedBorrowed);
      expect(await getVaultBorrowAmount(signers.scoredBorrower)).to.eq(
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
        stablecoin.address,
        getScoreProof(borrowerCreditScore, creditScoreTree),
        getScoreProof(borrowerBorrowLimitScore, creditScoreTree),
        undefined,
        signers.scoredBorrower,
      );

      totalBorrowed = await arc.core().normalizedTotalBorrowed();
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
        stablecoin.address,
        arc.coreAddress(),
        signers.scoredBorrower,
      );
      await arc.repay(
        repayAmount,
        stablecoin.address,
        getScoreProof(borrowerCreditScore, creditScoreTree),
        undefined,
        signers.scoredBorrower,
      );

      totalBorrowed = await arc.core().normalizedTotalBorrowed();
      borrowIndex = await arc.core().borrowIndex();
      expectedAmountInVault = await convertPrincipal(
        (await denormalizeBorrowAmount(expectedAmountInVault)).sub(repayAmount),
      );

      expect(await getVaultBorrowAmount(signers.scoredBorrower)).eq(
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
        await getVaultBorrowAmount(signers.scoredBorrower),
        borrowIndex,
      );

      // Owner doesn't have enough money to repay all debt because of interest rate
      await stablecoin.mintShare(
        signers.scoredBorrower.address,
        outstandingRepayAmt,
      );
      await approve(
        outstandingRepayAmt,
        stablecoin.address,
        arc.coreAddress(),
        signers.scoredBorrower,
      );
      await arc.repay(
        outstandingRepayAmt,
        stablecoin.address,
        getScoreProof(borrowerCreditScore, creditScoreTree),
        undefined,
        signers.scoredBorrower,
      );
      expect(await getVaultBorrowAmount(signers.scoredBorrower)).to.eq(0);
      expect(await arc.core().normalizedTotalBorrowed()).to.eq(0);
    });

    it('calculates the interest amount correctly for two users when a repayment happens in between', async () => {
      await arc.updateTime(1);
      await arc
        .core()
        .connect(signers.interestSetter)
        .setInterestRate(INTEREST_RATE);

      // User A opens position of 1000 tokens at $1 and $500 debt
      await arc.updateTime(2);
      await setupBaseVault(
        arc,
        signers.scoredBorrower,
        getScoreProof(borrowerBorrowLimitScore, creditScoreTree),
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
        signers.borrower,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );
      const normalizedVaultBBorrowedAmount = roundUpDiv(
        BORROW_AMOUNT,
        borrowIndex,
      );

      expect(await getVaultBorrowAmount(signers.scoredBorrower)).eq(
        normalizedVaultABorrowedAmount,
      );

      expect(await getVaultBorrowAmount(signers.borrower)).eq(
        normalizedVaultBBorrowedAmount,
      );

      expect(await arc.core().normalizedTotalBorrowed()).to.eq(
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
        stablecoin.address,
        arc.coreAddress(),
        signers.scoredBorrower,
      );
      await arc.repay(
        BORROW_AMOUNT,
        stablecoin.address,
        getScoreProof(borrowerCreditScore, creditScoreTree),
        undefined,
        signers.scoredBorrower,
      );

      const normalizedVaultABorrowedAfterRepay = await convertPrincipal(
        roundUpMul(normalizedVaultABorrowedAmount, borrowIndex).sub(
          BORROW_AMOUNT,
        ),
      );
      expect(await getVaultBorrowAmount(signers.scoredBorrower)).eq(
        normalizedVaultABorrowedAfterRepay,
      );

      expect(await getVaultBorrowAmount(signers.borrower)).eq(
        normalizedVaultBBorrowedAmount,
      );

      expect(await arc.core().normalizedTotalBorrowed()).to.eq(
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
        await getVaultBorrowAmount(signers.borrower),
        borrowIndex,
      );

      await stablecoin.mintShare(
        signers.borrower.address,
        outstandingBalance.sub(BORROW_AMOUNT),
      );
      await approve(
        outstandingBalance,
        stablecoin.address,
        arc.coreAddress(),
        signers.borrower,
      );
      await arc.repay(
        outstandingBalance,
        stablecoin.address,
        undefined,
        undefined,
        signers.borrower,
      );

      expect(await getVaultBorrowAmount(signers.scoredBorrower)).eq(
        normalizedVaultABorrowedAfterRepay,
      );

      expect(await getVaultBorrowAmount(signers.borrower));

      expect(await arc.core().normalizedTotalBorrowed()).to.eq(
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

    it('2 users borrow, meanwhile interest is set to 0', async () => {
      await arc.updateTime(0);
      await arc
        .core()
        .connect(signers.interestSetter)
        .setInterestRate(INTEREST_RATE);

      // User A opens position of 1000 tokens at $1 and $500 debt
      await arc.updateTime(2);
      await setupBaseVault(
        arc,
        signers.scoredBorrower,
        getScoreProof(borrowerBorrowLimitScore, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );
      const borrowIndex2sec = await arc.core().borrowIndex();
      expect(await arc.core().borrowIndex()).eq(
        utils.parseEther('1').add(INTEREST_RATE.mul(2)),
      );

      // Update time to 6 months and update index
      await advanceNMonths(6);

      expect(await arc.core().indexLastUpdate()).eq(2);
      expect(await arc.core().borrowIndex()).eq(borrowIndex2sec);

      // User B opens position at 1000 tokens at $1 and $500 debt
      await setupBaseVault(
        arc,
        signers.borrower,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );

      const borrowIndex6Months = await arc.core().borrowIndex();
      expect(await arc.core().indexLastUpdate()).eq(
        SECONDS_PER_MONTH.mul(6).add(2),
      );
      expect(borrowIndex6Months).eq(
        await getBorrowIndex(BigNumber.from(2), borrowIndex2sec),
      );

      await arc.core().connect(signers.interestSetter).setInterestRate(0);

      // Update time to 12 months and update index
      await advanceNMonths(6);
      await arc.core().updateIndex();

      const borrowIndex1year = await arc.core().borrowIndex();
      expect(borrowIndex1year).eq(
        await getBorrowIndex(
          SECONDS_PER_MONTH.mul(6).add(2),
          borrowIndex6Months,
          BigNumber.from(0),
        ),
      );
      expect(await arc.core().indexLastUpdate()).eq(
        SECONDS_PER_MONTH.mul(12).add(2),
      );

      const vaultA = await arc.getVault(signers.scoredBorrower.address);
      const vaultB = await arc.getVault(signers.borrower.address);
      expect(vaultA.normalizedBorrowedAmount).eq(
        roundUpDiv(BORROW_AMOUNT, borrowIndex2sec),
      );
      expect(vaultA.principal).eq(BORROW_AMOUNT);

      expect(vaultB.normalizedBorrowedAmount).eq(
        roundUpDiv(BORROW_AMOUNT, borrowIndex6Months),
      );
      expect(vaultB.principal).eq(BORROW_AMOUNT);

      expect(
        vaultB.normalizedBorrowedAmount.mul(borrowIndex1year).div(BASE),
      ).eq(BORROW_AMOUNT);
    });

    it('2 users borrow, then halfway the interest rate increases', async () => {
      await arc.updateTime(0);
      await arc
        .core()
        .connect(signers.interestSetter)
        .setInterestRate(INTEREST_RATE);

      // User A opens position of 1000 tokens at $1 and $500 debt
      await arc.updateTime(2);
      await setupBaseVault(
        arc,
        signers.scoredBorrower,
        getScoreProof(borrowerBorrowLimitScore, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );
      const borrowIndex2sec = await arc.core().borrowIndex();
      expect(await arc.core().borrowIndex()).eq(
        utils.parseEther('1').add(INTEREST_RATE.mul(2)),
      );

      // Update time to 6 months and update index
      await advanceNMonths(6);

      expect(await arc.core().indexLastUpdate()).eq(2);
      expect(await arc.core().borrowIndex()).eq(borrowIndex2sec);

      // User B opens position at 1000 tokens at $1 and $500 debt
      await setupBaseVault(
        arc,
        signers.borrower,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
      );

      const borrowIndex6Months = await arc.core().borrowIndex();
      expect(await arc.core().indexLastUpdate()).eq(
        SECONDS_PER_MONTH.mul(6).add(2),
      );
      expect(borrowIndex6Months).eq(
        await getBorrowIndex(BigNumber.from(2), borrowIndex2sec),
      );

      const newInterestRate = INTEREST_RATE.mul(2);
      await arc
        .core()
        .connect(signers.interestSetter)
        .setInterestRate(newInterestRate);

      // Update time to 12 months and update index
      await advanceNMonths(6);
      await arc.core().updateIndex();

      const borrowIndex1year = await arc.core().borrowIndex();
      expect(borrowIndex1year).eq(
        await getBorrowIndex(
          SECONDS_PER_MONTH.mul(6).add(2),
          borrowIndex6Months,
          newInterestRate,
        ),
      );
      expect(await arc.core().indexLastUpdate()).eq(
        SECONDS_PER_MONTH.mul(12).add(2),
      );

      const vaultA = await arc.getVault(signers.scoredBorrower.address);
      const vaultB = await arc.getVault(signers.borrower.address);
      expect(vaultA.normalizedBorrowedAmount).eq(
        roundUpDiv(BORROW_AMOUNT, borrowIndex2sec),
      );
      expect(vaultA.principal).eq(BORROW_AMOUNT);

      expect(vaultB.normalizedBorrowedAmount).eq(
        roundUpDiv(BORROW_AMOUNT, borrowIndex6Months),
      );
      expect(vaultB.principal).eq(BORROW_AMOUNT);

      // User A
      const borrowAmountBasedOnIndexA = vaultA.normalizedBorrowedAmount
        .mul(borrowIndex1year)
        .div(BASE);
      // We can do INTEREST_RATE.add(newInterestRate), because of same duration for these interests a * k1 + b * k1 = k1 * (a + b)
      const accumulatedInterestA = BORROW_AMOUNT.mul(
        INTEREST_RATE.add(newInterestRate),
      )
        .mul(SECONDS_PER_MONTH)
        .mul(6)
        .div(BASE);
      const borrowAmountBasedOnCalculationsA = BORROW_AMOUNT.add(
        accumulatedInterestA,
      );

      expect(borrowAmountBasedOnIndexA).gt(borrowAmountBasedOnCalculationsA);
      // divided by CALCULATION_PRECISION because of dividing loses in contract
      expect(borrowAmountBasedOnIndexA.div(BASE)).eq(
        borrowAmountBasedOnCalculationsA.div(BASE),
      );

      // User B
      const accumulatedInterestB = BORROW_AMOUNT.mul(newInterestRate)
        .mul(SECONDS_PER_MONTH)
        .mul(6)
        .div(BASE);
      const borrowAmountBasedOnIndexB = vaultB.normalizedBorrowedAmount
        .mul(borrowIndex1year)
        .div(BASE);
      const borrowAmountBasedOnCalculationsB = BORROW_AMOUNT.add(
        accumulatedInterestB,
      );
      // divided by CALCULATION_PRECISION because of dividing loses in contract
      const CALCULATION_PRECISION = utils.parseUnits('1', 7);
      expect(borrowAmountBasedOnIndexB.div(CALCULATION_PRECISION)).eq(
        borrowAmountBasedOnCalculationsB.div(CALCULATION_PRECISION),
      );
    });
  });
});
