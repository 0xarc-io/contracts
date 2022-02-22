import { PassportScore, PassportScoreProof } from '@arc-types/sapphireCore';
import { TestingSigners } from '@arc-types/testing';
import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { PassportScoreTree } from '@src/MerkleTree';
import { SapphireTestArc } from '@src/SapphireTestArc';
import {
  SapphirePool,
  SyntheticTokenV2,
  TestToken,
  TestTokenFactory,
} from '@src/typings';
import { getScoreProof } from '@src/utils/getScoreProof';
import { roundUpMul } from '@test/helpers/roundUpOperations';
import {
  DEFAULT_COLLATERAL_DECIMALS,
  DEFAULT_COLLATERAL_PRECISION_SCALAR,
  DEFAULT_HIGH_C_RATIO,
  DEFAULT_STABLECOIN_DECIMALS,
  DEFAULT_STABLE_COIN_PRECISION_SCALAR,
} from '@test/helpers/sapphireDefaults';
import {
  CREDIT_PROOF_PROTOCOL,
  BORROW_LIMIT_PROOF_PROTOCOL,
} from '@src/constants';
import { setupBaseVault } from '@test/helpers/setupBaseVault';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { constants, utils } from 'ethers';
import 'module-alias/register';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

const SCALED_COLLATERAL_AMOUNT = utils.parseEther('1000');
const COLLATERAL_AMOUNT = utils.parseUnits('1000', DEFAULT_COLLATERAL_DECIMALS);
const COLLATERAL_PRICE = utils.parseEther('1');
const SCALED_BORROW_AMOUNT = SCALED_COLLATERAL_AMOUNT.mul(COLLATERAL_PRICE).div(
  DEFAULT_HIGH_C_RATIO,
);
const BORROW_AMOUNT = SCALED_BORROW_AMOUNT.div(
  DEFAULT_STABLE_COIN_PRECISION_SCALAR,
);

/**
 * The repay function allows a user to repay the STABLEx debt. This function, withdraw and liquidate
 * have the credit proof as optional since we never want to lock users from pulling out their funds.
 * Our front-end will always send the proof but in the case that it can't, users can still repay
 * and withdraw directly.
 */
