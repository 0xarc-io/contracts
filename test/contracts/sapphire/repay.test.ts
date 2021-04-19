import { CreditScore } from '@arc-types/sapphireCore';
import { TestingSigners } from '@arc-types/testing';
import { BigNumber } from '@ethersproject/bignumber';
import { BASE } from '@src/constants';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { getScoreProof } from '@src/utils/getScoreProof';
import {
  DEFAULT_COLLATERAL_DECIMALS,
  DEFAULT_HiGH_C_RATIO,
  DEFAULT_PRICE,
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
const BORROW_AMOUNT = NORMALIZED_COLLATERAL_AMOUNT.mul(DEFAULT_PRICE).div(
  DEFAULT_HiGH_C_RATIO,
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
  let minterCreditScore: CreditScore;
  let creditScoreTree: CreditScoreTree;

  async function init(ctx: ITestContext) {
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
      merkleRoot: creditScoreTree.getHexRoot(),
    });

    await setupBaseVault(
      ctx.sdks.sapphire,
      ctx.signers.scoredMinter,
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      getScoreProof(minterCreditScore, creditScoreTree),
    );
  }

  before(async () => {
    const ctx = await generateContext(sapphireFixture, init);
    signers = ctx.signers;
    arc = ctx.sdks.sapphire;
  });

  addSnapshotBeforeRestoreAfterEach();

  it('repays to increase the c-ratio', async () => {
    let vault = await arc.getVault(signers.scoredMinter.address);
    // Confirm c-ratio of 200%
    let cRatio = vault.collateralAmount
      .mul(PRECISION_SCALAR)
      .mul(BASE)
      .div(vault.borrowedAmount);
    expect(cRatio).to.eq(constants.WeiPerEther.mul(2));

    const preStablexBalance = await arc
      .synthetic()
      .balanceOf(signers.scoredMinter.address);
    expect(preStablexBalance).to.eq(BORROW_AMOUNT);

    // Repay half the amount
    await arc.repay(
      BORROW_AMOUNT.div(2),
      undefined,
      undefined,
      signers.scoredMinter,
    );

    const postStablexBalance = await arc
      .synthetic()
      .balanceOf(signers.scoredMinter.address);
    expect(postStablexBalance).to.eq(BORROW_AMOUNT.div(2));

    vault = await arc.getVault(signers.scoredMinter.address);

    // Ensure that collateral amount didn't change
    expect(vault.collateralAmount).to.eq(COLLATERAL_AMOUNT);

    /**
     * Collateral = 1000
     * Borrow amt = 500/2 = 250
     * C-ratio = 1000/250 = 400%
     */
    cRatio = vault.collateralAmount
      .mul(PRECISION_SCALAR)
      .mul(BASE)
      .div(vault.borrowedAmount);
    expect(cRatio).to.eq(constants.WeiPerEther.mul(4));
  });

  it('repays to make the position collateralized', async () => {
    /**
     * Drop the price to make the position undercollateralized.
     * The new c-ratio is 1000 * 0.45 / 500 = 90%
     */
    const newPrice = utils.parseEther('0.45');
    await arc.updatePrice(newPrice);

    // Ensure position is undercollateralized
    let vault = await arc.getVault(signers.scoredMinter.address);
    let cRatio = vault.collateralAmount
      .mul(PRECISION_SCALAR)
      .mul(newPrice)
      .div(BORROW_AMOUNT);

    expect(cRatio).to.eq(utils.parseEther('0.9'));

    // Repay to make the position collateralized
    await arc.repay(
      BORROW_AMOUNT.div(2),
      undefined,
      undefined,
      signers.scoredMinter,
    );

    const { collateralAmount, borrowedAmount } = await arc.getVault(
      signers.scoredMinter.address,
    );
    cRatio = collateralAmount
      .mul(PRECISION_SCALAR)
      .mul(newPrice)
      .div(borrowedAmount);

    expect(cRatio).to.eq(utils.parseEther('1.8'));
  });

  it('repays without a score proof even if one exists on-chain', async () => {
    // Do two repays. One with credit score and one without. Both should pass
    let vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.borrowedAmount).to.eq(BORROW_AMOUNT);

    await arc.repay(
      constants.WeiPerEther,
      undefined,
      undefined,
      signers.scoredMinter,
    );

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.borrowedAmount).to.eq(
      BORROW_AMOUNT.sub(constants.WeiPerEther),
    );

    await arc.repay(
      constants.WeiPerEther,
      getScoreProof(minterCreditScore, creditScoreTree),
      undefined,
      signers.scoredMinter,
    );

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.borrowedAmount).to.eq(
      BORROW_AMOUNT.sub(constants.WeiPerEther.mul(2)),
    );
  });

  it('updates the totalBorrowed after a repay', async () => {
    expect(await arc.core().totalBorrowed()).to.eq(BORROW_AMOUNT);

    await arc.repay(
      BORROW_AMOUNT.div(2),
      undefined,
      undefined,
      signers.scoredMinter,
    );

    expect(await arc.core().totalBorrowed()).to.eq(BORROW_AMOUNT.div(2));
  });

  it('updates the vault borrow amount', async () => {
    let vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.collateralAmount).to.eq(COLLATERAL_AMOUNT);
    expect(vault.borrowedAmount).to.eq(BORROW_AMOUNT);

    await arc.repay(
      BORROW_AMOUNT.div(2),
      undefined,
      undefined,
      signers.scoredMinter,
    );

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.collateralAmount).to.eq(COLLATERAL_AMOUNT);
    expect(vault.borrowedAmount).to.eq(BORROW_AMOUNT.div(2));
  });

  it('emits ActionsOperated event when a repay happens', async () => {
    // Repay with score proof
    await expect(
      arc.repay(
        BORROW_AMOUNT.div(2),
        undefined,
        undefined,
        signers.scoredMinter,
      ),
    ).to.emit(arc.core(), 'ActionsOperated');
    // .withArgs(
    //   [[BORROW_AMOUNT.div(2), 3]],
    //   getScoreProof(minterCreditScore, creditScoreTree),
    //   signers.scoredMinter.address
    // );

    // Repay without score proof
    await expect(
      arc.repay(
        BORROW_AMOUNT.div(2),
        undefined,
        undefined,
        signers.scoredMinter,
      ),
    ).to.emit(arc.core(), 'ActionsOperated');
    // .withArgs(
    //   [[BORROW_AMOUNT.div(2), 3]],
    //   getEmptyScoreProof(signers.scoredMinter),
    //   signers.scoredMinter.address
    // );
  });

  it('should not repay to a vault that does not exist', async () => {
    await arc.synthetic().mint(signers.minter.address, constants.WeiPerEther);

    await expect(
      arc.repay(constants.WeiPerEther, undefined, undefined, signers.minter),
    ).to.be.revertedWith('SapphireCoreV1: there is not enough debt to repay');
  });

  it('should not repay with a score proof if no assesor is added', async () => {
    await arc.core().setAssessor(constants.AddressZero);

    await expect(
      arc.repay(
        BORROW_AMOUNT.div(2),
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.scoredMinter,
      ),
    ).to.be.revertedWith('SapphireCoreV1: the assessor is not set');
  });

  it(`should not repay more than the vault's debt`, async () => {
    // Mint more stablex
    await arc
      .synthetic()
      .mint(signers.scoredMinter.address, constants.WeiPerEther);

    await expect(
      arc.repay(
        BORROW_AMOUNT.add(constants.WeiPerEther),
        undefined,
        undefined,
        signers.scoredMinter,
      ),
    ).to.be.revertedWith('SapphireCoreV1: there is not enough debt to repay');
  });

  it('should not repay if contract is paused', async () => {
    await arc.core().connect(signers.admin).setPause(true);

    await expect(
      arc.repay(
        BORROW_AMOUNT.div(2),
        undefined,
        undefined,
        signers.scoredMinter,
      ),
    ).to.be.revertedWith('SapphireCoreV1: the contract is paused');
  });
});
