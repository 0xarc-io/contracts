import { CreditScore } from '@arc-types/sapphireCore';
import { TestingSigners } from '@arc-types/testing';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { approve } from '@src/utils/approve';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { getScoreProof } from '@src/utils/getScoreProof';
import { DEFAULT_COLLATERAL_DECIMALS } from '@test/helpers/sapphireDefaults';
import { setupBaseVault } from '@test/helpers/setupBaseVault';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';
import { roundUpMul } from '@test/helpers/roundUpOperations';

const COLLATERAL_AMOUNT = utils.parseUnits('1000', DEFAULT_COLLATERAL_DECIMALS);
const BORROW_AMOUNT = utils.parseEther('500');
const INTEREST_RATE = BigNumber.from(1547125957);

describe('SapphireCore.exit()', () => {
  let ctx: ITestContext;

  let arc: SapphireTestArc;
  let signers: TestingSigners;

  let scoredMinterCreditScore: CreditScore;
  let creditScoreTree: CreditScoreTree;

  function getCollateralBalance(user: SignerWithAddress) {
    return ctx.sdks.sapphire.collateral().balanceOf(user.address);
  }

  function getSynthBalance(user: SignerWithAddress) {
    return ctx.sdks.sapphire.synthetic().balanceOf(user.address);
  }

  async function init(ctx: ITestContext) {
    scoredMinterCreditScore = {
      account: ctx.signers.scoredMinter.address,
      amount: BigNumber.from(500),
    };

    const liquidatorCreditScore = {
      account: ctx.signers.liquidator.address,
      amount: BigNumber.from(500),
    };

    creditScoreTree = new CreditScoreTree([
      scoredMinterCreditScore,
      liquidatorCreditScore,
    ]);
  }

  before(async () => {
    ctx = await generateContext(sapphireFixture, init);
    signers = ctx.signers;
    arc = ctx.sdks.sapphire;

    await setupSapphire(ctx, {
      merkleRoot: creditScoreTree.getHexRoot(),
      // Set the price to $1
      price: utils.parseEther('1'),
    });
  });

  addSnapshotBeforeRestoreAfterEach();

  it('reverts if user does not have enough balance to close his vault', async () => {
    await setupBaseVault(
      arc,
      signers.scoredMinter,
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      getScoreProof(scoredMinterCreditScore, creditScoreTree),
    );

    const synthBalance = await arc
      .synthetic()
      .balanceOf(signers.scoredMinter.address);

    // burn the remaining amount
    await arc.synthetic().connect(signers.scoredMinter).burn(synthBalance);

    const vault = await arc.getVault(signers.scoredMinter.address);
    const remainingDebt = roundUpMul(
      vault.borrowedAmount,
      await arc.core().currentBorrowIndex(),
    );

    // Approve repay amount
    await approve(
      remainingDebt,
      arc.syntheticAddress(),
      arc.coreAddress(),
      signers.scoredMinter,
    );

    await expect(
      arc.exit(undefined, undefined, signers.scoredMinter),
    ).to.be.revertedWith(
      'SyntheticTokenV2: sender does not have enough balance',
    );
  });

  it('repays all the debt and returns collateral to the user', async () => {
    await setupBaseVault(
      arc,
      signers.scoredMinter,
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT, // -1 for rounding
      getScoreProof(scoredMinterCreditScore, creditScoreTree),
    );

    let vault = await arc.getVault(signers.scoredMinter.address);
    let collateralBalance = await getCollateralBalance(signers.scoredMinter);
    let synthBalance = await getSynthBalance(signers.scoredMinter);

    expect(vault.collateralAmount).to.eq(COLLATERAL_AMOUNT);
    expect(vault.borrowedAmount).to.eq(BORROW_AMOUNT);
    expect(collateralBalance).to.eq(0);
    expect(synthBalance).to.eq(BORROW_AMOUNT);

    // Approve repay amount
    await approve(
      BORROW_AMOUNT,
      arc.syntheticAddress(),
      arc.coreAddress(),
      signers.scoredMinter,
    );
    // await ctx.contracts.synthetic.tokenV2.mint(signers.scoredMinter.address, 1); // Mint 1, to account for rounding

    await arc.exit(
      getScoreProof(scoredMinterCreditScore, creditScoreTree),
      undefined,
      signers.scoredMinter,
    );

    vault = await arc.getVault(signers.scoredMinter.address);
    collateralBalance = await getCollateralBalance(signers.scoredMinter);
    synthBalance = await getSynthBalance(signers.scoredMinter);

    expect(vault.collateralAmount).to.eq(0);
    expect(vault.borrowedAmount).to.eq(0);
    expect(collateralBalance).to.eq(COLLATERAL_AMOUNT);
    expect(synthBalance).to.eq(0);
  });

  it('repays all the debt + accrued interest and returns collateral to the user', async () => {
    // set interest rate of 5%
    await arc.updateTime(1);
    await arc
      .core()
      .connect(signers.interestSetter)
      .setInterestRate(INTEREST_RATE);

    await setupBaseVault(
      arc,
      signers.scoredMinter,
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      getScoreProof(scoredMinterCreditScore, creditScoreTree),
    );

    // increase time by 1 second
    await arc.updateTime(2);

    // Vault contains principal borrow amount
    let vault = await arc.getVault(signers.scoredMinter.address);
    // Get borrow index, which will be used to calculate actual borrow amount in the core contract
    const borrowIndex = await arc.core().currentBorrowIndex();
    const actualBorrowAmount = roundUpMul(vault.borrowedAmount, borrowIndex);
    // Check actual borrowed amount, not principal one
    expect(actualBorrowAmount).to.be.gt(BORROW_AMOUNT);

    // Approve repay amount
    await approve(
      actualBorrowAmount,
      arc.syntheticAddress(),
      arc.coreAddress(),
      signers.scoredMinter,
    );
    // Try to exit but fail because user does not have enough balance due to
    // the accrued interest
    await expect(
      arc.exit(undefined, undefined, signers.scoredMinter),
    ).to.be.revertedWith(
      'SyntheticTokenV2: sender does not have enough balance',
    );

    const accruedInterest = actualBorrowAmount.sub(BORROW_AMOUNT);
    await arc
      .synthetic()
      .connect(signers.admin)
      .mint(signers.scoredMinter.address, accruedInterest);

    await arc.exit(undefined, undefined, signers.scoredMinter);

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.collateralAmount).to.eq(0);
    expect(vault.borrowedAmount).to.eq(0);
  });
});
