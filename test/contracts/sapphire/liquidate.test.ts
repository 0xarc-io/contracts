import { SapphireTestArc } from '@src/SapphireTestArc';
import { BigNumber, constants, utils } from 'ethers';
import 'module-alias/register';
import { generateContext, ITestContext } from '../context';
import { setupSapphire } from '../setup';
import { sapphireFixture } from '../fixtures';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import {
  addSnapshotBeforeRestoreAfterEach,
  immediatelyUpdateMerkleRoot,
} from '@test/helpers/testingUtils';
import ArcNumber from '@src/utils/ArcNumber';
import { TestingSigners } from '@arc-types/testing';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  MockSapphireCreditScore,
  SapphireMapperLinear,
  SyntheticTokenV2Factory,
} from '@src/typings';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { CreditScore, CreditScoreProof } from '@arc-types/sapphireCore';
import { BASE, ONE_YEAR_IN_SECONDS } from '@src/constants';
import { getScoreProof } from '@src/utils/getScoreProof';
import * as helperSetupBaseVault from '../../helpers/setupBaseVault';
import { DEFAULT_COLLATERAL_DECIMALS } from '@test/helpers/sapphireDefaults';

chai.use(solidity);

const LOW_C_RATIO = utils.parseEther('1.15');
const HIGH_C_RATIO = utils.parseEther('1.5');
const LIQUIDATION_USER_FEE = utils.parseEther('0.1');
const LIQUIDATION_ARC_FEE = utils.parseEther('0.1');

const COLLATERAL_AMOUNT = utils.parseUnits('1000', DEFAULT_COLLATERAL_DECIMALS);
const COLLATERAL_PRICE = utils.parseEther('1');
const BORROW_AMOUNT = utils.parseEther('500');

const PRECISION_SCALAR = BigNumber.from(10).pow(
  18 - DEFAULT_COLLATERAL_DECIMALS.toNumber(),
);

/**
 * When a liquidation occurs, what's really happening is that the debt which a user owes the
 * the system needs to be repaid by someone else. The incentive for this other user to repay
 * another user's debt is because they acquire the user's collateral at a discount and can make
 * an insta profit by selling the collateral they got a discount.
 */