describe('SapphireCore.repay()', () => {
  let arc: SapphireTestArc;
  let pool: SapphirePool;
  let creds: SyntheticTokenV2;
  let stablecoin: TestToken;

  let signers: TestingSigners;
  let minterCreditScore: PassportScore;
  let minterBorrowLimitScore: PassportScore;
  let creditScoreTree: PassportScoreTree;

  async function repay(
    amount: BigNumber,
    caller: SignerWithAddress,
    repayAsset = stablecoin,
    scoreProof?: PassportScoreProof,
  ) {
    await repayAsset.connect(caller).approve(arc.coreAddress(), amount);

    return arc.repay(amount, repayAsset.address, scoreProof, undefined, caller);
  }

  async function init(ctx: ITestContext) {
    minterCreditScore = {
      account: ctx.signers.scoredMinter.address,
      protocol: utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
      score: BigNumber.from(500),
    };
    const creditScore2 = {
      account: ctx.signers.interestSetter.address,
      protocol: utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
      score: BigNumber.from(20),
    };
    minterBorrowLimitScore = {
      account: ctx.signers.scoredMinter.address,
      protocol: utils.formatBytes32String(BORROW_LIMIT_PROOF_PROTOCOL),
      score: SCALED_BORROW_AMOUNT,
    };
    creditScoreTree = new PassportScoreTree([
      minterCreditScore,
      creditScore2,
      minterBorrowLimitScore,
    ]);

    await setupSapphire(ctx, {
      merkleRoot: creditScoreTree.getHexRoot(),
      price: COLLATERAL_PRICE,
      poolDepositSwapAmount: SCALED_BORROW_AMOUNT.mul(3),
    });
  }

  before(async () => {
    const ctx = await generateContext(sapphireFixture, init);
    signers = ctx.signers;
    arc = ctx.sdks.sapphire;
    stablecoin = ctx.contracts.stablecoin;
    pool = ctx.contracts.sapphire.pool;
    creds = ctx.contracts.synthetic.tokenV2;

    await setupBaseVault(
      ctx.sdks.sapphire,
      ctx.signers.scoredMinter,
      getScoreProof(minterBorrowLimitScore, creditScoreTree),
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      getScoreProof(minterCreditScore, creditScoreTree),
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  it('repays to increase the c-ratio', async () => {
    let vault = await arc.getVault(signers.scoredMinter.address);
    // Confirm c-ratio of 200%
    let cRatio = vault.collateralAmount
      .mul(DEFAULT_COLLATERAL_PRECISION_SCALAR)
      .mul(COLLATERAL_PRICE)
      .div(vault.normalizedBorrowedAmount);
    expect(cRatio).to.eq(constants.WeiPerEther.mul(2));

    const preStableBalance = await stablecoin.balanceOf(
      signers.scoredMinter.address,
    );
    expect(preStableBalance).to.eq(BORROW_AMOUNT);

    // Repay half the amount
    await repay(BORROW_AMOUNT.div(2), signers.scoredMinter);

    const postStableBalance = await stablecoin.balanceOf(
      signers.scoredMinter.address,
    );
    expect(postStableBalance).to.eq(BORROW_AMOUNT.div(2));

    vault = await arc.getVault(signers.scoredMinter.address);

    // Ensure that collateral amount didn't change
    expect(vault.collateralAmount).to.eq(COLLATERAL_AMOUNT);

    expect(vault.normalizedBorrowedAmount).to.eq(SCALED_BORROW_AMOUNT.div(2));
    expect(vault.principal).to.eq(SCALED_BORROW_AMOUNT.div(2));
    /**
     * Collateral = 1000
     * Borrow amt = 500/2 = 250
     * C-ratio = 1000/250 = 400%
     */
    cRatio = vault.collateralAmount
      .mul(DEFAULT_COLLATERAL_PRECISION_SCALAR)
      .mul(COLLATERAL_PRICE)
      .div(vault.normalizedBorrowedAmount);
    expect(cRatio).to.eq(constants.WeiPerEther.mul(4));
  });

  it('repays twice with two different stablecoins', async () => {
    const testDai = await new TestTokenFactory(signers.admin).deploy(
      'TDAI',
      'TDAI',
      18,
    );
    await pool.setDepositLimit(testDai.address, SCALED_BORROW_AMOUNT);
    await testDai.mintShare(pool.address, SCALED_BORROW_AMOUNT);

    await testDai.mintShare(signers.scoredMinter.address, SCALED_BORROW_AMOUNT);

    let vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.normalizedBorrowedAmount).eq(SCALED_BORROW_AMOUNT);

    await repay(BORROW_AMOUNT.div(2), signers.scoredMinter, stablecoin);

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.normalizedBorrowedAmount).eq(SCALED_BORROW_AMOUNT.div(2));

    await repay(SCALED_BORROW_AMOUNT.div(2), signers.scoredMinter, testDai);

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.normalizedBorrowedAmount).eq(0);
  });

  it('repays with 6 decimals stablecoin');

  it('swaps stables for creds, then burns the creds, (no interest accumulated)', async () => {
    expect(await creds.balanceOf(pool.address)).to.eq(SCALED_BORROW_AMOUNT);

    await expect(repay(BORROW_AMOUNT.div(2), signers.scoredMinter, stablecoin))
      .to.emit(creds, 'Transfer')
      .withArgs(
        arc.core().address,
        constants.AddressZero,
        SCALED_BORROW_AMOUNT.div(2),
      );
    expect(await creds.balanceOf(pool.address)).to.eq(
      SCALED_BORROW_AMOUNT.div(2),
    );

    await expect(repay(BORROW_AMOUNT.div(2), signers.scoredMinter, stablecoin))
      .to.emit(creds, 'Transfer')
      .withArgs(
        arc.core().address,
        constants.AddressZero,
        SCALED_BORROW_AMOUNT.div(2),
      );
    expect(await creds.balanceOf(pool.address)).to.eq(0);
  });

  it('distributes the interest, without executing a swap, when only interest is paid', async () => {
    const poolShare = utils.parseEther('0.4');
    const borrowFee = utils.parseEther('0.1');

    expect(await creds.balanceOf(pool.address)).eq(SCALED_BORROW_AMOUNT);

    await arc.core().setFees(0, 0, borrowFee, poolShare);
    await arc.core().setLimits(0, SCALED_BORROW_AMOUNT, SCALED_BORROW_AMOUNT);

    await setupBaseVault(
      arc,
      signers.staker,
      undefined,
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      undefined,
    );

    // There is already one vault open by the scoredMinter
    expect(await creds.balanceOf(pool.address)).eq(SCALED_BORROW_AMOUNT.mul(2));
    expect(await stablecoin.balanceOf(await arc.core().feeCollector())).eq(0);

    const scaledInterest = roundUpMul(SCALED_BORROW_AMOUNT, borrowFee);
    let vault = await arc.getVault(signers.staker.address);
    expect(vault.normalizedBorrowedAmount).eq(
      SCALED_BORROW_AMOUNT.add(scaledInterest),
    );
    expect(vault.principal).eq(SCALED_BORROW_AMOUNT);

    // Pay only interest
    const preRepayStablePoolBalance = await stablecoin.balanceOf(pool.address);
    await repay(
      scaledInterest.div(DEFAULT_STABLE_COIN_PRECISION_SCALAR),
      signers.staker,
    );

    vault = await arc.getVault(signers.staker.address);
    const expectedPoolProfit = roundUpMul(scaledInterest, poolShare);
    const expectedArcProfit = scaledInterest.sub(expectedPoolProfit);

    // Vault amount reduced by interest, principal remained unchanged
    expect(vault.normalizedBorrowedAmount).eq(SCALED_BORROW_AMOUNT);
    expect(vault.principal).eq(SCALED_BORROW_AMOUNT);
    // The creds amount didn't change
    expect(await creds.balanceOf(pool.address)).eq(SCALED_BORROW_AMOUNT.mul(2));
    expect(await stablecoin.balanceOf(pool.address)).eq(
      preRepayStablePoolBalance.add(
        expectedPoolProfit.div(DEFAULT_STABLE_COIN_PRECISION_SCALAR),
      ),
    );
    expect(await stablecoin.balanceOf(await arc.core().feeCollector())).eq(
      expectedArcProfit.div(DEFAULT_STABLE_COIN_PRECISION_SCALAR),
    );
  });
  // 1499999999902000000000
  // 1499999999900020000000
  it('distributes the interest, then swaps stables for creds for the remaining amount', async () => {
    const poolShare = utils.parseEther('0.4');
    const borrowFee = utils.parseEther('0.1');
    const interest = roundUpMul(SCALED_BORROW_AMOUNT, borrowFee);

    // there is already one opened vault
    expect(await creds.balanceOf(pool.address)).eq(SCALED_BORROW_AMOUNT);

    await arc.core().setFees(0, 0, borrowFee, poolShare);
    await arc.core().setLimits(0, SCALED_BORROW_AMOUNT, SCALED_BORROW_AMOUNT);
    await setupBaseVault(
      arc,
      signers.staker,
      undefined,
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      undefined,
    );

    let vault = await arc.getVault(signers.staker.address);
    expect(vault.normalizedBorrowedAmount).eq(
      SCALED_BORROW_AMOUNT.add(interest),
    );
    expect(vault.principal).eq(SCALED_BORROW_AMOUNT);

    const repayAmount = BORROW_AMOUNT.div(2);
    const principalRepayed = repayAmount
      .mul(DEFAULT_STABLE_COIN_PRECISION_SCALAR)
      .sub(interest);
    const totalAccumulatedDebt = SCALED_BORROW_AMOUNT.add(interest);

    expect(await creds.balanceOf(pool.address)).eq(SCALED_BORROW_AMOUNT.mul(2));

    await repay(repayAmount, signers.staker);

    // Only the principal paid is swapped out for creds
    expect(await creds.balanceOf(pool.address)).eq(
      SCALED_BORROW_AMOUNT.mul(2).sub(principalRepayed),
    );

    vault = await arc.getVault(signers.staker.address);
    expect(vault.normalizedBorrowedAmount).eq(
      totalAccumulatedDebt.sub(
        repayAmount.mul(DEFAULT_STABLE_COIN_PRECISION_SCALAR),
      ),
    );
    expect(vault.principal).eq(SCALED_BORROW_AMOUNT.sub(principalRepayed));
  });

  it('decreases the user principal by the repay amount', async () => {
    let vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.principal).eq(SCALED_BORROW_AMOUNT);

    await repay(BORROW_AMOUNT.div(2), signers.scoredMinter);

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.principal).eq(SCALED_BORROW_AMOUNT.div(2));

    await repay(BORROW_AMOUNT.div(2), signers.scoredMinter);

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.principal).eq(0);
  });

  it('repays to make the position collateralized', async () => {
    /**
     * Drop the price to make the position undercollateralized.
     * The new c-ratio is 1000 * 0.45 / 500 = 90%
     */
    const newPrice = utils.parseEther('0.45');
    await arc.updatePrice(newPrice);

    // Ensure position is undercollateralized
    const vault = await arc.getVault(signers.scoredMinter.address);
    let cRatio = vault.collateralAmount
      .mul(DEFAULT_COLLATERAL_PRECISION_SCALAR)
      .mul(newPrice)
      .div(SCALED_BORROW_AMOUNT);

    expect(cRatio).to.eq(utils.parseEther('0.9'));

    // Repay to make the position collateralized
    await repay(BORROW_AMOUNT.div(2), signers.scoredMinter);

    const { collateralAmount, normalizedBorrowedAmount } = await arc.getVault(
      signers.scoredMinter.address,
    );
    cRatio = collateralAmount
      .mul(DEFAULT_COLLATERAL_PRECISION_SCALAR)
      .mul(newPrice)
      .div(normalizedBorrowedAmount);

    expect(cRatio).to.eq(utils.parseEther('1.8'));
  });

  it('repays without a score proof even if one exists on-chain', async () => {
    // Do two repays. One with credit score and one without. Both should pass
    let vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.normalizedBorrowedAmount).to.eq(SCALED_BORROW_AMOUNT);

    await repay(
      utils.parseUnits('1', DEFAULT_STABLECOIN_DECIMALS),
      signers.scoredMinter,
    );

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.normalizedBorrowedAmount).to.eq(
      SCALED_BORROW_AMOUNT.sub(constants.WeiPerEther),
    );
    expect(vault.principal).to.eq(
      SCALED_BORROW_AMOUNT.sub(constants.WeiPerEther),
    );

    await repay(
      utils.parseUnits('1', DEFAULT_STABLECOIN_DECIMALS),
      signers.scoredMinter,
      undefined,
      getScoreProof(minterCreditScore, creditScoreTree),
    );

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.normalizedBorrowedAmount).to.eq(
      SCALED_BORROW_AMOUNT.sub(constants.WeiPerEther.mul(2)),
    );
    expect(vault.principal).to.eq(
      SCALED_BORROW_AMOUNT.sub(constants.WeiPerEther.mul(2)),
    );
  });

  it('updates the totalBorrowed after a repay', async () => {
    expect(await arc.core().totalBorrowed()).to.eq(SCALED_BORROW_AMOUNT);

    await repay(BORROW_AMOUNT.div(2), signers.scoredMinter);

    expect(await arc.core().totalBorrowed()).to.eq(SCALED_BORROW_AMOUNT.div(2));
  });

  it('updates the vault borrow amount', async () => {
    let vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.collateralAmount).to.eq(COLLATERAL_AMOUNT);
    expect(vault.normalizedBorrowedAmount).to.eq(SCALED_BORROW_AMOUNT);
    expect(vault.principal).to.eq(SCALED_BORROW_AMOUNT);

    await repay(BORROW_AMOUNT.div(2), signers.scoredMinter);

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.collateralAmount).to.eq(COLLATERAL_AMOUNT);
    expect(vault.normalizedBorrowedAmount).to.eq(SCALED_BORROW_AMOUNT.div(2));
    expect(vault.principal).to.eq(SCALED_BORROW_AMOUNT.div(2));
  });

  it('emits Repaid event when a repay happens', async () => {
    await expect(repay(BORROW_AMOUNT.div(2), signers.scoredMinter))
      .to.emit(arc.core(), 'Repaid')
      .withArgs(
        signers.scoredMinter.address,
        signers.scoredMinter.address,
        BORROW_AMOUNT.div(2),
        stablecoin.address,
        COLLATERAL_AMOUNT,
        SCALED_BORROW_AMOUNT.div(2),
        SCALED_BORROW_AMOUNT.div(2),
      );
  });

  it('should not repay if user did not approve', async () => {
    await expect(
      arc.repay(
        BORROW_AMOUNT.div(2),
        stablecoin.address,
        undefined,
        undefined,
        signers.scoredMinter,
      ),
    ).to.be.revertedWith('SafeERC20: TRANSFER_FROM_FAILED');
  });

  it('should not repay to a vault that does not exist', async () => {
    const adminSynth = arc.synthetic().connect(signers.admin);
    await adminSynth.mint(signers.minter.address, constants.WeiPerEther);

    await expect(
      repay(constants.WeiPerEther, signers.minter),
    ).to.be.revertedWith('SapphireCoreV1: there is not enough debt to repay');
  });

  it(`should not repay more than the vault's debt`, async () => {
    // Mint more stablex
    const adminSynth = arc.synthetic().connect(signers.admin);
    await adminSynth.mint(signers.scoredMinter.address, constants.WeiPerEther);

    await expect(
      repay(
        BORROW_AMOUNT.add(utils.parseUnits('1', DEFAULT_STABLECOIN_DECIMALS)),
        signers.scoredMinter,
      ),
    ).to.be.revertedWith('SapphireCoreV1: there is not enough debt to repay');
  });

  it('should not repay if contract is paused', async () => {
    await arc.core().connect(signers.pauseOperator).setPause(true);

    await expect(repay(BORROW_AMOUNT, signers.scoredMinter)).to.be.revertedWith(
      'SapphireCoreV1: the contract is paused',
    );
  });

  it('should not repay in an unsupported token', async () => {
    const testDai = await new TestTokenFactory(signers.admin).deploy(
      'TDAI',
      'TDAI',
      18,
    );
    await testDai.mintShare(signers.scoredMinter.address, BORROW_AMOUNT);

    await expect(
      repay(BORROW_AMOUNT, signers.scoredMinter, testDai),
    ).to.be.revertedWith('SapphirePool: unknown token');
  });
});
