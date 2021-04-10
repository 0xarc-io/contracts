import { CreditScore } from '@arc-types/sapphireCore';
import { TestingSigners } from '@arc-types/testing';
import { BigNumber } from '@ethersproject/bignumber';
import { BASE } from '@src/constants';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { TestTokenFactory } from '@src/typings';
import { getScoreProof } from '@src/utils/getScoreProof';
import {
  DEFAULT_HiGH_C_RATIO,
  DEFAULT_LOW_C_RATIO,
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

const COLLATERAL_AMOUNT = utils.parseEther('1000');
const BORROW_AMOUNT = utils.parseEther('500');

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
      lowCollateralRatio: DEFAULT_LOW_C_RATIO,
      highCollateralRatio: DEFAULT_HiGH_C_RATIO,
      merkleRoot: creditScoreTree.getHexRoot(),
      price: DEFAULT_PRICE,
    });

    await setupBaseVault(
      arc,
      signers.scoredMinter,
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
    let cRatio = vault.collateralAmount.value.mul(BASE).div(vault.borrowedAmount.value);
    expect(cRatio).to.eq(constants.WeiPerEther.mul(2));

    const preStablexBalance = await arc.synthetic().balanceOf(signers.scoredMinter.address);
    expect(preStablexBalance).to.eq(BORROW_AMOUNT);

    // Repay half the amount
    await arc.repay(BORROW_AMOUNT.div(2), undefined, undefined, signers.scoredMinter);

    const postStablexBalance = await arc.synthetic().balanceOf(signers.scoredMinter.address);
    expect(postStablexBalance).to.eq(BORROW_AMOUNT.div(2));

    vault = await arc.getVault(signers.scoredMinter.address);

    // Ensure that collateral amount didn't change
    expect(vault.collateralAmount.sign).to.eq(COLLATERAL_AMOUNT);

    /**
     * Collateral = 1000
     * Borrow amt = 500/2 = 250
     * C-ratio = 1000/250 = 400%
     */
    cRatio = vault.collateralAmount.value.mul(BASE).div(vault.borrowedAmount.value);
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
    let cRatio = vault.collateralAmount.value.mul(newPrice).div(BORROW_AMOUNT);
    expect(cRatio).to.eq(utils.parseEther('0.9'));

    // Repay to make the position collateralized
    await arc.repay(BORROW_AMOUNT.div(2));

    vault = await arc.getVault(signers.scoredMinter.address);
    cRatio = vault.collateralAmount.value.mul(newPrice).div(BORROW_AMOUNT);
    expect(cRatio).to.eq(utils.parseEther('1.8'));
  });

  it('repays without a score proof even if one exists on-chain', async () => {
    // Do two repays. One with credit score and one without. Both should pass
    let vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.borrowedAmount.value).to.eq(BORROW_AMOUNT);

    await arc.repay(constants.WeiPerEther, undefined, undefined, signers.scoredMinter);

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.borrowedAmount.value).to.eq(BORROW_AMOUNT.sub(constants.WeiPerEther));

    await arc.repay(
      constants.WeiPerEther,
      getScoreProof(minterCreditScore, creditScoreTree),
      undefined,
      signers.scoredMinter,
    );

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.borrowedAmount.value).to.eq(BORROW_AMOUNT.sub(constants.WeiPerEther.mul(2)));
  });

  it('updates the totalBorrowed after a repay', async () => {
    expect(await arc.core().totalBorrowed()).to.eq(BORROW_AMOUNT);

    await arc.repay(BORROW_AMOUNT.div(2), undefined, undefined, signers.scoredMinter);

    expect(await arc.core().totalBorrowed()).to.eq(BORROW_AMOUNT.div(2));
  });

  it('updates the vault borrow amount', async () => {
    let vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.collateralAmount.value).to.eq(COLLATERAL_AMOUNT);
    expect(vault.borrowedAmount.value).to.eq(BORROW_AMOUNT);

    await arc.repay(BORROW_AMOUNT.div(2), undefined, undefined, signers.scoredMinter);

    vault = await arc.getVault(signers.scoredMinter.address);
    expect(vault.collateralAmount.value).to.eq(COLLATERAL_AMOUNT);
    expect(vault.borrowedAmount.value).to.eq(BORROW_AMOUNT.div(2));
  });

  it('emits ActionOperated event when a repay happens', async () => {
    // Repay with score proof
    await expect(arc.repay(BORROW_AMOUNT.div(2), undefined, undefined, signers.scoredMinter))
      .to.emit(arc.core(), 'ActionOperated')
      .withArgs(
        0, // Repay operation
        {
          owner: signers.scoredMinter.address,
          amountOne: BORROW_AMOUNT.div(2),
          amountTwo: BigNumber.from(0),
          scoreProof: {
            account: signers.scoredMinter.address,
            score: minterCreditScore.amount,
            merkleProof: getScoreProof(minterCreditScore, creditScoreTree),
          },
        },
        signers.scoredMinter.address,
      );

    // Repay without score proof
    await expect(arc.repay(BORROW_AMOUNT.div(2), undefined, undefined, signers.scoredMinter))
      .to.emit(arc.core(), 'ActionOperated')
      .withArgs(
        0,
        {
          owner: signers.scoredMinter.address,
          amountOne: BORROW_AMOUNT.div(2),
          amountTwo: BigNumber.from(0),
          scoreProof: {
            account: constants.AddressZero,
            score: BigNumber.from(0),
            merkleProof: [],
          },
        },
        signers.scoredMinter.address,
      );
  });

  it('should not repay if the oracle is not added', async () => {
    await arc.core().setOracle(constants.AddressZero);

    await expect(
      arc.repay(BORROW_AMOUNT.div(2), undefined, undefined, signers.scoredMinter),
    ).to.be.revertedWith('SapphireCoreV1: cannot repay if oracle is not set');
  });

  it('should not repay if the oracle price is 0', async () => {
    await arc.updatePrice(0);

    await expect(
      arc.repay(BORROW_AMOUNT.div(2), undefined, undefined, signers.scoredMinter),
    ).to.be.revertedWith('SapphireCoreV1: the oracle price returned 0');
  });

  it('should not repay to a vault that does not exist', async () => {
    await expect(arc.core().repay(BORROW_AMOUNT.div(2), undefined)).to.be.revertedWith(
      'SapphireCoreV1: there is not enough debt to repay',
    );
  });

  it('should not repay with a score proof if no assesor is added', async () => {
    await arc.core().setCollateralRatioAssessor(constants.AddressZero);

    await expect(
      arc.repay(
        BORROW_AMOUNT.div(2),
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.scoredMinter,
      ),
    ).to.be.revertedWith('SapphireCoreV1: the credit score assessor is not set');
  });

  it(`should not repay more than the vault's debt`, async () => {
    // Mint more stablex
    await arc.synthetic().mint(signers.scoredMinter.address, constants.WeiPerEther);

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
      arc.repay(BORROW_AMOUNT.div(2), undefined, undefined, signers.scoredMinter),
    ).to.be.revertedWith('SapphireCoreV1: the contract is paused');
  });
});
