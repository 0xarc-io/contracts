import { TestingSigners } from '@test/types/testTypes';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { approve } from '@src/utils/approve';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { getScoreProof } from '@src/utils/getScoreProof';
import {
  DEFAULT_COLLATERAL_DECIMALS,
  DEFAULT_STABLE_COIN_PRECISION_SCALAR,
} from '@test/helpers/sapphireDefaults';
import {
  CREDIT_PROOF_PROTOCOL,
  BORROW_LIMIT_PROOF_PROTOCOL,
} from '@src/constants';
import { setupBaseVault } from '@test/helpers/setupBaseVault';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';
import { roundUpMul } from '@test/helpers/roundUpOperations';
import { PassportScore } from '@arc-types/sapphireTypes';
import { PassportScoreTree } from '@src/MerkleTree';
import { TestToken } from '@src/typings';

const COLLATERAL_AMOUNT = utils.parseUnits('1000', DEFAULT_COLLATERAL_DECIMALS);
const SCALED_BORROW_AMOUNT = utils.parseEther('500');
const BORROW_AMOUNT = utils
  .parseEther('500')
  .div(DEFAULT_STABLE_COIN_PRECISION_SCALAR);
const INTEREST_RATE = BigNumber.from(1547125957);

describe('SapphireCore.exit()', () => {
  let ctx: ITestContext;

  let arc: SapphireTestArc;
  let signers: TestingSigners;
  let stablecoin: TestToken;

  let scoredBorrowerCreditScore: PassportScore;
  let scoredBorrowerBorrowLimitScore: PassportScore;
  let creditScoreTree: PassportScoreTree;

  function getCollateralBalance(user: SignerWithAddress) {
    return ctx.sdks.sapphire.collateral().balanceOf(user.address);
  }

  async function init(ctx: ITestContext) {
    scoredBorrowerCreditScore = {
      account: ctx.signers.scoredBorrower.address,
      protocol: utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
      score: BigNumber.from(500),
    };

    scoredBorrowerBorrowLimitScore = {
      account: ctx.signers.scoredBorrower.address,
      protocol: utils.formatBytes32String(BORROW_LIMIT_PROOF_PROTOCOL),
      score: SCALED_BORROW_AMOUNT.mul(2),
    };

    const liquidatorCreditScore = {
      account: ctx.signers.liquidator.address,
      protocol: utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
      score: SCALED_BORROW_AMOUNT.mul(2),
    };

    creditScoreTree = new PassportScoreTree([
      scoredBorrowerCreditScore,
      liquidatorCreditScore,
      scoredBorrowerBorrowLimitScore,
    ]);

    await setupSapphire(ctx, {
      merkleRoot: creditScoreTree.getHexRoot(),
      // Set the price to $1
      price: utils.parseEther('1'),
      poolDepositBorrowAmount: SCALED_BORROW_AMOUNT.mul(3),
    });
  }

  before(async () => {
    ctx = await generateContext(sapphireFixture, init);
    signers = ctx.signers;
    arc = ctx.sdks.sapphire;
    stablecoin = ctx.contracts.stablecoin;
  });

  addSnapshotBeforeRestoreAfterEach();

  it('reverts if user does not have enough balance to close his vault', async () => {
    await setupBaseVault(
      arc,
      signers.scoredBorrower,
      getScoreProof(scoredBorrowerBorrowLimitScore, creditScoreTree),
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      getScoreProof(scoredBorrowerCreditScore, creditScoreTree),
    );

    const stablecoinBalance = await stablecoin.balanceOf(
      signers.scoredBorrower.address,
    );

    // get rid of the remaining amount
    await stablecoin
      .connect(signers.scoredBorrower)
      .transfer(ctx.signers.admin.address, stablecoinBalance);

    const vault = await arc.getVault(signers.scoredBorrower.address);
    const remainingDebt = roundUpMul(
      vault.normalizedBorrowedAmount,
      await arc.core().currentBorrowIndex(),
    ).div(DEFAULT_STABLE_COIN_PRECISION_SCALAR);

    // Approve repay amount
    await approve(
      remainingDebt,
      stablecoin.address,
      arc.coreAddress(),
      signers.scoredBorrower,
    );

    await expect(
      arc.exit(
        stablecoin.address,
        undefined,
        undefined,
        signers.scoredBorrower,
      ),
    ).to.be.revertedWith('SafeERC20: TRANSFER_FROM_FAILED');
  });

  it('repays all the debt and returns collateral to the user', async () => {
    await setupBaseVault(
      arc,
      signers.scoredBorrower,
      getScoreProof(scoredBorrowerBorrowLimitScore, creditScoreTree),
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      getScoreProof(scoredBorrowerCreditScore, creditScoreTree),
    );

    let vault = await arc.getVault(signers.scoredBorrower.address);
    let collateralBalance = await getCollateralBalance(signers.scoredBorrower);
    let stableBalance = await stablecoin.balanceOf(
      signers.scoredBorrower.address,
    );

    expect(vault.collateralAmount).to.eq(COLLATERAL_AMOUNT);
    expect(vault.normalizedBorrowedAmount).to.eq(SCALED_BORROW_AMOUNT);
    expect(collateralBalance).to.eq(0);
    expect(stableBalance).to.eq(BORROW_AMOUNT);

    // Approve repay amount
    await approve(
      BORROW_AMOUNT,
      stablecoin.address,
      arc.coreAddress(),
      signers.scoredBorrower,
    );

    await arc.exit(
      stablecoin.address,
      getScoreProof(scoredBorrowerCreditScore, creditScoreTree),
      undefined,
      signers.scoredBorrower,
    );

    vault = await arc.getVault(signers.scoredBorrower.address);
    collateralBalance = await getCollateralBalance(signers.scoredBorrower);
    stableBalance = await stablecoin.balanceOf(signers.scoredBorrower.address);

    expect(vault.collateralAmount).to.eq(0);
    expect(vault.normalizedBorrowedAmount).to.eq(0);
    expect(collateralBalance).to.eq(COLLATERAL_AMOUNT);
    expect(stableBalance).to.eq(0);
  });

  it('reverts if exit with unsupported token', async () => {
    await setupBaseVault(
      arc,
      signers.scoredBorrower,
      getScoreProof(scoredBorrowerBorrowLimitScore, creditScoreTree),
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT, // -1 for rounding
      getScoreProof(scoredBorrowerCreditScore, creditScoreTree),
    );

    await ctx.contracts.collateral.mintShare(
      signers.scoredBorrower.address,
      SCALED_BORROW_AMOUNT,
    );

    // Approve repay amount
    await approve(
      SCALED_BORROW_AMOUNT,
      ctx.contracts.collateral.address,
      arc.coreAddress(),
      signers.scoredBorrower,
    );

    await expect(
      arc.exit(
        ctx.contracts.collateral.address,
        undefined,
        undefined,
        signers.scoredBorrower,
      ),
    ).to.be.revertedWith('SapphirePool: unknown token');
  });

  it('repays all the debt + accrued interest and returns collateral to the user', async () => {
    // set interest rate of 5%
    await arc.updateTime(1);
    await arc
      .core()
      .connect(signers.interestSetter)
      .setInterestRate(INTEREST_RATE);

    expect(await stablecoin.balanceOf(signers.scoredBorrower.address)).to.eq(0);

    await setupBaseVault(
      arc,
      signers.scoredBorrower,
      getScoreProof(scoredBorrowerBorrowLimitScore, creditScoreTree),
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      getScoreProof(scoredBorrowerCreditScore, creditScoreTree),
    );

    expect(await stablecoin.balanceOf(signers.scoredBorrower.address)).to.eq(
      BORROW_AMOUNT,
    );

    // increase time by 1 second
    await arc.updateTime(2);

    // Vault contains principal borrow amount
    let vault = await arc.getVault(signers.scoredBorrower.address);

    // Get borrow index, which will be used to calculate actual borrow amount in the core contract
    const borrowIndex = await arc.core().currentBorrowIndex();
    const actualBorrowAmount = roundUpMul(
      vault.normalizedBorrowedAmount,
      borrowIndex,
    );
    // Check actual borrowed amount, not principal one
    expect(actualBorrowAmount).to.be.gt(SCALED_BORROW_AMOUNT);
    // Approve repay amount
    await approve(
      actualBorrowAmount.div(DEFAULT_STABLE_COIN_PRECISION_SCALAR),
      stablecoin.address,
      arc.coreAddress(),
      signers.scoredBorrower,
    );

    // Try to exit but fail because user does not have enough balance due to
    // the accrued interest
    await expect(
      arc.exit(
        stablecoin.address,
        undefined,
        undefined,
        signers.scoredBorrower,
      ),
    ).to.be.revertedWith('SafeERC20: TRANSFER_FROM_FAILED');

    const accruedInterest = actualBorrowAmount.sub(SCALED_BORROW_AMOUNT);
    await stablecoin.mintShare(
      signers.scoredBorrower.address,
      accruedInterest.div(DEFAULT_STABLE_COIN_PRECISION_SCALAR),
    );

    await arc.exit(
      stablecoin.address,
      undefined,
      undefined,
      signers.scoredBorrower,
    );

    vault = await arc.getVault(signers.scoredBorrower.address);
    expect(vault.collateralAmount).to.eq(0);
    expect(vault.normalizedBorrowedAmount).to.eq(0);
  });

  it("uses SapphireArc's repay and withdraw", async () => {
    await setupBaseVault(
      arc,
      signers.scoredBorrower,
      getScoreProof(scoredBorrowerBorrowLimitScore, creditScoreTree),
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      getScoreProof(scoredBorrowerCreditScore, creditScoreTree),
    );

    await approve(
      BORROW_AMOUNT,
      stablecoin.address,
      arc.coreAddress(),
      signers.scoredBorrower,
    );

    await arc.repayAndWithdraw(
      stablecoin.address,
      BORROW_AMOUNT,
      COLLATERAL_AMOUNT,
      signers.scoredBorrower,
      undefined,
      undefined,
    );

    const vault = await arc.getVault(signers.scoredBorrower.address);
    const collateralBalance = await getCollateralBalance(
      signers.scoredBorrower,
    );
    const stableBalance = await stablecoin.balanceOf(
      signers.scoredBorrower.address,
    );

    expect(vault.collateralAmount).to.eq(0);
    expect(vault.normalizedBorrowedAmount).to.eq(0);
    expect(collateralBalance).to.eq(COLLATERAL_AMOUNT);
    expect(stableBalance).to.eq(0);
  });
});
