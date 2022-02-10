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
import { BaseERC20Factory, TestToken, TestTokenFactory } from '@src/typings';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { expect } from 'chai';
import { ONE_YEAR_IN_SECONDS } from '@src/constants';
import {
  BORROW_LIMIT_PROOF_PROTOCOL,
  DEFAULT_COLLATERAL_DECIMALS,
  DEFAULT_HIGH_C_RATIO,
  DEFAULT_LOW_C_RATIO,
  DEFAULT_PRICE,
  DEFAULT_PROOF_PROTOCOL,
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
  DEFAULT_HIGH_C_RATIO,
);
// for credit score equals 500 what is the a half of max credit score
const BORROW_AMOUNT_500_SCORE = NORMALIZED_COLLATERAL_AMOUNT.mul(
  DEFAULT_PRICE,
).div(DEFAULT_LOW_C_RATIO.add(DEFAULT_HIGH_C_RATIO).div(2));

describe('SapphireCore.borrow()', () => {
  let ctx: ITestContext;
  let arc: SapphireTestArc;
  let creditScore1: PassportScore;
  let borrowLimitScore1: PassportScore;
  let borrowLimitScore2: PassportScore;
  let minterBorrowLimitScore: PassportScore;
  let scoredMinterOtherProtoScore: PassportScore;
  let creditScore2: PassportScore;
  let creditScoreTree: PassportScoreTree;
  let scoredMinter: SignerWithAddress;
  let minter: SignerWithAddress;
  let creditScoreProof: PassportScoreProof;
  let borrowLimitProof: PassportScoreProof;
  let stableCoin: TestToken;

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
      protocol: utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
      score: BigNumber.from(500),
    };
    borrowLimitScore1 = {
      account: ctx.signers.scoredMinter.address,
      protocol: utils.formatBytes32String(BORROW_LIMIT_PROOF_PROTOCOL),
      score: BORROW_AMOUNT.mul(2),
    };
    scoredMinterOtherProtoScore = {
      ...creditScore1,
      protocol: utils.formatBytes32String('defi.other'),
    };
    creditScore2 = {
      account: ctx.signers.interestSetter.address,
      protocol: utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
      score: BigNumber.from(1000),
    };
    borrowLimitScore2 = {
      account: ctx.signers.interestSetter.address,
      protocol: utils.formatBytes32String(BORROW_LIMIT_PROOF_PROTOCOL),
      score: BORROW_AMOUNT.mul(2),
    };
    minterBorrowLimitScore = {
      account: ctx.signers.minter.address,
      protocol: utils.formatBytes32String(BORROW_LIMIT_PROOF_PROTOCOL),
      score: BORROW_AMOUNT.mul(2),
    };
    creditScoreTree = new PassportScoreTree([
      creditScore1,
      scoredMinterOtherProtoScore,
      creditScore2,
      minterBorrowLimitScore,
      borrowLimitScore1,
      borrowLimitScore2,
    ]);
    creditScoreProof = getScoreProof(creditScore1, creditScoreTree);
    borrowLimitProof = getScoreProof(borrowLimitScore1, creditScoreTree);
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
    stableCoin = ctx.contracts.stableCoin;

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
      BORROW_AMOUNT_500_SCORE,
      stableCoin.address,
      creditScoreProof,
      borrowLimitProof,
      undefined,
      scoredMinter,
    );

    const {
      collateralAmount,
      normalizedBorrowedAmount,
      principal,
    } = await arc.getVault(scoredMinter.address);

    expect(collateralAmount, 'collateral amt').eq(COLLATERAL_AMOUNT);
    expect(normalizedBorrowedAmount, 'borrow amt').eq(BORROW_AMOUNT_500_SCORE);
    expect(principal, 'principal').eq(BORROW_AMOUNT_500_SCORE);
  });

  it('borrows with the highest c-ratio if proof is not provided', async () => {
    let vault = await arc.getVault(scoredMinter.address);
    expect(vault.normalizedBorrowedAmount).to.eq(0);
    expect(vault.principal).to.eq(0);

    await arc.borrow(
      BORROW_AMOUNT,
      stableCoin.address,
      undefined,
      borrowLimitProof,
      undefined,
      scoredMinter,
    );

    vault = await arc.getVault(scoredMinter.address);
    expect(vault.normalizedBorrowedAmount).to.eq(BORROW_AMOUNT);
    expect(vault.principal).to.eq(BORROW_AMOUNT);

    await expect(
      arc.borrow(
        BigNumber.from(1),
        stableCoin.address,
        undefined,
        borrowLimitProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith(
      'SapphireCoreV1: the vault will become undercollateralized',
    );
  });

  it('reverts if borrow limit proof is not provided', async () => {
    await expect(
      arc.borrow(
        BigNumber.from(1),
        stableCoin.address,
        undefined,
        undefined,
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith('SapphireCoreV1: proof.account must match msg.sender');
  });

  it('reverts if borrow limit proof account is not msg.sender', async () => {
    await expect(
      arc.borrow(
        BORROW_AMOUNT,
        stableCoin.address,
        undefined,
        getScoreProof(borrowLimitScore1, creditScoreTree),
        undefined,
        minter,
      ),
    ).to.be.revertedWith('SapphireCoreV1: proof.account must match msg.sender');
  });

  it('borrows with exact c-ratio', async () => {
    await arc.borrow(
      BORROW_AMOUNT,
      stableCoin.address,
      undefined,
      getScoreProof(minterBorrowLimitScore, creditScoreTree),
      undefined,
      minter,
    );
    const { normalizedBorrowedAmount, principal } = await arc.getVault(
      minter.address,
    );
    expect(normalizedBorrowedAmount).eq(BORROW_AMOUNT);
    expect(principal).eq(BORROW_AMOUNT);
  });

  it('borrows more if borrow limit is increased', async () => {
    await mintAndApproveCollateral(scoredMinter, COLLATERAL_AMOUNT.mul(2));
    await arc.deposit(COLLATERAL_AMOUNT.mul(2), undefined, undefined, scoredMinter);
    await arc.borrow(
      borrowLimitScore1.score,
      stableCoin.address,
      creditScoreProof,
      borrowLimitProof,
      undefined,
      scoredMinter,
    );

    const additionalBorrowAmount = utils.parseEther('0.01');

    await expect(
      arc.borrow(
        additionalBorrowAmount,
        stableCoin.address,
        creditScoreProof,
        borrowLimitProof,
        undefined,
        scoredMinter,
      ),
      'User should not be able to borrow more',
    ).to.be.revertedWith(
      'SapphireCoreV1: total borrow amount should not exceed borrow limit',
    );

    const borrowLimitScore = {
      ...borrowLimitScore1,
      score: borrowLimitScore1.score.add(additionalBorrowAmount),
    }
    const newPassportScoreTree = new PassportScoreTree([
      creditScore1,
      creditScore2,
      borrowLimitScore,
    ]);

    await immediatelyUpdateMerkleRoot(
      ctx.contracts.sapphire.passportScores.connect(ctx.signers.interestSetter),
      newPassportScoreTree.getHexRoot(),
    );

    await arc.borrow(
      additionalBorrowAmount,
      stableCoin.address,
      getScoreProof(creditScore1, newPassportScoreTree),
      getScoreProof(borrowLimitScore, newPassportScoreTree),
      undefined,
      scoredMinter,
    );

    await expect(
      arc.borrow(
        additionalBorrowAmount,
        stableCoin.address,
        getScoreProof(creditScore1, newPassportScoreTree),
        getScoreProof(borrowLimitScore, newPassportScoreTree),
        undefined,
        scoredMinter,
      ),
      'User should not be able to borrow more',
    ).to.be.revertedWith(
      'SapphireCoreV1: total borrow amount should not exceed borrow limit',
    );
  });

  it('reverts if the credit proof protocol does not match the one registered', async () => {
    await expect(
      arc.borrow(
        BORROW_AMOUNT,
        stableCoin.address,
        getScoreProof(scoredMinterOtherProtoScore, creditScoreTree),
        borrowLimitProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith('SapphireCoreV1: incorrect credit score protocol');
  });

  it('reverts if the borrow limit proof protocol does not match the one registered', async () => {
    await expect(
      arc.borrow(
        BORROW_AMOUNT,
        stableCoin.address,
        getScoreProof(creditScore1, creditScoreTree),
        getScoreProof(creditScore1, creditScoreTree),
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith(
      'SapphireCoreV1: incorrect borrow limit proof protocol',
    );
  });

  it('reverts if not supported asset address', async () => {
    await expect(
      arc.borrow(
        BORROW_AMOUNT,
        arc.collateral().address,
        undefined,
        undefined,
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith(
      'SapphireCoreV1: the token address should be one of the supported tokens',
    );
  });

  it('reverts if borrower cross the c-ratio', async () => {
    const {
      normalizedBorrowedAmount,
      collateralAmount,
      principal,
    } = await arc.getVault(minter.address);

    expect(normalizedBorrowedAmount).eq(0);
    expect(principal).eq(0);
    expect(collateralAmount).eq(COLLATERAL_AMOUNT);

    await expect(
      arc.borrow(
        BORROW_AMOUNT.mul(10),
        stableCoin.address,
        undefined,
        getScoreProof(minterBorrowLimitScore, creditScoreTree),
        undefined,
        minter,
      ),
    ).to.be.revertedWith(
      'SapphireCoreV1: the vault will become undercollateralized',
    );
  });

  it('borrows more if more collateral is provided', async () => {
    await arc.borrow(
      BORROW_AMOUNT,
      stableCoin.address,
      undefined,
      getScoreProof(minterBorrowLimitScore, creditScoreTree),
      undefined,
      minter,
    );
    const { normalizedBorrowedAmount, principal } = await arc.getVault(
      minter.address,
    );

    expect(principal).eq(BORROW_AMOUNT);
    expect(normalizedBorrowedAmount).eq(BORROW_AMOUNT);
    await expect(
      arc.borrow(
        BORROW_AMOUNT,
        stableCoin.address,
        undefined,
        getScoreProof(minterBorrowLimitScore, creditScoreTree),
        undefined,
        minter,
      ),
    ).to.be.reverted;

    await mintAndApproveCollateral(minter);

    await arc.deposit(COLLATERAL_AMOUNT, undefined, undefined, minter);
    /**
     * -1 because of rounding.
     * The contract will calculate the c-ratio to 199.99..% otherwise and the tx will
     * be reverted
     */
    await arc.borrow(
      BORROW_AMOUNT,
      stableCoin.address,
      undefined,
      getScoreProof(minterBorrowLimitScore, creditScoreTree),
      undefined,
      minter,
    );
    const {
      normalizedBorrowedAmount: updatedBorrowedAmount,
      principal: updatedPrincipal,
    } = await arc.getVault(minter.address);

    expect(updatedBorrowedAmount).eq(BORROW_AMOUNT.mul(2));
    expect(updatedPrincipal).eq(BORROW_AMOUNT.mul(2));
  });

  it('borrows more if a valid score proof is provided', async () => {
    // With the credit score user can borrow more than amount based default collateral ratio
    await arc.borrow(
      BORROW_AMOUNT_500_SCORE,
      stableCoin.address,
      creditScoreProof,
      borrowLimitProof,
      undefined,
      scoredMinter,
    );

    const { normalizedBorrowedAmount, principal } = await arc.getVault(
      scoredMinter.address,
    );

    expect(normalizedBorrowedAmount).eq(BORROW_AMOUNT_500_SCORE);
    expect(principal).eq(BORROW_AMOUNT_500_SCORE);
  });

  it('borrows more if the credit score increases', async () => {
    // The user's existing credit score is updated and increases letting them borrow more
    await arc.borrow(
      BORROW_AMOUNT_500_SCORE,
      stableCoin.address,
      creditScoreProof,
      borrowLimitProof,
      undefined,
      scoredMinter,
    );

    const additionalBorrowAmount = utils.parseEther('0.01');

    // Borrowing BASE rather than BigNumber.from(1), because that number is too small adn won't cause a reversal
    // due to rounding margins
    await expect(
      arc.borrow(
        additionalBorrowAmount,
        stableCoin.address,
        creditScoreProof,
        borrowLimitProof,
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
      protocol: utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
      score: BigNumber.from(800),
    };
    const newPassportScoreTree = new PassportScoreTree([
      creditScore,
      creditScore2,
      borrowLimitScore1,
    ]);

    await immediatelyUpdateMerkleRoot(
      ctx.contracts.sapphire.passportScores.connect(ctx.signers.interestSetter),
      newPassportScoreTree.getHexRoot(),
    );

    await arc.borrow(
      additionalBorrowAmount,
      stableCoin.address,
      getScoreProof(creditScore, newPassportScoreTree),
      getScoreProof(borrowLimitScore1, newPassportScoreTree),
      undefined,
      scoredMinter,
    );

    const {
      normalizedBorrowedAmount: vaultBorrowAmount,
      principal,
    } = await arc.getVault(scoredMinter.address);
    const expectedVaultBorrowAmt = await convertPrincipal(
      (await denormalizeBorrowAmount(BORROW_AMOUNT_500_SCORE)).add(
        additionalBorrowAmount,
      ),
    );
    expect(vaultBorrowAmount).eq(expectedVaultBorrowAmt);
    expect(principal).eq(BORROW_AMOUNT_500_SCORE.add(additionalBorrowAmount));
  });

  it('borrows less if the credit score decreases', async () => {
    // The user's existing credit score is updated and decreases letting them borrow less

    // Prepare the new root hash with the decreased credit score for minter
    const creditScore = {
      account: scoredMinter.address,
      protocol: utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
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
        BORROW_AMOUNT_500_SCORE,
        stableCoin.address,
        getScoreProof(creditScore, newPassportScoreTree),
        borrowLimitProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith(
      'SapphireCoreV1: the vault will become undercollateralized',
    );
  });

  it('updates the total borrowed amount correctly', async () => {
    await arc.borrow(
      BORROW_AMOUNT_500_SCORE,
      stableCoin.address,
      creditScoreProof,
      borrowLimitProof,
      undefined,
      scoredMinter,
    );

    const { normalizedBorrowedAmount } = await arc.getVault(
      scoredMinter.address,
    );

    expect(normalizedBorrowedAmount).eq(BORROW_AMOUNT_500_SCORE);
    expect(await ctx.contracts.sapphire.core.totalBorrowed()).eq(
      BORROW_AMOUNT_500_SCORE,
    );

    await arc.deposit(
      COLLATERAL_AMOUNT,
      undefined,
      undefined,
      ctx.signers.minter,
    );

    await arc.borrow(
      BORROW_AMOUNT,
      stableCoin.address,
      undefined,
      getScoreProof(minterBorrowLimitScore, creditScoreTree),
      undefined,
      ctx.signers.minter,
    );
    expect(await ctx.contracts.sapphire.core.totalBorrowed()).eq(
      BORROW_AMOUNT_500_SCORE.add(BORROW_AMOUNT),
    );
  });

  it(`should not borrow if the price from the oracle is 0`, async () => {
    await ctx.contracts.sapphire.oracle.setPrice(0);
    await expect(
      arc.borrow(
        BORROW_AMOUNT,
        stableCoin.address,
        creditScoreProof,
        borrowLimitProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith('SapphireCoreV1: the oracle returned a price of 0');
  });

  it('should not borrow more if the c-ratio is at the minimum', async () => {
    await arc.borrow(
      BORROW_AMOUNT,
      stableCoin.address,
      undefined,
      getScoreProof(minterBorrowLimitScore, creditScoreTree),
      undefined,
      minter,
    );
    const { normalizedBorrowedAmount } = await arc.getVault(minter.address);
    expect(normalizedBorrowedAmount).eq(BORROW_AMOUNT);
    await expect(
      arc.borrow(
        utils.parseEther('0.01'),
        stableCoin.address,
        undefined,
        getScoreProof(minterBorrowLimitScore, creditScoreTree),
        undefined,
        minter,
      ),
    ).to.be.revertedWith(
      'SapphireCoreV1: the vault will become undercollateralized',
    );
  });

  it('should not borrow more if the price decreases', async () => {
    await arc.borrow(
      BORROW_AMOUNT_500_SCORE.div(2),
      stableCoin.address,
      creditScoreProof,
      borrowLimitProof,
      undefined,
      scoredMinter,
    );
    await arc.borrow(
      BORROW_AMOUNT_500_SCORE.div(4),
      stableCoin.address,
      creditScoreProof,
      borrowLimitProof,
      undefined,
      scoredMinter,
    );
    await arc.updatePrice(utils.parseEther('0.99'));
    await expect(
      arc.borrow(
        BORROW_AMOUNT_500_SCORE.div(4),
        stableCoin.address,
        creditScoreProof,
        borrowLimitProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith(
      'SapphireCoreV1: the vault will become undercollateralized',
    );
  });

  it(`should not borrow if using someone else's score proof`, async () => {
    await arc.borrow(
      BORROW_AMOUNT_500_SCORE,
      stableCoin.address,
      creditScoreProof,
      borrowLimitProof,
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
        stableCoin.address,
        interestSetterScoreProof,
        undefined,
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
      stableCoin.address,
      creditScoreProof,
      borrowLimitProof,
      undefined,
      scoredMinter,
    );
    const { normalizedBorrowedAmount, principal } = await arc.getVault(
      scoredMinter.address,
    );
    expect(normalizedBorrowedAmount).eq(firstBorrowAmount);
    expect(principal).eq(firstBorrowAmount);

    const currentTimeStamp = await arc.core().currentTimestamp();
    await arc
      .core()
      .connect(ctx.signers.interestSetter)
      .setInterestRate('21820606488');
    await arc.updateTime(currentTimeStamp.add(ONE_YEAR_IN_SECONDS));

    await expect(
      arc.borrow(
        BORROW_AMOUNT,
        stableCoin.address,
        creditScoreProof,
        borrowLimitProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith(
      'SapphireCoreV1: the vault will become undercollateralized',
    );
  });

  it('should not borrow more than the proof borrow limit', async () => {
    await mintAndApproveCollateral(scoredMinter, COLLATERAL_AMOUNT);
    await arc.deposit(COLLATERAL_AMOUNT, undefined, undefined, scoredMinter);
    const borrowAmount = BigNumber.from(borrowLimitProof.score).add(1);
    await expect(
      arc.borrow(
        borrowAmount,
        stableCoin.address,
        creditScoreProof,
        borrowLimitProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith(
      'SapphireCoreV1: total borrow amount should not exceed borrow limit',
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
        stableCoin.address,
        creditScoreProof,
        borrowLimitProof,
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
      stableCoin.address,
      creditScoreProof,
      borrowLimitProof,
      undefined,
      scoredMinter,
    );
    await expect(
      arc.borrow(
        BORROW_AMOUNT.div(2).add(1),
        stableCoin.address,
        creditScoreProof,
        borrowLimitProof,
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
      arc.borrow(
        BORROW_AMOUNT,
        stableCoin.address,
        creditScoreProof,
        borrowLimitProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith('SapphireCoreV1: the contract is paused');
  });

  it('should not borrow if the collateral price is stale', async () => {
    const now = BigNumber.from(Date.now());

    // Set the core timestamp to now
    await arc.updateTime(now);

    // Set the oracle timestamp to > half a day
    await arc.setOracleTimestamp(now.sub(60 * 60 * 12 + 1));

    await expect(
      arc.borrow(
        BORROW_AMOUNT,
        stableCoin.address,
        creditScoreProof,
        borrowLimitProof,
        undefined,
        scoredMinter,
      ),
    ).to.be.revertedWith('SapphireCoreV1: the oracle has stale prices');
  });

  it('emits ActionsOperated event when a borrow occurs', async () => {
    await expect(
      arc.borrow(
        BORROW_AMOUNT,
        stableCoin.address,
        creditScoreProof,
        borrowLimitProof,
        undefined,
        scoredMinter,
      ),
    ).to.emit(arc.core(), 'ActionsOperated');
    // .withArgs([[BORROW_AMOUNT, 2]], creditScoreProof, scoredMinter.address);
  });
});
