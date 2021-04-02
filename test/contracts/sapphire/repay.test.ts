import { CreditScore } from '@arc-types/sapphireCore';
import { TestingSigners } from '@arc-types/testing';
import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BASE } from '@src/constants';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { MockSapphireCoreV1Factory, SapphireCoreV1Factory, TestTokenFactory } from '@src/typings';
import { getScoreProof } from '@src/utils/getScoreProof';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { constants, utils } from 'ethers';
import 'module-alias/register';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

const LOW_C_RATIO = constants.WeiPerEther;
const HIGH_C_RATIO = constants.WeiPerEther.mul(2);

const COLLATERAL_AMOUNT = utils.parseEther('1000');
const BORROW_AMOUNT = utils.parseEther('500');
const COLLATERAL_PRICE = constants.WeiPerEther;

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

  /**
   * Sets up a basic vault using the `COLLATERAL_AMOUNT` amount at a price of `COLLATERAL_PRICE`
   * and a debt of `DEBT_AMOUNT` as defaults amounts, unless specified otherwise
   */
  async function setupBaseVault() {
    const collateralContract = TestTokenFactory.connect(arc.collateral().address, signers.minter);

    await collateralContract.mintShare(signers.minter.address, COLLATERAL_AMOUNT);
    await collateralContract.approve(arc.core().address, COLLATERAL_AMOUNT);

    // Set collateral price
    await arc.updatePrice(COLLATERAL_PRICE);

    // Open vault and mint debt
    await arc.open(
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      getScoreProof(minterCreditScore, creditScoreTree),
      undefined,
      signers.minter,
    );
  }

  async function init(ctx: ITestContext) {
    minterCreditScore = {
      account: ctx.signers.minter.address,
      amount: BigNumber.from(500),
    };
    const creditScore2 = {
      account: ctx.signers.interestSetter.address,
      amount: BigNumber.from(20),
    };
    creditScoreTree = new CreditScoreTree([minterCreditScore, creditScore2]);

    await setupSapphire(ctx, {
      lowCollateralRatio: LOW_C_RATIO,
      highCollateralRatio: HIGH_C_RATIO,
      merkleRoot: creditScoreTree.getHexRoot(),
    });
  }

  before(async () => {
    const ctx = await generateContext(sapphireFixture, init);
    signers = ctx.signers;
    arc = ctx.sdks.sapphire;
  });

  addSnapshotBeforeRestoreAfterEach();

  it('repays to increase the c-ratio', async () => {
    await setupBaseVault();

    let vault = await arc.getVault(signers.minter.address);
    // Confirm c-ratio of 200%
    let cRatio = vault.collateralAmount.value.mul(BASE).div(vault.borrowedAmount.value);
    expect(cRatio).to.eq(constants.WeiPerEther.mul(2));

    const preStablexBalance = await arc.synthetic().balanceOf(signers.minter.address);
    expect(preStablexBalance).to.eq(BORROW_AMOUNT);

    // Repay half the amount
    await arc.repay(BORROW_AMOUNT.div(2), undefined, undefined, signers.minter);

    const postStablexBalance = await arc.synthetic().balanceOf(signers.minter.address);
    expect(postStablexBalance).to.eq(BORROW_AMOUNT.div(2));

    vault = await arc.getVault(signers.minter.address);

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
     * Setup base vault with 1000 collateral and 500 debt for a c-ratio of
     * 200%, when the collateral price is $1
     */
    await setupBaseVault();

    /**
     * Drop the price to make the position undercollateralized.
     * The new c-ratio is 1000 * 0.45 / 500 = 90%
     */
    const newPrice = utils.parseEther('0.45');
    await arc.updatePrice(newPrice);

    // Ensure position is undercollateralized
    let vault = await arc.getVault(signers.minter.address);
    let cRatio = vault.collateralAmount.value.mul(newPrice).div(BORROW_AMOUNT);
    expect(cRatio).to.eq(utils.parseEther('0.9'));

    // Repay to make the position collateralized
    await arc.repay(BORROW_AMOUNT.div(2));

    vault = await arc.getVault(signers.minter.address);
    cRatio = vault.collateralAmount.value.mul(newPrice).div(BORROW_AMOUNT);
    expect(cRatio).to.eq(utils.parseEther('1.8'));
  });

  it('repays without a score proof even if one exists on-chain', async () => {
    await setupBaseVault();

    // Do two repays. One with credit score and one without. Both should pass
    let vault = await arc.getVault(signers.minter.address);
    expect(vault.borrowedAmount.value).to.eq(BORROW_AMOUNT);

    await arc.repay(constants.WeiPerEther, undefined, undefined, signers.minter);

    vault = await arc.getVault(signers.minter.address);
    expect(vault.borrowedAmount.value).to.eq(BORROW_AMOUNT.sub(constants.WeiPerEther));

    await arc.repay(
      constants.WeiPerEther,
      getScoreProof(minterCreditScore, creditScoreTree),
      undefined,
      signers.minter,
    );

    vault = await arc.getVault(signers.minter.address);
    expect(vault.borrowedAmount.value).to.eq(BORROW_AMOUNT.sub(constants.WeiPerEther.mul(2)));
  });

  it('updates the totalBorrowed after a repay', async () => {
    await setupBaseVault();

    expect(await arc.core().totalBorrowed()).to.eq(BORROW_AMOUNT);

    await arc.repay(BORROW_AMOUNT.div(2), undefined, undefined, signers.minter);

    expect(await arc.core().totalBorrowed()).to.eq(BORROW_AMOUNT.div(2));
  });

  it('updates the vault borrow amount', async () => {
    let vault = await arc.getVault(signers.minter.address);
    expect(vault.collateralAmount.value).to.eq(0);
    expect(vault.borrowedAmount.value).to.eq(0);

    await setupBaseVault();

    vault = await arc.getVault(signers.minter.address);
    expect(vault.collateralAmount.value).to.eq(COLLATERAL_AMOUNT);
    expect(vault.borrowedAmount.value).to.eq(BORROW_AMOUNT);

    await arc.repay(BORROW_AMOUNT.div(2), undefined, undefined, signers.minter);

    vault = await arc.getVault(signers.minter.address);
    expect(vault.collateralAmount.value).to.eq(COLLATERAL_AMOUNT);
    expect(vault.borrowedAmount.value).to.eq(BORROW_AMOUNT.div(2));
  });

  it('emits ActionOperated event when a repay happens', async () => {
    await setupBaseVault();

    // Repay with score proof
    await expect(arc.repay(BORROW_AMOUNT.div(2), undefined, undefined, signers.minter))
      .to.emit(arc.core(), 'ActionOperated')
      .withArgs(
        0, // Repay operation
        {
          owner: signers.minter.address,
          amountOne: BORROW_AMOUNT.div(2),
          amountTwo: BigNumber.from(0),
          scoreProof: {
            account: signers.minter.address,
            score: minterCreditScore.amount,
            merkleProof: getScoreProof(minterCreditScore, creditScoreTree),
          },
        },
        signers.minter.address,
      );

    // Repay without score proof
    await expect(arc.repay(BORROW_AMOUNT.div(2), undefined, undefined, signers.minter))
      .to.emit(arc.core(), 'ActionOperated')
      .withArgs(
        0,
        {
          owner: signers.minter.address,
          amountOne: BORROW_AMOUNT.div(2),
          amountTwo: BigNumber.from(0),
          scoreProof: {
            account: constants.AddressZero,
            score: BigNumber.from(0),
            merkleProof: [],
          },
        },
        signers.minter.address,
      );
  });

  it('should not repay if the oracle is not added', async () => {
    await setupBaseVault();

    const mockCore = MockSapphireCoreV1Factory.connect(arc.coreAddress(), signers.admin);
    await mockCore.setOracle(constants.AddressZero);

    await expect(
      arc.repay(BORROW_AMOUNT.div(2), undefined, undefined, signers.minter),
    ).to.be.revertedWith('SapphireCoreV1: cannot repay if oracle is not set');
  });

  it('should not repay if the oracle price is 0', async () => {
    await setupBaseVault();

    await arc.updatePrice(0);

    await expect(
      arc.repay(BORROW_AMOUNT.div(2), undefined, undefined, signers.minter),
    ).to.be.revertedWith('SapphireCoreV1: the oracle price returned 0');
  });

  it('should not repay to a vault that does not exist', async () => {
    await setupBaseVault();

    const coreContract = SapphireCoreV1Factory.connect(arc.coreAddress(), signers.minter);

    await expect(coreContract.repay(BORROW_AMOUNT.div(2), undefined)).to.be.revertedWith(
      'SapphireCoreV1: there is not enough debt to repay',
    );
  });

  it('should not repay with a score proof if no assesor is added', async () => {
    await setupBaseVault();

    const coreContract = MockSapphireCoreV1Factory.connect(arc.coreAddress(), signers.admin);
    coreContract.setCollateralRatioAssessor(constants.AddressZero);

    await expect(
      arc.repay(
        BORROW_AMOUNT.div(2),
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.minter,
      ),
    ).to.be.revertedWith('SapphireCoreV1: the credit score assessor is not set');
  });

  it(`should not repay more than the vault's debt`, async () => {
    await setupBaseVault();

    // Mint more stablex
    const stablexContract = TestTokenFactory.connect(arc.syntheticAddress(), signers.minter);
    stablexContract.mintShare(signers.minter.address, constants.WeiPerEther);

    await expect(
      arc.repay(BORROW_AMOUNT.add(constants.WeiPerEther), undefined, undefined, signers.minter),
    ).to.be.revertedWith('SapphireCoreV1: there is not enough debt to repay');
  });

  it('should not repay if contract is paused', async () => {
    await setupBaseVault();

    const coreContract = SapphireCoreV1Factory.connect(arc.coreAddress(), signers.admin);
    await coreContract.setPause(true);

    await expect(
      arc.repay(BORROW_AMOUNT.div(2), undefined, undefined, signers.minter),
    ).to.be.revertedWith('SapphireCoreV1: the contract is paused');
  });
});
