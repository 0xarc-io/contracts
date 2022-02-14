import { PassportScore, PassportScoreProof } from '@arc-types/sapphireCore';
import { TestingSigners } from '@arc-types/testing';
import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { PassportScoreTree } from '@src/MerkleTree';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { SyntheticTokenV2Factory, TestToken } from '@src/typings';
import { getScoreProof } from '@src/utils/getScoreProof';
import {
  BORROW_LIMIT_PROOF_PROTOCOL,
  DEFAULT_COLLATERAL_DECIMALS,
  DEFAULT_HIGH_C_RATIO,
  DEFAULT_PROOF_PROTOCOL,
} from '@test/helpers/sapphireDefaults';
import { setupBaseVault } from '@test/helpers/setupBaseVault';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { constants, utils } from 'ethers';
import 'module-alias/register';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

const NORMALIZED_COLLATERAL_AMOUNT = utils.parseEther('1000');
const COLLATERAL_AMOUNT = utils.parseUnits('1000', DEFAULT_COLLATERAL_DECIMALS);
const COLLATERAL_PRICE = utils.parseEther('1');
const BORROW_AMOUNT = NORMALIZED_COLLATERAL_AMOUNT.mul(COLLATERAL_PRICE).div(
  DEFAULT_HIGH_C_RATIO,
);
const PRECISION_SCALAR = BigNumber.from(10).pow(
  BigNumber.from(18).sub(DEFAULT_COLLATERAL_DECIMALS),
);

/**
 * The repay function allows a user to repay the STABLEx debt. This function, withdraw and liquidate
 * have the credit proof as optional since we never want to lock users from pulling out their funds.
 * Our front-end will always send the proof but in the case that it can't, users can still repay
 * and withdraw directly.
 */