describe('SapphireCore.liquidate()', () => {
  let arc: SapphireTestArc;
  let creditScoreContract: MockSapphireCreditScore;
  let signers: TestingSigners;
  let creditScoreTree: CreditScoreTree;
  let mapper: SapphireMapperLinear;
  let minterCreditScore: CreditScore;
  let liquidatorCreditScore: CreditScore;

  /**
   * Returns useful balances to use when validating numbers before and after
   * a liquidation.
   * @param user The user to get the balances for
   */
  async function getBalancesForLiquidation(user: SignerWithAddress) {
    const userAddress = user.address;

    const stablexAmt = await arc.synthetic().balanceOf(userAddress);
    const collateralAmt = await arc.collateral().balanceOf(userAddress);
    const arcCollateralAmt = await arc
      .collateral()
      .balanceOf(await arc.core().feeCollector());
    const stablexTotalSupply = await arc.synthetic().totalSupply();

    return {
      stablexAmt,
      collateralAmt,
      arcCollateralAmt,
      stablexTotalSupply,
    };
  }

  /**
   * Sets up a basic vault using the `COLLATERAL_AMOUNT` amount at a price of `COLLATERAL_PRICE`
   * and a debt of `BORROW_AMOUNT` as defaults amounts, unless specified otherwise
   */
  async function setupBaseVault(
    collateralAmount = COLLATERAL_AMOUNT,
    debtAmount = BORROW_AMOUNT,
    collateralPrice = COLLATERAL_PRICE,
    scoreProof?: CreditScoreProof,
  ) {
    // Set collateral price
    await arc.updatePrice(collateralPrice);

    return helperSetupBaseVault.setupBaseVault(
      arc,
      signers.scoredMinter,
      collateralAmount,
      debtAmount,
      scoreProof,
    );
  }

  async function init(ctx: ITestContext) {
    minterCreditScore = {
      account: ctx.signers.scoredMinter.address,
      amount: BigNumber.from(500),
    };

    liquidatorCreditScore = {
      account: ctx.signers.liquidator.address,
      amount: BigNumber.from(500),
    };

    creditScoreTree = new CreditScoreTree([
      minterCreditScore,
      liquidatorCreditScore,
    ]);
  }

  before(async () => {
    const ctx = await generateContext(sapphireFixture, init);
    signers = ctx.signers;
    arc = ctx.sdks.sapphire;
    creditScoreContract = ctx.contracts.sapphire.creditScore;
    mapper = ctx.contracts.sapphire.linearMapper;

    await setupSapphire(ctx, {
      limits: {
        lowCollateralRatio: LOW_C_RATIO,
        highCollateralRatio: HIGH_C_RATIO,
      },
      merkleRoot: creditScoreTree.getHexRoot(),
      fees: {
        liquidationUserFee: LIQUIDATION_USER_FEE,
        liquidationArcFee: LIQUIDATION_ARC_FEE,
      },
    });

    // Set the price to $1
    await ctx.sdks.sapphire.updatePrice(COLLATERAL_PRICE);

    // Set liquidation user fees and arc fees
    await arc.core().setFees(
      utils.parseEther('0.05'), // 5% price discount
      utils.parseEther('0.1'), // 10% arc tax on profit
    );

    // Mints enough STABLEx to the liquidator
    await helperSetupBaseVault.setupBaseVault(
      arc,
      signers.liquidator,
      COLLATERAL_AMOUNT.mul(2),
      BORROW_AMOUNT.mul(3),
      getScoreProof(liquidatorCreditScore, creditScoreTree),
    );

    // Approve synth to the core for liquidation
    const synthContract = SyntheticTokenV2Factory.connect(
      arc.syntheticAddress(),
      signers.liquidator,
    );
    await synthContract.approve(arc.coreAddress(), BORROW_AMOUNT.mul(3));
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('Base tests', () => {
    // Test 1 in https://docs.google.com/spreadsheets/d/1rmFbUxnM4gyi1xhcYKBwcdadvXrHBPKbeX7DLk8KQgE/edit?usp=sharing
    it('liquidates an undercollateralized vault', async () => {
      /**
       * When a liquidation is done we need to check the following
       * - Ensure that the liquidator has enough debt (STABLEx)
       * - Ensure the vault is under-collateralized
       *
       * When a liquidation happens we need to check
       * - The debt has been taken from the liquidator (STABLEx)
       * - The collateral has been given to the liquidator
       * - The total STABLEx supply has decreased
       * - The vault collateral amount has decreased
       * - The vault debt amount has decreased
       * - A portion of collateral is sent to the fee collector
       */

      // Sets up a basic vault
      await setupBaseVault();

      expect(
        await arc.synthetic().balanceOf(signers.liquidator.address),
        '1',
      ).to.be.gte(BORROW_AMOUNT);

      // Drop the price by half to make the vault under-collateralized
      const newPrice = COLLATERAL_PRICE.div(2);
      await arc.updatePrice(newPrice);

      // Make sure vault is under-collateralized
      const liquidationCRatio = await mapper.map(
        minterCreditScore.amount,
        1000,
        LOW_C_RATIO,
        HIGH_C_RATIO,
      );
      const currentCRatio = COLLATERAL_AMOUNT.mul(newPrice).div(BORROW_AMOUNT);
      expect(currentCRatio, '2').to.be.lte(liquidationCRatio);

      const {
        stablexAmt: preStablexBalance,
        collateralAmt: preCollateralBalance,
        arcCollateralAmt: preArcCollateralAmt,
        stablexTotalSupply: preStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);

      // Liquidate vault
      await arc.liquidate(
        signers.scoredMinter.address,
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.liquidator,
      );

      const {
        stablexAmt: postStablexBalance,
        collateralAmt: postCollateralBalance,
        arcCollateralAmt: postArcCollateralAmt,
        stablexTotalSupply: postStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);

      const {
        collateralAmount: postCollateralVaultBalance,
      } = await arc.getVault(signers.scoredMinter.address);

      // The debt has been taken from the liquidator (STABLEx)
      expect(postStablexBalance, '3').to.eq(
        preStablexBalance.sub(ArcNumber.new(475)).sub(1000), // -1000 for rounding
      );

      // The collateral has been given to the liquidator
      const liquidatedCollateral = BigNumber.from('994736843');
      expect(postCollateralBalance, '4').to.eq(
        preCollateralBalance.add(liquidatedCollateral),
      );

      // Check collateral vault balance. Collateral was completely sold
      expect(postCollateralVaultBalance).to.eq(0);

      // A portion of collateral is sent to the fee collector
      expect(postArcCollateralAmt, '6').eq(
        preArcCollateralAmt.add(
          utils.parseUnits('5.263157', DEFAULT_COLLATERAL_DECIMALS),
        ),
      );

      // The total STABLEx supply has decreased
      expect(postStablexTotalSupply, '7').to.eq(
        preStablexTotalSupply.sub(ArcNumber.new(475)).sub(1000), // -1000 for rounding
      );

      // The vault collateral amount has decreased
      const postLiquidationVault = await arc.getVault(
        signers.scoredMinter.address,
      );
      expect(postLiquidationVault.collateralAmount, '8').to.eq(0);

      // The vault debt amount has decreased
      expect(postLiquidationVault.borrowedAmount, '9').to.eq(
        BORROW_AMOUNT.sub(ArcNumber.new(475)).sub(998), // -998 for rounding margin of collateral value
      );
    });

    // Test 2 in https://docs.google.com/spreadsheets/d/1rmFbUxnM4gyi1xhcYKBwcdadvXrHBPKbeX7DLk8KQgE/edit?usp=sharing
    it('provides a lower score proof and then liquidates the vault', async () => {
      /**
       * The base vault is at a healthy 200% c-ratio when the price is $1.
       * Changing the price to $0.68 will change the c-ratio to 135%.
       * Since the minter has a 500 credit score, their vault won't be liquidated
       * until 132.5%.
       * If the credit score drops to 50, their vault can get liquidated if the c-ratio
       * goes below 148.25%.
       */

      // Sets up a basic vault
      await setupBaseVault();

      // Change the price to drop the c-ratio to 135%
      const newPrice = utils.parseEther('0.68');
      await arc.updatePrice(newPrice);

      // The user's credit score decreases
      const newMinterCreditScore = {
        account: signers.scoredMinter.address,
        amount: BigNumber.from(50),
      };
      const newCreditTree = new CreditScoreTree([
        newMinterCreditScore,
        liquidatorCreditScore,
      ]);
      await immediatelyUpdateMerkleRoot(
        creditScoreContract.connect(signers.interestSetter),
        newCreditTree.getHexRoot(),
      );

      const {
        stablexAmt: preStablexBalance,
        collateralAmt: preCollateralBalance,
        arcCollateralAmt: preArcCollateralAmt,
        stablexTotalSupply: preStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);

      // The liquidator submits the user's credit score and is then able to liquidate
      await arc.liquidate(
        signers.scoredMinter.address,
        getScoreProof(newMinterCreditScore, newCreditTree),
        undefined,
        signers.liquidator,
      );

      const {
        stablexAmt: postStablexBalance,
        collateralAmt: postCollateralBalance,
        arcCollateralAmt: postArcCollateralAmt,
        stablexTotalSupply: postStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);

      // The debt has been taken from the liquidator (STABLEx)
      expect(postStablexBalance).to.eq(
        preStablexBalance.sub(BORROW_AMOUNT).sub(2), // -2 for rounding
      );

      // The collateral has been given to the liquidator
      expect(postCollateralBalance).to.eq(
        preCollateralBalance
          .add(utils.parseUnits('769.920157', DEFAULT_COLLATERAL_DECIMALS))
          .add(1), // +1 for rounding
      );

      // A portion of collateral is sent to the fee collector
      expect(postArcCollateralAmt).eq(
        preArcCollateralAmt.add(
          utils.parseUnits('4.073651', DEFAULT_COLLATERAL_DECIMALS),
        ),
      );

      // The total STABLEx supply has decreased
      expect(postStablexTotalSupply).to.eq(
        preStablexTotalSupply.sub(BORROW_AMOUNT).sub(2), // -2 for rounding
      );

      // The vault collateral amount has decreased
      const postLiquidationVault = await arc.getVault(
        signers.scoredMinter.address,
      );
      expect(postLiquidationVault.collateralAmount).to.eq(
        utils.parseUnits('226.006192', DEFAULT_COLLATERAL_DECIMALS).sub(1), // -1 for rounding
      );

      // The vault debt amount has decreased
      expect(postLiquidationVault.borrowedAmount).to.eq(0);
    });

    it.skip('liquidates if interest accumulates (1 day)', async () => {
      // Open a vault at the boundary

      // When opening a vault without a credit score, a credit score of 0 is assumed
      const maxBorrowAmount = COLLATERAL_AMOUNT.mul(BASE).div(HIGH_C_RATIO);
      await setupBaseVault(COLLATERAL_AMOUNT, maxBorrowAmount);

      // Test that a liquidation will occur if the user accumulates enough debt via interest
      await arc.core().setInterestRate(utils.parseUnits('1', 'gwei'));

      await arc.updateTime(60 * 60 * 24);

      const preStablexBalance = await arc
        .synthetic()
        .balanceOf(signers.liquidator.address);
      const preCollateralBalance = await arc
        .collateral()
        .balanceOf(signers.liquidator.address);

      await arc.liquidate(
        signers.scoredMinter.address,
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.liquidator,
      );

      const vault = await arc.getVault(signers.scoredMinter.address);

      expect(vault.borrowedAmount).to.eq(0);
      expect(vault.collateralAmount).to.be.lt(COLLATERAL_AMOUNT);
      // Checking for "less than" because the interest had also been paid
      expect(
        await arc.synthetic().balanceOf(signers.liquidator.address),
      ).to.be.lt(preStablexBalance.sub(maxBorrowAmount));
      expect(
        await arc.collateral().balanceOf(signers.liquidator.address),
      ).to.be.gt(preCollateralBalance);
    });

    it.skip('liquidates if interest accumulates (1 year)', async () => {
      // Open a vault at the boundary

      // When opening a vault without a credit score, a credit score of 0 is assumed
      const maxBorrowAmount = COLLATERAL_AMOUNT.mul(BASE).div(HIGH_C_RATIO);
      await setupBaseVault(COLLATERAL_AMOUNT, maxBorrowAmount);

      // Test that a liquidation will occur if the user accumulates enough debt via interest
      await arc.core().setInterestRate('1000000');

      await arc.updateTime(ONE_YEAR_IN_SECONDS);

      const preStablexBalance = await arc
        .synthetic()
        .balanceOf(signers.liquidator.address);
      const preCollateralBalance = await arc
        .collateral()
        .balanceOf(signers.liquidator.address);

      await arc.liquidate(
        signers.scoredMinter.address,
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.liquidator,
      );

      const vault = await arc.getVault(signers.scoredMinter.address);

      expect(vault.borrowedAmount).to.eq(0);
      expect(vault.collateralAmount).to.be.lt(COLLATERAL_AMOUNT);
      // Checking for "less than" because the interest had also been paid
      expect(
        await arc.synthetic().balanceOf(signers.liquidator.address),
      ).to.be.lt(preStablexBalance.sub(maxBorrowAmount));
      expect(
        await arc.collateral().balanceOf(signers.liquidator.address),
      ).to.be.gt(preCollateralBalance);
    });

    // Test 3 in https://docs.google.com/spreadsheets/d/1rmFbUxnM4gyi1xhcYKBwcdadvXrHBPKbeX7DLk8KQgE/edit?usp=sharing
    it('liquidates again if the price drops', async () => {
      // If the price drops twice, the vault bes liquidated twice

      await setupBaseVault(COLLATERAL_AMOUNT, BORROW_AMOUNT);

      // Set the price to $0.75 so the c-ratio drops at 150%
      let newPrice = utils.parseEther('0.65');
      await arc.updatePrice(newPrice);

      let {
        stablexAmt: preStablexBalance,
        collateralAmt: preCollateralBalance,
        arcCollateralAmt: preArcCollateralAmt,
        stablexTotalSupply: preStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);

      // Liquidate
      await arc.liquidate(
        signers.scoredMinter.address,
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.liquidator,
      );

      let {
        stablexAmt: postStablexBalance,
        collateralAmt: postCollateralBalance,
        arcCollateralAmt: postArcCollateralAmt,
        stablexTotalSupply: postStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);

      expect(postStablexBalance).to.eq(
        preStablexBalance.sub(BORROW_AMOUNT).sub(2),
      ); // -2 for rounding
      expect(postCollateralBalance).to.eq(
        preCollateralBalance
          .add(utils.parseUnits('805.454933', DEFAULT_COLLATERAL_DECIMALS))
          .add(1), // +1 for rounding
      );
      expect(postArcCollateralAmt).to.eq(
        preArcCollateralAmt.add(
          utils.parseUnits('4.261666', DEFAULT_COLLATERAL_DECIMALS),
        ),
      );
      expect(postStablexTotalSupply).to.eq(
        preStablexTotalSupply.sub(BORROW_AMOUNT).sub(2), // -2 for rounding
      );

      // Borrow to the limit (up to 150% c-ratio)
      const vault = await arc.getVault(signers.scoredMinter.address);
      const maxBorrowAmount = vault.collateralAmount
        .mul(PRECISION_SCALAR)
        .mul(newPrice)
        .div(utils.parseEther('1.5'));

      await arc.borrow(
        maxBorrowAmount,
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.scoredMinter,
      );

      // Drop the price to $0.56 to bring the c-ratio down to ~130% again
      newPrice = utils.parseEther('0.56');
      await arc.updatePrice(newPrice);

      ({
        stablexAmt: preStablexBalance,
        collateralAmt: preCollateralBalance,
        arcCollateralAmt: preArcCollateralAmt,
        stablexTotalSupply: preStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator));

      // Liquidate again
      await arc.liquidate(
        signers.scoredMinter.address,
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.liquidator,
      );

      ({
        stablexAmt: postStablexBalance,
        collateralAmt: postCollateralBalance,
        arcCollateralAmt: postArcCollateralAmt,
        stablexTotalSupply: postStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator));

      // check the numbers again
      expect(postStablexBalance, 'stablex').to.eq(
        preStablexBalance.sub(maxBorrowAmount).sub(2), // -2 for rounding
      );
      expect(postCollateralBalance, 'collat').to.eq(
        preCollateralBalance.add(
          utils.parseUnits('154.176994', DEFAULT_COLLATERAL_DECIMALS),
        ),
      );
      expect(postArcCollateralAmt, 'arc').to.eq(
        preArcCollateralAmt.add(
          utils.parseUnits('0.815751', DEFAULT_COLLATERAL_DECIMALS),
        ),
      );
      expect(postStablexTotalSupply, 'supply').to.eq(
        preStablexTotalSupply.sub(maxBorrowAmount).sub(2), // -2 for rounding
      );
    });

    it('should not liquidate if proof is not provided', async () => {
      await setupBaseVault(COLLATERAL_AMOUNT, BORROW_AMOUNT);

      await expect(
        arc.liquidate(
          signers.scoredMinter.address,
          undefined,
          undefined,
          signers.liquidator,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: proof.account does not match the user to liquidate',
      );
    });

    it('should not liquidate a collateralized vault ', async () => {
      await setupBaseVault();

      await expect(
        arc.liquidate(
          signers.scoredMinter.address,
          getScoreProof(minterCreditScore, creditScoreTree),
          undefined,
          signers.liquidator,
        ),
      ).to.be.revertedWith('SapphireCoreV1: vault is collateralized');
    });

    it(`should not liquidate if liquidator provides a score proof that is not the owner's`, async () => {
      await setupBaseVault();

      // A new user with credit score 0 is added to the tree
      const zeroCreditScore = {
        account: signers.staker.address,
        amount: BigNumber.from(0),
      };
      const newCreditTree = new CreditScoreTree([
        zeroCreditScore,
        liquidatorCreditScore,
        minterCreditScore,
      ]);

      await immediatelyUpdateMerkleRoot(
        creditScoreContract.connect(signers.interestSetter),
        newCreditTree.getHexRoot(),
      );

      /**
       * Drop the price to $0.70 to bring the c-ratio down to 140%.
       * The scored minter should be protected from liquidations since
       * he has a credit score of 500, which makes him immune until a
       * c-ratio of 132.5%.
       */
      await arc.updatePrice(utils.parseEther('0.7'));

      await expect(
        arc.liquidate(
          signers.scoredMinter.address,
          getScoreProof(zeroCreditScore, newCreditTree),
          undefined,
          signers.liquidator,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: proof.account does not match the user to liquidate',
      );
    });

    // Test 4 in https://docs.google.com/spreadsheets/d/1rmFbUxnM4gyi1xhcYKBwcdadvXrHBPKbeX7DLk8KQgE/edit?usp=sharing
    it('should not liquidate if the credit score improved such that vault is immune to liquidations', async () => {
      /**
       * The user is under-collateralised, but their credit score increases
       * making them immune to the liquidation and causing it to throw
       */

      // First, open the vault with a credit score of 0
      let newMinterCreditScore = {
        account: signers.scoredMinter.address,
        amount: BigNumber.from(0),
      };
      let newCreditTree = new CreditScoreTree([
        newMinterCreditScore,
        liquidatorCreditScore,
      ]);
      await immediatelyUpdateMerkleRoot(
        creditScoreContract.connect(signers.interestSetter),
        newCreditTree.getHexRoot(),
      );

      await setupBaseVault(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        undefined,
        getScoreProof(newMinterCreditScore, newCreditTree),
      );

      // Drop the price to $0.70 to bring the c-ratio down to 140%
      await arc.updatePrice(utils.parseEther('0.7'));

      /**
       * The vault is vulnerable for liquidation at this point.
       * The user increases his credit score to 500 to protect himself from liquidation
       * since the liquidation c-ratio decreases from 150% to 132.5%
       */

      newMinterCreditScore = {
        account: signers.scoredMinter.address,
        amount: BigNumber.from(500),
      };
      newCreditTree = new CreditScoreTree([
        newMinterCreditScore,
        liquidatorCreditScore,
      ]);
      await immediatelyUpdateMerkleRoot(
        creditScoreContract.connect(signers.interestSetter),
        newCreditTree.getHexRoot(),
      );

      // The user tries to liquidate but tx is reverted
      await expect(
        arc.liquidate(
          signers.scoredMinter.address,
          getScoreProof(newMinterCreditScore, newCreditTree),
        ),
      ).to.be.revertedWith('SapphireCoreV1: vault is collateralized');
    });

    it('should not liquidate without enough debt', async () => {
      await setupBaseVault();

      await arc.updatePrice(utils.parseEther('0.65'));

      // Burn enough stablex from the liquidator so that less than the amount required remains
      const burnAmount = BORROW_AMOUNT.mul(utils.parseEther('2')).div(BASE);
      const synthContract = arc.synthetic().connect(signers.liquidator);
      await synthContract.burn(burnAmount);

      await expect(
        arc.liquidate(
          signers.scoredMinter.address,
          getScoreProof(minterCreditScore, creditScoreTree),
          undefined,
          signers.liquidator,
        ),
      ).to.be.revertedWith(
        'SyntheticTokenV2: sender does not have enough balance',
      );
    });

    it('should not liquidate if the price increases', async () => {
      await setupBaseVault();

      // Price drops, setting the c-ratio to 130%
      await arc.updatePrice(utils.parseEther('0.65'));

      // Vault is vulnerable here. Price increases again so the c-ratio becomes 133%
      // (the liquidation c-ratio is 132.5%)
      await arc.updatePrice(utils.parseEther('0.665'));

      await expect(
        arc.liquidate(
          signers.scoredMinter.address,
          getScoreProof(minterCreditScore, creditScoreTree),
        ),
      ).to.be.revertedWith('SapphireCoreV1: vault is collateralized');
    });

    it('should not liquidate twice in a row', async () => {
      /**
       * Given the price does not change, there isn't a lot of time elapsed and the credit score
       * did not drop significantly, someone should not be able to liquidate twice or more in a row
       */

      await setupBaseVault();

      // Price drops, setting the c-ratio to 130%
      await arc.updatePrice(utils.parseEther('0.65'));

      // Liquidate vault
      await arc.liquidate(
        signers.scoredMinter.address,
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.liquidator,
      );

      // Liquidate vault again
      await expect(
        arc.liquidate(
          signers.scoredMinter.address,
          getScoreProof(minterCreditScore, creditScoreTree),
          undefined,
          signers.liquidator,
        ),
      ).to.be.revertedWith('SapphireCoreV1: vault is collateralized');

      // Liquidate vault again
      await expect(
        arc.liquidate(
          signers.scoredMinter.address,
          getScoreProof(minterCreditScore, creditScoreTree),
          undefined,
          signers.liquidator,
        ),
      ).to.be.revertedWith('SapphireCoreV1: vault is collateralized');
    });

    it('should not liquidate if contract is paused', async () => {
      await setupBaseVault();

      // Price drops, setting the c-ratio to 130%
      await arc.updatePrice(utils.parseEther('0.65'));

      await arc.core().connect(signers.pauseOperator).setPause(true);

      await expect(
        arc.liquidate(
          signers.scoredMinter.address,
          getScoreProof(minterCreditScore, creditScoreTree),
          undefined,
          signers.liquidator,
        ),
      ).to.be.revertedWith('SapphireCoreV1: the contract is paused');
    });

    it('should not liquidate if the collateral price is stale', async () => {
      await setupBaseVault();

      const now = BigNumber.from(Date.now());

      // Set the core timestamp to now
      await arc.updateTime(now);

      // Set the price to $0.75 so the c-ratio drops at 150%
      await arc.updatePrice(COLLATERAL_PRICE.div(2));

      // Set the oracle timestamp to > half a day
      await arc.setOracleTimestamp(now.sub(60 * 60 * 12 + 1));

      await expect(
        arc.liquidate(
          signers.scoredMinter.address,
          getScoreProof(minterCreditScore, creditScoreTree),
          undefined,
          signers.liquidator,
        ),
      ).to.be.revertedWith('SapphireCoreV1: the oracle has stale prices');
    });
  });

  // Accompanying sheet: https://docs.google.com/spreadsheets/d/1rmFbUxnM4gyi1xhcYKBwcdadvXrHBPKbeX7DLk8KQgE/edit#gid=387958619
  describe('Scenarios', () => {
    it('Scenario 1: the vault gets liquidated because the collateral price hits the liquidation price', async () => {
      // User opens a vault of 1000 tokens and borrows at a 200% c-ratio
      await setupBaseVault(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        undefined,
        getScoreProof(minterCreditScore, creditScoreTree),
      );

      // Price increases to $1.35
      await arc.updatePrice(utils.parseEther('1.35'));

      // User increases his borrow amount by $500
      await arc.borrow(
        utils.parseEther('500'),
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.scoredMinter,
      );

      // Price decreases to $1.16. The vault's c-ratio becomes 132.24%
      await arc.updatePrice(utils.parseEther('1.16'));

      // The collateral price is under the liquidation price. The liquidation occurs

      const {
        stablexAmt: preStablexBalance,
        collateralAmt: preCollateralBalance,
        arcCollateralAmt: preArcCollateralAmt,
        stablexTotalSupply: preStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);

      // Liquidate vault
      await arc.liquidate(
        signers.scoredMinter.address,
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.liquidator,
      );

      const {
        stablexAmt: postStablexBalance,
        collateralAmt: postCollateralBalance,
        arcCollateralAmt: postArcCollateralAmt,
        stablexTotalSupply: postStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);

      // The debt has been taken from the liquidator (STABLEx)
      const stableXPaid = utils.parseEther('1000');
      expect(postStablexBalance).to.eq(
        preStablexBalance.sub(stableXPaid).sub(3),
      ); // -3 for rounding

      // The collateral has been given to the liquidator
      expect(postCollateralBalance).to.eq(
        preCollateralBalance
          .add(utils.parseUnits('902.665011', DEFAULT_COLLATERAL_DECIMALS))
          .add(1), // +1 for rounding
      );

      // A portion of collateral is sent to the fee collector
      expect(postArcCollateralAmt).eq(
        preArcCollateralAmt.add(
          utils.parseUnits('4.776005', DEFAULT_COLLATERAL_DECIMALS),
        ),
      );

      // The total STABLEx supply has decreased
      expect(postStablexTotalSupply).to.eq(
        preStablexTotalSupply.sub(stableXPaid).sub(3), // -3 bc of rounding
      );

      // The vault collateral amount has decreased
      const postLiquidationVault = await arc.getVault(
        signers.scoredMinter.address,
      );
      expect(postLiquidationVault.collateralAmount).to.eq(
        utils.parseUnits('92.558984', DEFAULT_COLLATERAL_DECIMALS).sub(1), // -1 bc of rounding
      );

      expect(postLiquidationVault.borrowedAmount).to.eq(0);
    });

    it('Scenario 2: The borrow amount is greater than the collateral value and a liquidation occurs', async () => {
      // User opens a vault of 1000 tokens and borrows at a 200% c-ratio
      await setupBaseVault(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        undefined,
        getScoreProof(minterCreditScore, creditScoreTree),
      );

      // Price decreases to $0.45
      const newPrice = utils.parseEther('0.45');
      await arc.updatePrice(newPrice);

      const vault = await arc.getVault(signers.scoredMinter.address);

      // Ensure that vault is undercollateralized
      const cRatio = vault.collateralAmount
        .mul(newPrice)
        .div(vault.borrowedAmount);
      expect(cRatio).to.be.lt(utils.parseEther('1'));

      // The liquidation occurs. The entire collateral is sold at discount and the user has an outstanding debt

      const {
        stablexAmt: preStablexBalance,
        collateralAmt: preCollateralBalance,
        arcCollateralAmt: preArcCollateralAmt,
        stablexTotalSupply: preStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);

      // Liquidate vault
      await arc.liquidate(
        signers.scoredMinter.address,
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.liquidator,
      );

      const {
        stablexAmt: postStablexBalance,
        collateralAmt: postCollateralBalance,
        arcCollateralAmt: postArcCollateralAmt,
        stablexTotalSupply: postStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);

      // The debt has been taken from the liquidator (STABLEx)
      const stableXPaid = utils.parseEther('427.5');
      expect(postStablexBalance).to.eq(
        preStablexBalance.sub(stableXPaid).sub(1000),
      ); // -1000 because of rounding of the collateral value

      // The collateral has been given to the liquidator
      expect(postCollateralBalance).to.eq(
        preCollateralBalance.add(
          utils.parseUnits('994.736843', DEFAULT_COLLATERAL_DECIMALS),
        ),
      );

      // A portion of collateral is sent to the fee collector
      expect(postArcCollateralAmt).eq(
        preArcCollateralAmt.add(
          utils.parseUnits('5.263157', DEFAULT_COLLATERAL_DECIMALS),
        ),
      );

      // The total STABLEx supply has decreased
      expect(postStablexTotalSupply).to.eq(
        preStablexTotalSupply.sub(stableXPaid).sub(1000), // -1000 for rounding
      );

      // The vault collateral amount is gone
      const postLiquidationVault = await arc.getVault(
        signers.scoredMinter.address,
      );
      expect(postLiquidationVault.collateralAmount).to.eq(0);

      const outstandingDebt = postLiquidationVault.borrowedAmount;

      // User shouldn't be able borrow and withdraw when vault is under collateralized and borrow amount is 0
      await expect(
        arc.borrow(
          constants.One,
          getScoreProof(minterCreditScore, creditScoreTree),
          undefined,
          signers.scoredMinter,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: the vault will become undercollateralized',
      );
      await expect(
        arc.withdraw(
          constants.One,
          getScoreProof(minterCreditScore, creditScoreTree),
          undefined,
          signers.scoredMinter,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: cannot withdraw more collateral than the vault balance',
      );

      const synthContract = arc.synthetic().connect(signers.scoredMinter);
      await synthContract.approve(arc.coreAddress(), outstandingDebt.add(1)); // +1 for rounding up

      await arc.repay(
        outstandingDebt.add(1), // +1 for rounding up
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.scoredMinter,
      );
      const redeemedVault = await arc.getVault(signers.scoredMinter.address);
      expect(redeemedVault.collateralAmount).to.eq(0);
      expect(redeemedVault.borrowedAmount).to.eq(0);
    });

    it('Scenario 3: the user changes their vault, then their credit score decreases and liquidation occurs', async () => {
      // User opens a vault of 1000 tokens and borrows at a 200% c-ratio
      await setupBaseVault();

      // User removes 100 collateral
      await arc.withdraw(
        utils.parseUnits('100', DEFAULT_COLLATERAL_DECIMALS),
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.scoredMinter,
      );

      // User repays $150
      const synthContract = arc.synthetic().connect(signers.scoredMinter);
      await synthContract.approve(arc.coreAddress(), utils.parseEther('150'));

      await arc.repay(
        utils.parseEther('150'),
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.scoredMinter,
      );

      // The collateral price drops to $0.54
      await arc.updatePrice(utils.parseEther('0.54'));

      // Credit score drops to 50
      const newMinterCreditScore = {
        account: signers.scoredMinter.address,
        amount: BigNumber.from(50),
      };
      const newCreditTree = new CreditScoreTree([
        newMinterCreditScore,
        liquidatorCreditScore,
      ]);
      await immediatelyUpdateMerkleRoot(
        creditScoreContract.connect(signers.interestSetter),
        newCreditTree.getHexRoot(),
      );

      const {
        stablexAmt: preStablexBalance,
        collateralAmt: preCollateralBalance,
        arcCollateralAmt: preArcCollateralAmt,
        stablexTotalSupply: preStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);

      // Liquidation occurs
      await arc.liquidate(
        signers.scoredMinter.address,
        getScoreProof(newMinterCreditScore, newCreditTree),
        undefined,
        signers.liquidator,
      );

      const {
        stablexAmt: postStablexBalance,
        collateralAmt: postCollateralBalance,
        arcCollateralAmt: postArcCollateralAmt,
        stablexTotalSupply: postStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);
      const debtPaid = ArcNumber.new(350);

      // The debt has been taken from the liquidator (STABLEx)
      expect(postStablexBalance).to.eq(preStablexBalance.sub(debtPaid).sub(3)); // -3 bc of rounding

      // The collateral has been given to the liquidator
      expect(postCollateralBalance).to.eq(
        preCollateralBalance
          .add(utils.parseUnits('678.670360', DEFAULT_COLLATERAL_DECIMALS))
          .add(1), // +1 for rounding up
      );

      // A portion of collateral is sent to the fee collector
      expect(postArcCollateralAmt).eq(
        preArcCollateralAmt.add(
          utils.parseUnits('3.590848', DEFAULT_COLLATERAL_DECIMALS),
        ),
      );

      // The total STABLEx supply has decreased
      expect(postStablexTotalSupply).to.eq(
        preStablexTotalSupply.sub(debtPaid).sub(3),
      ); // -3 for rounding

      // The vault collateral amount has decreased
      const postLiquidationVault = await arc.getVault(
        signers.scoredMinter.address,
      );
      expect(postLiquidationVault.collateralAmount).to.eq(
        utils.parseUnits('217.738792', DEFAULT_COLLATERAL_DECIMALS).sub(1), // -1 for rounding
      );

      // The vault debt amount has been paid off
      expect(postLiquidationVault.borrowedAmount).to.eq(0);
    });

    it('Scenario 4: the user changes their vault, then their credit score increases which protects him from liquidation. Then the price drops and gets liquidated', async () => {
      // User opens a vault of 1000 tokens and borrows at a 200% c-ratio
      await setupBaseVault(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        undefined,
        getScoreProof(minterCreditScore, creditScoreTree),
      );

      // User borrows close to the maximum amount. The min c-ratio is 132.5% so user $245 more
      await arc.borrow(
        utils.parseEther('245'),
        getScoreProof(minterCreditScore, creditScoreTree),
        undefined,
        signers.scoredMinter,
      );

      // Price drops to $0.91. Vault is in danger but not liquidated yet
      await arc.updatePrice(utils.parseEther('0.91'));

      // User's credit score increases to 950
      const newMinterCreditScore = {
        account: signers.scoredMinter.address,
        amount: BigNumber.from(950),
      };
      const newCreditTree = new CreditScoreTree([
        newMinterCreditScore,
        liquidatorCreditScore,
      ]);
      await immediatelyUpdateMerkleRoot(
        creditScoreContract.connect(signers.interestSetter),
        newCreditTree.getHexRoot(),
      );

      // Liquidator tries to liquidate but tx reverts, because the user's credit score
      // lowered the c-ratio when the liquidation happens
      await expect(
        arc.liquidate(
          signers.scoredMinter.address,
          getScoreProof(newMinterCreditScore, newCreditTree),
          undefined,
          signers.liquidator,
        ),
      ).to.be.revertedWith('SapphireCoreV1: vault is collateralized');

      // Price drops to $0.82. Vault is liquidated
      await arc.updatePrice(utils.parseEther('0.82'));

      const {
        stablexAmt: preStablexBalance,
        collateralAmt: preCollateralBalance,
        arcCollateralAmt: preArcCollateralAmt,
        stablexTotalSupply: preStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);

      // Liquidation occurs
      await arc.liquidate(
        signers.scoredMinter.address,
        getScoreProof(newMinterCreditScore, newCreditTree),
        undefined,
        signers.liquidator,
      );

      const {
        stablexAmt: postStablexBalance,
        collateralAmt: postCollateralBalance,
        arcCollateralAmt: postArcCollateralAmt,
        stablexTotalSupply: postStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);
      const debtPaid = utils.parseEther('745');

      // The debt has been taken from the liquidator (STABLEx)
      expect(postStablexBalance, 'stablex').to.eq(
        preStablexBalance.sub(debtPaid).sub(3), // -3 for rounding
      );

      // The collateral has been given to the liquidator
      expect(postCollateralBalance, 'collateral').to.eq(
        preCollateralBalance
          .add(utils.parseUnits('951.320857', DEFAULT_COLLATERAL_DECIMALS))
          .add(1), // +1 for rounding up
      );

      // A portion of collateral is sent to the fee collector
      expect(postArcCollateralAmt, 'arc share').eq(
        preArcCollateralAmt.add(
          utils.parseUnits('5.033443', DEFAULT_COLLATERAL_DECIMALS),
        ),
      );

      // The total STABLEx supply has decreased
      expect(postStablexTotalSupply, 'stablex total supply').to.eq(
        preStablexTotalSupply.sub(debtPaid).sub(3), // -3 for rounding
      );

      // The vault collateral amount has decreased
      const postLiquidationVault = await arc.getVault(
        signers.scoredMinter.address,
      );
      expect(postLiquidationVault.collateralAmount, 'vault collateral').to.eq(
        utils.parseUnits('43.645700', DEFAULT_COLLATERAL_DECIMALS).sub(1), // -1 bc of rounding
      );

      // The vault debt amount has been paid off
      expect(
        postLiquidationVault.borrowedAmount,
        'vault borrowed amount',
      ).to.eq(0);
    });
  });
});
