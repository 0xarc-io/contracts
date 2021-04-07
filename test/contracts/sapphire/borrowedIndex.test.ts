/**
 * This file contains integration tests regarding the calculation of the interest
 * on the borrowed amounts. An accompanying Google Sheet can be found at
 * https://docs.google.com/spreadsheets/d/1rmFbUxnM4gyi1xhcYKBwcdadvXrHBPKbeX7DLk8KQgE
 * at the "Borrow index" tab
 */

import { CreditScore } from '@arc-types/sapphireCore';
import { TestingSigners } from '@arc-types/testing';
import { BASE } from '@src/constants';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { TestTokenFactory } from '@src/typings';
import { getScoreProof } from '@src/utils/getScoreProof';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber, BigNumberish, constants, utils } from 'ethers';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

const COLLATERAL_AMOUNT = utils.parseEther('1000');
const BORROW_AMOUNT = utils.parseEther('500');
const COLLATERAL_PRICE = utils.parseEther('1');

const SECONDS_PER_MONTH = BigNumber.from(30 * 24 * 60 * 60);
const SECONDS_PER_YEAR = BigNumber.from(365 * 24 * 60 * 60);

describe('borrowed index (integration)', () => {
  let arc: SapphireTestArc;
  let signers: TestingSigners;
  let minterCreditScore: CreditScore;
  let creditScoreTree: CreditScoreTree;

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
      lowCollateralRatio: constants.WeiPerEther.mul(2),
      highCollateralRatio: constants.WeiPerEther.mul(2),
      merkleRoot: creditScoreTree.getHexRoot(),
    });
  }

  /**
   * Returns the converted principal, as calculated by the smart contract:
   * `principal * BASE / borrowIndex`
   * @param principal principal amount to convert
   */
  async function convertPrincipal(principal: BigNumber) {
    const borrowIndex = (await arc.core().borrowIndex()).add(BASE);
    return principal.mul(BASE).div(borrowIndex);
  }

  /**
   * Advance the time by n years
   * @param years number of months to advance the time by
   */
  async function advanceNYears(years: BigNumberish) {
    return arc.updateTime((await arc.core().currentTimestamp()).add(SECONDS_PER_YEAR.mul(years)));
  }

  /**
   * Advance the time by n months
   * @param months number of months to advance the time by
   */
  async function advanceNMonths(months: BigNumberish) {
    return arc.updateTime((await arc.core().currentTimestamp()).add(SECONDS_PER_MONTH.mul(months)));
  }

  /**
   * Sets up a basic vault using the `COLLATERAL_AMOUNT` amount at a price of `COLLATERAL_PRICE`
   * and a debt of `DEBT_AMOUNT` as defaults amounts
   */
  async function setupBaseVault(
    signer = signers.scoredMinter,
    scoreProof = getScoreProof(minterCreditScore, creditScoreTree),
  ) {
    const collateralContract = TestTokenFactory.connect(arc.collateral().address, signer);

    await collateralContract.mintShare(signer.address, COLLATERAL_AMOUNT);
    await collateralContract.approve(arc.core().address, COLLATERAL_AMOUNT);

    // Set collateral price
    await arc.updatePrice(COLLATERAL_PRICE);

    // Open vault and mint debt
    await arc.open(COLLATERAL_AMOUNT, BORROW_AMOUNT, scoreProof, undefined, signer);
  }

  before(async () => {
    const ctx = await generateContext(sapphireFixture, init);
    signers = ctx.signers;
    arc = ctx.sdks.sapphire;
  });

  addSnapshotBeforeRestoreAfterEach();

  // Scenario 1 in the Google SpreadSheet (see link at the top of this file)
  it.only('calculates the interest amount correctly for one user', async () => {
    await arc.updateTime(1);

    // Set interest rate for a 5% APY. Calculated using
    // https://www.wolframalpha.com/input/?i=31536000th+root+of+1.05
    const interestRate = BigNumber.from(1547125957);
    await arc.core().setInterestRate(interestRate);

    // User A opens position of n tokens and $500 debt
    await arc.updateTime(2);
    await setupBaseVault();

    let totalBorrowed = await arc.core().totalBorrowed();
    let vault = await arc.getVault(signers.scoredMinter.address);
    expect(totalBorrowed).to.eq(utils.parseEther('500'));
    expect(vault.borrowedAmount.value).to.eq(utils.parseEther('500'));

    // Update time to 6 months
    await advanceNMonths(6);
    await arc.core().updateIndex();

    // Borrow $100 more
    await arc.borrow(
      utils.parseEther('100'),
      getScoreProof(minterCreditScore, creditScoreTree),
      undefined,
      signers.scoredMinter,
    );

    totalBorrowed = await arc.core().totalBorrowed();
    vault = await arc.getVault(signers.scoredMinter.address);
    const convertedPrincipal100 = await convertPrincipal(utils.parseEther('100'));
    let expectedAmtInVault = utils.parseEther('500').add(convertedPrincipal100);

    expect(totalBorrowed).to.eq(expectedAmtInVault);

    // Update time to 3 months
    await advanceNMonths(3);
    await arc.core().updateIndex();

    // Repay principal of $600
    await arc.repay(
      utils.parseEther('600'),
      getScoreProof(minterCreditScore, creditScoreTree),
      undefined,
      signers.scoredMinter,
    );

    totalBorrowed = await arc.core().totalBorrowed();
    vault = await arc.getVault(signers.scoredMinter.address);
    expectedAmtInVault = await convertPrincipal(
      utils
        .parseEther('500') // initial amount - not converted because the borrow index was 1 at the time
        .add(convertedPrincipal100) // newly added amount - converted
        .mul((await arc.core().borrowIndex()).add(BASE)) // convert amount to real amount + interest
        .sub(utils.parseEther('600')), // the amount repaid
    ); // convert it back because we only store converted amounts in vaults
    expect(totalBorrowed).to.eq(vault.borrowedAmount.value);

    // Update time to 3 months
    await advanceNMonths(3);
    await arc.core().updateIndex();

    // Repay remaining interest
    vault = await arc.getVault(signers.scoredMinter.address);
    const outstandingRepayAmt = vault.borrowedAmount.value.mul(
      (await arc.core().borrowIndex()).add(BASE),
    );

    await arc.repay(
      outstandingRepayAmt,
      getScoreProof(minterCreditScore, creditScoreTree),
      undefined,
      signers.scoredMinter,
    );

    totalBorrowed = await arc.core().totalBorrowed();
    vault = await arc.getVault(signers.scoredMinter.address);
    expect(totalBorrowed).to.eq(0);
    expect(vault.borrowedAmount.value).to.eq(0);
  });

  it('calculates the interest amount correctly for two users when a repayment happens in between', async () => {
    await arc.updateTime(1);

    // Set interest rate for a 5% APY. Calculated using
    // https://www.wolframalpha.com/input/?i=31536000th+root+of+1.05
    const interestRate = BigNumber.from(1547125957);
    await arc.core().setInterestRate(interestRate);

    // User A opens position of 1000 tokens at $1 and $500 debt
    await arc.updateTime(2);
    await setupBaseVault();

    // Update time to 6 months and update index
    await advanceNMonths(6);
    await arc.core().updateIndex();

    // User B opens position at 1000 tokens at $1 and $500 debt
    await setupBaseVault(signers.minter, null);

    let vaultA = await arc.getVault(signers.scoredMinter.address);
    let vaultB = await arc.getVault(signers.minter.address);
    let totalBorrowed = await arc.core().totalBorrowed();
    expect(totalBorrowed).to.eq(vaultA.borrowedAmount.value.add(vaultB.borrowedAmount.value));

    // Update time to 3 months and update index
    await advanceNMonths(3);
    await arc.core().updateIndex();

    // User A repays his initial debt ($500). His vault should contain the accumulated interest
    await arc.repay(
      utils.parseEther('500'),
      getScoreProof(minterCreditScore, creditScoreTree),
      undefined,
      signers.scoredMinter,
    );

    vaultA = await arc.getVault(signers.scoredMinter.address);
    vaultB = await arc.getVault(signers.minter.address);
    totalBorrowed = await arc.core().totalBorrowed();
    expect(totalBorrowed).to.eq(vaultA.borrowedAmount.value.add(vaultB.borrowedAmount.value));

    // Update time to 3 months and update index
    await advanceNMonths(3);
    await arc.core().updateIndex();

    // User B repays his entire debt and interest
    vaultB = await arc.getVault(signers.minter.address);
    const outstandingBalance = vaultB.borrowedAmount.value.mul(
      (await arc.core().borrowIndex()).add(BASE),
    );

    await arc.repay(outstandingBalance, undefined, undefined, signers.minter);

    vaultA = await arc.getVault(signers.scoredMinter.address);
    vaultB = await arc.getVault(signers.minter.address);
    totalBorrowed = await arc.core().totalBorrowed();
    expect(totalBorrowed).to.eq(vaultA.borrowedAmount.value.add(vaultB.borrowedAmount.value));
    expect(vaultB.borrowedAmount.value).to.eq(0);

    // Update time to 1 month and update index
    await advanceNMonths(1);
    await arc.core().updateIndex();

    // User A should just have the accumulated interest,
    // which is equal to the totalBorrowed amount of the system
  });

  // TODO develop spreadsheet scenarios for the following cases:
  // it.skip('2 users borrow, then interest is set to 0');
  // it.skip('3 users borrow, then halfway the interest rate increases');
  // it.skip('2 users borrow, then one is liquidated');
  // it.skip('User repays more than the debt amount');
});