describe('SapphireCore.repay()', () => {
  let arc: SapphireTestArc;
  let signers: TestingSigners;
  let minterCreditScore: PassportScore;
  let minterBorrowLimitScore: PassportScore;
  let creditScoreTree: PassportScoreTree;
  let stableCoin: TestToken;

  // /**
  //  * Returns the converted principal, as calculated by the smart contract:
  //  * `principal * BASE / borrowIndex`
  //  * @param principal principal amount to convert
  //  */
  // async function convertPrincipal(principal: BigNumber) {
  //   const borrowIndex = await arc.core().borrowIndex();
  //   return roundUpDiv(principal, borrowIndex);
  // }

  // /**
  //  * Returns `amount * borrowIndex`, as calculated by the contract
  //  */
  // async function denormalizeBorrowAmount(amount: BigNumber) {
  //   const borrowIndex = await arc.core().borrowIndex();
  //   return roundUpMul(amount, borrowIndex);
  // }

  async function repay(
    amount: BigNumber,
    caller: SignerWithAddress,
    scoreProof?: PassportScoreProof,
  ) {
    const senderContract = SyntheticTokenV2Factory.connect(
      arc.syntheticAddress(),
      caller,
    );

    await senderContract.approve(arc.coreAddress(), amount);

    return arc.repay(amount, stableCoin.address, scoreProof, undefined, caller);
  }

  async function init(ctx: ITestContext) {
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
    minterBorrowLimitScore = {
      account: ctx.signers.scoredMinter.address,
      protocol: utils.formatBytes32String(BORROW_LIMIT_PROOF_PROTOCOL),
      score: BORROW_AMOUNT,
    };
    creditScoreTree = new PassportScoreTree([
      minterCreditScore,
      creditScore2,
      minterBorrowLimitScore,
    ]);

    await setupSapphire(ctx, {
      merkleRoot: creditScoreTree.getHexRoot(),
      price: COLLATERAL_PRICE,
    });
  }

  before(async () => {
    const ctx = await generateContext(sapphireFixture, init);
    signers = ctx.signers;
    arc = ctx.sdks.sapphire;
    stableCoin = ctx.contracts.stablecoin;

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
      .mul(PRECISION_SCALAR)
      .mul(COLLATERAL_PRICE)
      .div(vault.normalizedBorrowedAmount);
    expect(cRatio).to.eq(constants.WeiPerEther.mul(2));

    const preStablexBalance = await arc
      .synthetic()
      .balanceOf(signers.scoredMinter.address);
    expect(preStablexBalance).to.eq(BORROW_AMOUNT);

    // Repay half the amount
    await repay(BORROW_AMOUNT.div(2), signers.scoredMinter);

    const postStablexBalance = await arc
      .synthetic()
      .balanceOf(signers.scoredMinter.address);
    expect(postStablexBalance).to.eq(BORROW_AMOUNT.div(2));

    vault = await arc.getVault(signers.scoredMinter.address);

    // Ensure that collateral amount didn't change
    expect(vault.collateralAmount).to.eq(COLLATERAL_AMOUNT);

    expect(vault.normalizedBorrowedAmount).to.eq(BORROW_AMOUNT.div(2));
    expect(vault.principal).to.eq(BORROW_AMOUNT.div(2));
    /**
     * Collateral = 1000
     * Borrow amt = 500/2 = 250
     * C-ratio = 1000/250 = 400%
     */
    cRatio = vault.collateralAmount
      .mul(PRECISION_SCALAR)
      .mul(COLLATERAL_PRICE)
      .div(vault.normalizedBorrowedAmount);
    expect(cRatio).to.eq(constants.WeiPerEther.mul(4));
  });

  it('decreases the user principal by the repay amount');

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
      .mul(PRECISION_SCALAR)
      .mul(newPrice)
      .div(BORROW_AMOUNT);

    expect(cRatio).to.eq(utils.parseEther('0.9'));

    // Repay to make the position collateralized
    await repay(BORROW_AMOUNT.div(2), signers.scoredMinter);

    const { collateralAmount, normalizedBorrowedAmount } = await arc.getVault(
      signers.scoredMinter.address,
    );
    cRatio = collateralAmount
      .mul(PRECISION_SCALAR)
      .mul(newPrice)
      .div(normalizedBorrowedAmount);

    expect(cRatio).to.eq(utils.parseEther('1.8'));
  });

  it('repays without a score proof even if one exists on-chain', async () => {
    // Do two repays. One with credit score and one without. Both should pass
    let vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.normalizedBorrowedAmount).to.eq(BORROW_AMOUNT);

    await repay(constants.WeiPerEther, signers.scoredMinter);

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.normalizedBorrowedAmount).to.eq(
      BORROW_AMOUNT.sub(constants.WeiPerEther),
    );
    expect(vault.principal).to.eq(BORROW_AMOUNT.sub(constants.WeiPerEther));

    await repay(
      constants.WeiPerEther,
      signers.scoredMinter,
      getScoreProof(minterCreditScore, creditScoreTree),
    );

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.normalizedBorrowedAmount).to.eq(
      BORROW_AMOUNT.sub(constants.WeiPerEther.mul(2)),
    );
    expect(vault.principal).to.eq(
      BORROW_AMOUNT.sub(constants.WeiPerEther.mul(2)),
    );
  });

  it('updates the totalBorrowed after a repay', async () => {
    expect(await arc.core().totalBorrowed()).to.eq(BORROW_AMOUNT);

    await repay(BORROW_AMOUNT.div(2), signers.scoredMinter);

    expect(await arc.core().totalBorrowed()).to.eq(BORROW_AMOUNT.div(2));
  });

  it('updates the vault borrow amount', async () => {
    let vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.collateralAmount).to.eq(COLLATERAL_AMOUNT);
    expect(vault.normalizedBorrowedAmount).to.eq(BORROW_AMOUNT);
    expect(vault.principal).to.eq(BORROW_AMOUNT);

    await repay(BORROW_AMOUNT.div(2), signers.scoredMinter);

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.collateralAmount).to.eq(COLLATERAL_AMOUNT);
    expect(vault.normalizedBorrowedAmount).to.eq(BORROW_AMOUNT.div(2));
    expect(vault.principal).to.eq(BORROW_AMOUNT.div(2));
  });

  it('emits ActionsOperated event when a repay happens', async () => {
    // Repay with score proof
    await expect(repay(BORROW_AMOUNT.div(2), signers.scoredMinter)).to.emit(
      arc.core(),
      'ActionsOperated',
    );
    // .withArgs(
    //   [[BORROW_AMOUNT.div(2), 3]],
    //   getScoreProof(minterCreditScore, creditScoreTree),
    //   signers.scoredMinter.address
    // );

    // Repay without score proof
    await expect(repay(BORROW_AMOUNT.div(2), signers.scoredMinter)).to.emit(
      arc.core(),
      'ActionsOperated',
    );
    // .withArgs(
    //   [[BORROW_AMOUNT.div(2), 3]],
    //   getEmptyScoreProof(signers.scoredMinter),
    //   signers.scoredMinter.address
    // );
  });

  it('should not repay if user did not approve', async () => {
    await expect(
      arc.repay(
        BORROW_AMOUNT.div(2),
        stableCoin.address,
        undefined,
        undefined,
        signers.scoredMinter,
      ),
    ).to.be.revertedWith(
      'SyntheticTokenV2: the amount has not been approved for this spender',
    );
  });

  it('should not repay if asset is not supported', async () => {
    await expect(
      arc.repay(
        BORROW_AMOUNT.div(2),
        arc.collateral().address,
        undefined,
        undefined,
        signers.scoredMinter,
      ),
    ).to.be.revertedWith(
      'SapphireCoreV1: the token address should be one of the supported tokens',
    );
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
      repay(BORROW_AMOUNT.add(constants.WeiPerEther), signers.scoredMinter),
    ).to.be.revertedWith('SapphireCoreV1: there is not enough debt to repay');
  });

  it('should not repay if contract is paused', async () => {
    await arc.core().connect(signers.pauseOperator).setPause(true);

    await expect(
      repay(BORROW_AMOUNT.add(constants.WeiPerEther), signers.scoredMinter),
    ).to.be.revertedWith('SapphireCoreV1: the contract is paused');
  });

  it('should not repay in an unsupported token');
});
