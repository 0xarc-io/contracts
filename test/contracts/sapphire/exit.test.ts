import { TestingSigners } from '@arc-types/testing';
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
import { PassportScore } from '@arc-types/sapphireCore';
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
  let stableCoin: TestToken;

  let scoredMinterCreditScore: PassportScore;
  let scoredMinterBorrowLimitScore: PassportScore;
  let creditScoreTree: PassportScoreTree;

  function getCollateralBalance(user: SignerWithAddress) {
    return ctx.sdks.sapphire.collateral().balanceOf(user.address);
  }

  async function init(ctx: ITestContext) {
    scoredMinterCreditScore = {
      account: ctx.signers.scoredMinter.address,
      protocol: utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
      score: BigNumber.from(500),
    };

    scoredMinterBorrowLimitScore = {
      account: ctx.signers.scoredMinter.address,
      protocol: utils.formatBytes32String(BORROW_LIMIT_PROOF_PROTOCOL),
      score: SCALED_BORROW_AMOUNT.mul(2),
    };

    const liquidatorCreditScore = {
      account: ctx.signers.liquidator.address,
      protocol: utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
      score: SCALED_BORROW_AMOUNT.mul(2),
    };

    creditScoreTree = new PassportScoreTree([
      scoredMinterCreditScore,
      liquidatorCreditScore,
      scoredMinterBorrowLimitScore,
    ]);

    await setupSapphire(ctx, {
      merkleRoot: creditScoreTree.getHexRoot(),
      // Set the price to $1
      price: utils.parseEther('1'),
      poolDepositSwapAmount: SCALED_BORROW_AMOUNT.mul(3),
    });
  }

  before(async () => {
    ctx = await generateContext(sapphireFixture, init);
    signers = ctx.signers;
    arc = ctx.sdks.sapphire;
    stableCoin = ctx.contracts.stablecoin;
  });

  addSnapshotBeforeRestoreAfterEach();

  it('reverts if user does not have enough balance to close his vault', async () => {
    await setupBaseVault(
      arc,
      signers.scoredMinter,
      getScoreProof(scoredMinterBorrowLimitScore, creditScoreTree),
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      getScoreProof(scoredMinterCreditScore, creditScoreTree),
    );

    const stablecoinBalance = await stableCoin.balanceOf(
      signers.scoredMinter.address,
    );

    // get rid of the remaining amount
    await stableCoin
      .connect(signers.scoredMinter)
      .transfer(ctx.signers.admin.address, stablecoinBalance);

    const vault = await arc.getVault(signers.scoredMinter.address);
    const remainingDebt = roundUpMul(
      vault.normalizedBorrowedAmount,
      await arc.core().currentBorrowIndex(),
    ).div(DEFAULT_STABLE_COIN_PRECISION_SCALAR);

    // Approve repay amount
    await approve(
      remainingDebt,
      stableCoin.address,
      arc.coreAddress(),
      signers.scoredMinter,
    );

    await expect(
      arc.exit(stableCoin.address, undefined, undefined, signers.scoredMinter),
    ).to.be.revertedWith('SafeERC20: TRANSFER_FROM_FAILED');
  });

  it('repays all the debt and returns collateral to the user', async () => {
    await setupBaseVault(
      arc,
      signers.scoredMinter,
      getScoreProof(scoredMinterBorrowLimitScore, creditScoreTree),
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      getScoreProof(scoredMinterCreditScore, creditScoreTree),
    );

    let vault = await arc.getVault(signers.scoredMinter.address);
    let collateralBalance = await getCollateralBalance(signers.scoredMinter);
    let stableBalance = await stableCoin.balanceOf(
      signers.scoredMinter.address,
    );

    expect(vault.collateralAmount).to.eq(COLLATERAL_AMOUNT);
    expect(vault.normalizedBorrowedAmount).to.eq(SCALED_BORROW_AMOUNT);
    expect(collateralBalance).to.eq(0);
    expect(stableBalance).to.eq(BORROW_AMOUNT);

    // Approve repay amount
    await approve(
      BORROW_AMOUNT,
      stableCoin.address,
      arc.coreAddress(),
      signers.scoredMinter,
    );

    await arc.exit(
      stableCoin.address,
      getScoreProof(scoredMinterCreditScore, creditScoreTree),
      undefined,
      signers.scoredMinter,
    );

    vault = await arc.getVault(signers.scoredMinter.address);
    collateralBalance = await getCollateralBalance(signers.scoredMinter);
    stableBalance = await stableCoin.balanceOf(signers.scoredMinter.address);

    expect(vault.collateralAmount).to.eq(0);
    expect(vault.normalizedBorrowedAmount).to.eq(0);
    expect(collateralBalance).to.eq(COLLATERAL_AMOUNT);
    expect(stableBalance).to.eq(0);
  });

  it('reverts if exit with unsupported token', async () => {
    await setupBaseVault(
      arc,
      signers.scoredMinter,
      getScoreProof(scoredMinterBorrowLimitScore, creditScoreTree),
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT, // -1 for rounding
      getScoreProof(scoredMinterCreditScore, creditScoreTree),
    );

    await arc
      .synthetic()
      .mint(signers.scoredMinter.address, SCALED_BORROW_AMOUNT);

    // Approve repay amount
    await approve(
      SCALED_BORROW_AMOUNT,
      arc.synthetic().address,
      arc.coreAddress(),
      signers.scoredMinter,
    );

    await expect(
      arc.exit(
        arc.synthetic().address,
        undefined,
        undefined,
        signers.scoredMinter,
      ),
    ).to.be.revertedWith('SapphirePool: invalid swap tokens');
  });

  it('repays all the debt + accrued interest and returns collateral to the user', async () => {
    // set interest rate of 5%
    await arc.updateTime(1);
    await arc
      .core()
      .connect(signers.interestSetter)
      .setInterestRate(INTEREST_RATE);

    expect(await stableCoin.balanceOf(signers.scoredMinter.address)).to.eq(0);

    await setupBaseVault(
      arc,
      signers.scoredMinter,
      getScoreProof(scoredMinterBorrowLimitScore, creditScoreTree),
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      getScoreProof(scoredMinterCreditScore, creditScoreTree),
    );

    expect(await stableCoin.balanceOf(signers.scoredMinter.address)).to.eq(
      BORROW_AMOUNT,
    );

    // increase time by 1 second
    await arc.updateTime(2);

    // Vault contains principal borrow amount
    let vault = await arc.getVault(signers.scoredMinter.address);

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
      stableCoin.address,
      arc.coreAddress(),
      signers.scoredMinter,
    );

    // Try to exit but fail because user does not have enough balance due to
    // the accrued interest
    await expect(
      arc.exit(stableCoin.address, undefined, undefined, signers.scoredMinter),
    ).to.be.revertedWith('SafeERC20: TRANSFER_FROM_FAILED');

    const accruedInterest = actualBorrowAmount.sub(SCALED_BORROW_AMOUNT);
    await stableCoin.mintShare(
      signers.scoredMinter.address,
      accruedInterest.div(DEFAULT_STABLE_COIN_PRECISION_SCALAR),
    );

    await arc.exit(
      stableCoin.address,
      undefined,
      undefined,
      signers.scoredMinter,
    );

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.collateralAmount).to.eq(0);
    expect(vault.normalizedBorrowedAmount).to.eq(0);
  });
});
