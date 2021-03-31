import { SapphireTestArc } from '@src/SapphireTestArc';
import { BigNumber, utils } from 'ethers';
import 'module-alias/register';
import { generateContext, ITestContext } from '../context';
import { setupSapphire } from '../setup';
import { sapphireFixture } from '../fixtures';
import ArcDecimal from '@src/utils/ArcDecimal';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import ArcNumber from '@src/utils/ArcNumber';
import { TestingSigners } from '@arc-types/testing';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  MockSapphireCreditScore,
  MockSapphireCreditScoreFactory,
  SapphireMapperLinear,
  TestTokenFactory,
} from '@src/typings';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { IERC20Factory } from '@src/typings/IERC20Factory';
import { CreditScore, CreditScoreProof } from '@arc-types/sapphireCore';
import { BASE, ONE_YEAR_IN_SECONDS } from '@src/constants';

chai.use(solidity);

const LOW_C_RATIO = utils.parseEther('1.5');
const HIGH_C_RATIO = utils.parseEther('1.5');
const LIQUIDATION_USER_FEE = utils.parseEther('0.1');
const LIQUIDATION_ARC_RATIO = utils.parseEther('0.1');
/**
 * The margin between the maximum borrow c-ratio and the c-ratio
 * when the vault gets liquidated.
 *
 * Ex: The maximum borrow amount has a c-ratio of 130% and the
 * c-ratio when the vault is liquidated is 120%, assuming the margin
 * is set at 10%
 */
const MARGIN_MAX_BORROW_AND_LIQ_PERCENT = utils.parseEther('0.1');

const COLLATERAL_AMOUNT = ArcNumber.new(1000);
const COLLATERAL_PRICE = ArcNumber.new(1);
const DEBT_AMOUNT = ArcNumber.new(500);

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
  let debtTokenAddress: string;
  let minterCreditScore: CreditScore;
  let liquidatorCreditScore: CreditScore;
  let collateralTokenAddress: string;

  function getScoreProof(
    creditScore: CreditScore,
    creditScoreTreeToCheck = creditScoreTree,
  ): CreditScoreProof {
    return {
      account: creditScore.account,
      score: creditScore.amount,
      merkleProof: creditScoreTreeToCheck.getProof(creditScore.account, creditScore.amount),
    };
  }

  /**
   * Returns useful balances to use when validating numbers before and after
   * a liquidation.
   * @param user The user to get the balances for
   */
  async function getBalancesForLiquidation(user: SignerWithAddress) {
    const userAddress = user.address;

    const stablexAmt = await arc.synthetic().balanceOf(userAddress);
    const collateralAmt = await arc.collateral().balanceOf(userAddress);
    const arcCollateralAmt = await arc.collateral().balanceOf(arc.core().address);
    const stablexTotalSupply = await arc.synthetic().totalSupply();

    return {
      stablexAmt,
      collateralAmt,
      arcCollateralAmt,
      stablexTotalSupply,
    };
  }

  /**
   * Returns the c-ratio when the liquidation happens for the minter
   */
  async function getLiquidationCRatio(): Promise<BigNumber> {
    const minCRatio = await mapper.map(minterCreditScore.amount, 1000, LOW_C_RATIO, HIGH_C_RATIO);
    return minCRatio.sub(MARGIN_MAX_BORROW_AND_LIQ_PERCENT);
  }

  function balanceOf(user: SignerWithAddress, tokenAddress: string): Promise<BigNumber> {
    const tokenContract = IERC20Factory.connect(tokenAddress, user);
    return tokenContract.balanceOf(user.address);
  }

  /**
   * Mints an amount of tokens to a user
   * @param receiver The user receiving the minted amount
   * @param tokenAddress The token address
   * @param mintAmount The amount to be minted
   */
  function mint(receiver: SignerWithAddress, tokenAddress: string, mintAmount: BigNumber) {
    const tokenContract = TestTokenFactory.connect(tokenAddress, receiver);
    return tokenContract.mintShare(receiver.address, mintAmount);
  }

  /**
   * Mints a `mintAmount` of `tokenAddress` to the `receiver` and approves
   * it to the `approveToAddress`
   *
   * @param receiver The user receiving the minted amount
   * @param tokenAddress The token address
   * @param approveToAddress Contract address to give the approval to
   * @param mintAmount The amount to be minted
   */
  async function mintAndApprove(
    receiver: SignerWithAddress,
    tokenAddress: string,
    approveToAddress: string,
    mintAmount: BigNumber,
  ) {
    const tokenContract = TestTokenFactory.connect(tokenAddress, receiver);

    await tokenContract.mintShare(receiver.address, mintAmount);
    await tokenContract.approve(approveToAddress, mintAmount);
  }

  /**
   * Sets up a basic vault using the `COLLATERAL_AMOUNT` amount at a price of `COLLATERAL_PRICE`
   * and a debt of `DEBT_AMOUNT` as defaults amounts, unless specified otherwise
   */
  async function setupBaseVault(
    collateralAmount = COLLATERAL_AMOUNT,
    debtAmount = DEBT_AMOUNT,
    collateralPrice = COLLATERAL_PRICE,
    scoreProof?: CreditScoreProof,
  ) {
    // Mint and approve collateral
    const collateralAddress = arc.collateral().address;
    await mintAndApprove(signers.minter, collateralAddress, arc.core().address, collateralAmount);

    // Set collateral price
    await arc.updatePrice(collateralPrice);

    // Open vault and mint debt
    await arc.open(collateralAmount, debtAmount, scoreProof);
  }

  async function init(ctx: ITestContext) {
    minterCreditScore = {
      account: ctx.signers.minter.address,
      amount: BigNumber.from(500),
    };

    liquidatorCreditScore = {
      account: ctx.signers.liquidator.address,
      amount: BigNumber.from(500),
    };

    creditScoreTree = new CreditScoreTree([minterCreditScore, liquidatorCreditScore]);

    creditScoreTree;

    await setupSapphire(ctx, {
      lowCollateralRatio: LOW_C_RATIO,
      highCollateralRatio: HIGH_C_RATIO,
      liquidationMarginPercent: MARGIN_MAX_BORROW_AND_LIQ_PERCENT,
      merkleRoot: creditScoreTree.getHexRoot(),
      fees: {
        liquidationUserFee: LIQUIDATION_USER_FEE,
        liquidationArcRatio: LIQUIDATION_ARC_RATIO,
      },
    });

    // Set the price to $1
    await arc.updatePrice(COLLATERAL_PRICE);

    // Mints enough STABLEx to the liquidator
    await mint(signers.liquidator, arc.synth().synthetic.address, COLLATERAL_AMOUNT);
  }

  before(async () => {
    const ctx = await generateContext(sapphireFixture, init);
    signers = ctx.signers;
    arc = ctx.sdks.sapphire;
    creditScoreContract = MockSapphireCreditScoreFactory.connect(
      ctx.contracts.sapphire.creditScore.address,
      signers.admin,
    );
    mapper = ctx.contracts.sapphire.linearMapper;
    collateralTokenAddress = arc.collateral().address;
    debtTokenAddress = arc.synth().synthetic.address;
  });

  addSnapshotBeforeRestoreAfterEach();

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

    expect(await balanceOf(signers.liquidator, debtTokenAddress)).to.be.gte(DEBT_AMOUNT);

    // Drop the price by half to make the vault under-collateralized
    const newPrice = COLLATERAL_PRICE.div(2);
    await arc.updatePrice(newPrice);

    // Make sure vault is under-collateralized
    const liquidationCRatio = await getLiquidationCRatio();
    const currentCRatio = COLLATERAL_AMOUNT.mul(newPrice).div(DEBT_AMOUNT);
    expect(currentCRatio).to.be.lte(liquidationCRatio);

    const {
      stablexAmt: preStablexBalance,
      collateralAmt: preCollateralBalance,
      arcCollateralAmt: preArcCollateralAmt,
      stablexTotalSupply: preStablexTotalSupply,
    } = await getBalancesForLiquidation(signers.liquidator);

    // Liquidate vault
    await arc.liquidate(
      signers.minter.address,
      getScoreProof(minterCreditScore),
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
    expect(postStablexBalance).to.eq(preStablexBalance.sub(ArcNumber.new(475)));

    // The collateral has been given to the liquidator
    expect(postCollateralBalance).to.eq(
      preCollateralBalance.add(utils.parseEther('994.736842105263')),
    );

    // A portion of collateral is sent to the fee collector
    expect(postArcCollateralAmt).eq(preArcCollateralAmt.add(utils.parseEther('5.26315789473684')));

    // The total STABLEx supply has decreased
    expect(postStablexTotalSupply).to.eq(preStablexTotalSupply.sub(ArcNumber.new(475)));

    // The vault collateral amount has decreased
    const postLiquidationVault = await arc.getVault(signers.minter.address);
    expect(postLiquidationVault.collateralAmount).to.eq(0);

    // The vault debt amount has decreased
    expect(postLiquidationVault.borrowedAmount).to.eq(DEBT_AMOUNT.sub(ArcNumber.new(475)));
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
      account: signers.minter.address,
      amount: BigNumber.from(50),
    };
    const newCreditTree = new CreditScoreTree([newMinterCreditScore, liquidatorCreditScore]);
    await creditScoreContract.updateMerkleRoot(newCreditTree.getHexRoot());

    const {
      stablexAmt: preStablexBalance,
      collateralAmt: preCollateralBalance,
      arcCollateralAmt: preArcCollateralAmt,
      stablexTotalSupply: preStablexTotalSupply,
    } = await getBalancesForLiquidation(signers.liquidator);

    // The liquidator submits the user's credit score and is then able to liquidate
    await arc.liquidate(
      signers.minter.address,
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
    expect(postStablexBalance).to.eq(preStablexBalance.sub(DEBT_AMOUNT));

    // The collateral has been given to the liquidator
    expect(postCollateralBalance).to.eq(
      preCollateralBalance.add(utils.parseEther('769.920156428222')),
    );

    // A portion of collateral is sent to the fee collector
    expect(postArcCollateralAmt).eq(preArcCollateralAmt.add(utils.parseEther('4.07365162131336')));

    // The total STABLEx supply has decreased
    expect(postStablexTotalSupply).to.eq(preStablexTotalSupply.sub(DEBT_AMOUNT));

    // The vault collateral amount has decreased
    const postLiquidationVault = await arc.getVault(signers.minter.address);
    expect(postLiquidationVault.collateralAmount).to.eq(utils.parseEther('226.006191950464'));

    // The vault debt amount has decreased
    expect(postLiquidationVault.borrowedAmount).to.eq(0);
  });

  it('liquidates if interest accumulates (1 day)', async () => {
    // Open a vault at the boundary
    // Set the liquidation safety margin to 0 so we can borrow at the edge
    await arc.core().setBorrowSafetyMargin(0);

    // When opening a vault without a credit score, a credit score of 0 is assumed
    const maxBorrowAmount = COLLATERAL_AMOUNT.mul(BASE).div(HIGH_C_RATIO);
    await setupBaseVault(COLLATERAL_AMOUNT, maxBorrowAmount);

    // Test that a liquidation will occur if the user accumulates enough debt via interest
    await arc.updateTime(60 * 60 * 24);

    await arc.core().updateIndex();

    const preStablexBalance = await arc.synthetic().balanceOf(signers.liquidator.address);
    const preCollateralBalance = await arc.collateral().balanceOf(signers.liquidator.address);

    await arc.liquidate(
      signers.minter.address,
      getScoreProof(minterCreditScore),
      undefined,
      signers.liquidator,
    );

    const vault = await arc.getVault(signers.minter.address);

    expect(vault.borrowedAmount).to.eq(0);
    expect(vault.collateralAmount).to.be.lt(COLLATERAL_AMOUNT);
    // Checking for "less than" because the interest had also been paid
    expect(await arc.synthetic().balanceOf(signers.liquidator.address)).to.be.lt(
      preStablexBalance.sub(maxBorrowAmount),
    );
    expect(await arc.collateral().balanceOf(signers.liquidator.address)).to.be.gt(
      preCollateralBalance,
    );
  });

  it('liquidates if interest accumulates (1 year)', async () => {
    // Open a vault at the boundary
    // Set the liquidation safety margin to 0 so we can borrow at the edge
    await arc.core().setBorrowSafetyMargin(0);

    // When opening a vault without a credit score, a credit score of 0 is assumed
    const maxBorrowAmount = COLLATERAL_AMOUNT.mul(BASE).div(HIGH_C_RATIO);
    await setupBaseVault(COLLATERAL_AMOUNT, maxBorrowAmount);

    // Test that a liquidation will occur if the user accumulates enough debt via interest
    await arc.updateTime(ONE_YEAR_IN_SECONDS);

    await arc.core().updateIndex();

    const preStablexBalance = await arc.synthetic().balanceOf(signers.liquidator.address);
    const preCollateralBalance = await arc.collateral().balanceOf(signers.liquidator.address);

    await arc.liquidate(
      signers.minter.address,
      getScoreProof(minterCreditScore),
      undefined,
      signers.liquidator,
    );

    const vault = await arc.getVault(signers.minter.address);

    expect(vault.borrowedAmount).to.eq(0);
    expect(vault.collateralAmount).to.be.lt(COLLATERAL_AMOUNT);
    // Checking for "less than" because the interest had also been paid
    expect(await arc.synthetic().balanceOf(signers.liquidator.address)).to.be.lt(
      preStablexBalance.sub(maxBorrowAmount),
    );
    expect(await arc.collateral().balanceOf(signers.liquidator.address)).to.be.gt(
      preCollateralBalance,
    );
  });

  // Test 3 in https://docs.google.com/spreadsheets/d/1rmFbUxnM4gyi1xhcYKBwcdadvXrHBPKbeX7DLk8KQgE/edit?usp=sharing
  it('liquidates again if the price drops', async () => {
    // If the price drops twice, the vault bes liquidated twice

    await setupBaseVault(COLLATERAL_AMOUNT, DEBT_AMOUNT);

    // Set the price to $0.75 so the c-ratio drops at 150%
    let newPrice = utils.parseEther('0.75');
    await arc.updatePrice(newPrice);

    let {
      stablexAmt: preStablexBalance,
      collateralAmt: preCollateralBalance,
      arcCollateralAmt: preArcCollateralAmt,
      stablexTotalSupply: preSTablexTotalSupply,
    } = await getBalancesForLiquidation(signers.liquidator);

    // Liquidate
    await arc.liquidate(
      signers.minter.address,
      getScoreProof(minterCreditScore),
      undefined,
      signers.liquidator,
    );

    let {
      stablexAmt: postStablexBalance,
      collateralAmt: postCollateralBalance,
      arcCollateralAmt: postArcCollateralAmt,
      stablexTotalSupply: postSTablexTotalSupply,
    } = await getBalancesForLiquidation(signers.liquidator);

    expect(postStablexBalance).to.eq(preStablexBalance.sub(DEBT_AMOUNT));
    expect(postCollateralBalance).to.eq(
      preCollateralBalance.add(utils.parseEther('698.060941828255')),
    );
    expect(postArcCollateralAmt).to.eq(
      preArcCollateralAmt.add(utils.parseEther('3.69344413665743')),
    );
    expect(postSTablexTotalSupply).to.eq(preSTablexTotalSupply.sub(DEBT_AMOUNT));

    // Borrow to the limit (up to 160% c-ratio)
    const vault = await arc.getVault(signers.minter.address);
    const maxBorrowAmount = COLLATERAL_AMOUNT.sub(vault.collateralAmount.value)
      .mul(newPrice)
      .div(utils.parseEther('1.6'));

    await arc.borrow(signers.minter.address, maxBorrowAmount);

    // Drop the price to $0.70 to bring the c-ratio down to 150% again
    newPrice = utils.parseEther('0.7');
    await arc.updatePrice(newPrice);

    ({
      stablexAmt: preStablexBalance,
      collateralAmt: preCollateralBalance,
      arcCollateralAmt: preArcCollateralAmt,
      stablexTotalSupply: preSTablexTotalSupply,
    } = await getBalancesForLiquidation(signers.liquidator));

    // Liquidate again
    await arc.liquidate(
      signers.minter.address,
      getScoreProof(minterCreditScore),
      undefined,
      signers.liquidator,
    );

    ({
      stablexAmt: postStablexBalance,
      collateralAmt: postCollateralBalance,
      arcCollateralAmt: postArcCollateralAmt,
      stablexTotalSupply: postSTablexTotalSupply,
    } = await getBalancesForLiquidation(signers.liquidator));

    // check the numbers again
    expect(postStablexBalance).to.eq(preStablexBalance.sub(maxBorrowAmount));
    expect(postCollateralBalance).to.eq(
      preCollateralBalance.add(utils.parseEther('208.19361422948')),
    );
    expect(postArcCollateralAmt).to.eq(
      preArcCollateralAmt.add(utils.parseEther('1.10155351444169')),
    );
    expect(postSTablexTotalSupply).to.eq(preSTablexTotalSupply.sub(maxBorrowAmount));
  });

  it('should not liquidate a collateralized vault ', async () => {
    await setupBaseVault();

    await expect(
      arc.liquidate(
        signers.minter.address,
        getScoreProof(minterCreditScore),
        undefined,
        signers.liquidator,
      ),
    ).to.be.revertedWith('SapphireCoreV1: vault is collateralized');
  });

  // Test 4 in https://docs.google.com/spreadsheets/d/1rmFbUxnM4gyi1xhcYKBwcdadvXrHBPKbeX7DLk8KQgE/edit?usp=sharing
  it('should not liquidate if the credit score improved such that vault is immune to liquidations', async () => {
    /**
     * The user is under-collateralised, but their credit score increases
     * making them immune to the liquidation and causing it to throw
     */

    // First, open the vault with a credit score of 0
    let newMinterCreditScore = {
      account: signers.minter.address,
      amount: BigNumber.from(0),
    };
    let newCreditTree = new CreditScoreTree([newMinterCreditScore, liquidatorCreditScore]);
    await creditScoreContract.updateMerkleRoot(newCreditTree.getHexRoot());

    await setupBaseVault(
      COLLATERAL_AMOUNT,
      DEBT_AMOUNT,
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
      account: signers.minter.address,
      amount: BigNumber.from(500),
    };
    newCreditTree = new CreditScoreTree([newMinterCreditScore, liquidatorCreditScore]);
    await creditScoreContract.updateMerkleRoot(newCreditTree.getHexRoot());

    // The user tries to liquidate but tx is reverted
    await expect(
      arc.liquidate(signers.minter.address, getScoreProof(newMinterCreditScore, newCreditTree)),
    ).to.be.revertedWith('SapphireCoreV1: vault is collateralized');
  });

  it('should not liquidate without enough debt', async () => {
    await setupBaseVault();

    await arc.updatePrice(utils.parseEther('0.65'));

    // Burn enough stablex from the liquidator so that only half the amount required remains
    const { stablexAmt: curerntStablexBalance } = await getBalancesForLiquidation(
      signers.liquidator,
    );
    const burnAmount = curerntStablexBalance
      .sub(curerntStablexBalance.sub(DEBT_AMOUNT))
      .sub(DEBT_AMOUNT.div(2));
    await arc.synthetic().burn(signers.liquidator.address, burnAmount);

    await expect(
      arc.liquidate(
        signers.minter.address,
        getScoreProof(minterCreditScore),
        undefined,
        signers.liquidator,
      ),
    ).to.be.revertedWith('SyntheticToken: cannot burn more than the user balance');
  });

  it('should not liquidate if the price increases', async () => {
    await setupBaseVault();

    // Price drops, setting the c-ratio to 130%
    await arc.updatePrice(utils.parseEther('0.65'));

    // Vault is vulnerable here. Price increases again so the c-ratio becomes 133%
    // (the liquidation c-ratio is 132.5%)
    await arc.updatePrice(utils.parseEther('0.665'));

    await expect(
      arc.liquidate(signers.minter.address, getScoreProof(minterCreditScore)),
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
      signers.minter.address,
      getScoreProof(minterCreditScore),
      undefined,
      signers.liquidator,
    );

    // Liquidate vault again
    await expect(
      arc.liquidate(
        signers.minter.address,
        getScoreProof(minterCreditScore),
        undefined,
        signers.liquidator,
      ),
    ).to.be.revertedWith('SapphireCoreV1: there is no debt to liquidate');

    // Liquidate vault again
    await expect(
      arc.liquidate(
        signers.minter.address,
        getScoreProof(minterCreditScore),
        undefined,
        signers.liquidator,
      ),
    ).to.be.revertedWith('SapphireCoreV1: there is no debt to liquidate');
  });

  // Accompanying sheet: https://docs.google.com/spreadsheets/d/1rmFbUxnM4gyi1xhcYKBwcdadvXrHBPKbeX7DLk8KQgE/edit#gid=387958619
  describe('Scenarios', () => {
    it('Scenario 1: the vault gets liquidated because the collateral price hits the liquidation price', async () => {
      // User opens a vault of 1000 tokens and borrows at a 200% c-ratio
      await setupBaseVault(
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT,
        undefined,
        getScoreProof(minterCreditScore),
      );

      // Price increases to $1.25
      await arc.updatePrice(utils.parseEther('1.25'));

      // User maxes out his borrow amount.
      // $377.19298245614 is the max borrow amount ($877.19) - 500
      await arc.borrow(
        signers.minter.address,
        utils.parseEther('377.19298245614'),
        getScoreProof(minterCreditScore),
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
        signers.minter.address,
        getScoreProof(minterCreditScore),
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
      const stableXPaid = utils.parseEther('877.19298245614');
      expect(postStablexBalance).to.eq(preStablexBalance.sub(stableXPaid));

      // The collateral has been given to the liquidator
      expect(postCollateralBalance).to.eq(
        preCollateralBalance.add(utils.parseEther('790.421764628731')),
      );

      // A portion of collateral is sent to the fee collector
      expect(postArcCollateralAmt).eq(
        preArcCollateralAmt.add(utils.parseEther('4.01716287871692')),
      );

      // The total STABLEx supply has decreased
      expect(postStablexTotalSupply).to.eq(preStablexTotalSupply.sub(stableXPaid));

      // The vault collateral amount has decreased
      const postLiquidationVault = await arc.getVault(signers.minter.address);
      expect(postLiquidationVault.collateralAmount).to.eq(utils.parseEther('205.561072492552'));

      expect(postLiquidationVault.borrowedAmount).to.eq(0);
    });

    it('Scenario 2: The borrow amount is greater than the collateral value and a liquidation occurs', async () => {
      // User opens a vault of 1000 tokens and borrows at a 200% c-ratio
      await setupBaseVault(
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT,
        undefined,
        getScoreProof(minterCreditScore),
      );

      // Price decreases to $0.45
      await arc.updatePrice(utils.parseEther('0.45'));

      // The liquidation occurs. The entire collateral is sold at discount and the user has an outstanding debt

      const {
        stablexAmt: preStablexBalance,
        collateralAmt: preCollateralBalance,
        arcCollateralAmt: preArcCollateralAmt,
        stablexTotalSupply: preStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);

      // Liquidate vault
      await arc.liquidate(
        signers.minter.address,
        getScoreProof(minterCreditScore),
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
      expect(postStablexBalance).to.eq(preStablexBalance.sub(stableXPaid));

      // The collateral has been given to the liquidator
      expect(postCollateralBalance).to.eq(
        preCollateralBalance.add(utils.parseEther('994.736842105263')),
      );

      // A portion of collateral is sent to the fee collector
      expect(postArcCollateralAmt).eq(
        preArcCollateralAmt.add(utils.parseEther('5.26315789473684')),
      );

      // The total STABLEx supply has decreased
      expect(postStablexTotalSupply).to.eq(preStablexTotalSupply.sub(stableXPaid));

      // The vault collateral amount is gone
      const postLiquidationVault = await arc.getVault(signers.minter.address);
      expect(postLiquidationVault.collateralAmount).to.eq(0);

      expect(postLiquidationVault.borrowedAmount).to.eq(utils.parseEther('72.5'));
    });

    it('Scenario 3: the user changes their vault, then their credit score decreases and liquidation occurs', async () => {
      // User opens a vault of 1000 tokens and borrows at a 200% c-ratio
      await setupBaseVault();

      // User removes 100 collateral
      await arc.withdraw(
        signers.minter.address,
        ArcNumber.new(100),
        getScoreProof(minterCreditScore),
      );

      // User repays $150
      await arc.repay(signers.minter.address, ArcNumber.new(150), getScoreProof(minterCreditScore));

      // The collateral price drops to $0.54
      await arc.updatePrice(utils.parseEther('0.54'));

      // Credit score drops to 50
      const newMinterCreditScore = {
        account: signers.minter.address,
        amount: BigNumber.from(50),
      };
      const newCreditTree = new CreditScoreTree([newMinterCreditScore, liquidatorCreditScore]);
      await creditScoreContract.updateMerkleRoot(newCreditTree.getHexRoot());

      const {
        stablexAmt: preStablexBalance,
        collateralAmt: preCollateralBalance,
        arcCollateralAmt: preArcCollateralAmt,
        stablexTotalSupply: preStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);

      // Liquidation occurs
      await arc.liquidate(
        signers.minter.address,
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
      expect(postStablexBalance).to.eq(preStablexBalance.sub(debtPaid));

      // The collateral has been given to the liquidator
      expect(postCollateralBalance).to.eq(
        preCollateralBalance.add(utils.parseEther('678.670360110803')),
      );

      // A portion of collateral is sent to the fee collector
      expect(postArcCollateralAmt).eq(
        preArcCollateralAmt.add(utils.parseEther('3.59084846619473')),
      );

      // The total STABLEx supply has decreased
      expect(postStablexTotalSupply).to.eq(preStablexTotalSupply.sub(debtPaid));

      // The vault collateral amount has decreased
      const postLiquidationVault = await arc.getVault(signers.minter.address);
      expect(postLiquidationVault.collateralAmount).to.eq(utils.parseEther('217.738791423'));

      // The vault debt amount has been paid off
      expect(postLiquidationVault.borrowedAmount).to.eq(0);
    });

    it('Scenario 4: the user changes their vault, then their credit score increases which protects him from liquidation. Then the price drops and gets liquidated', async () => {
      // User opens a vault of 1000 tokens and borrows at a 200% c-ratio
      await setupBaseVault(
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT,
        undefined,
        getScoreProof(minterCreditScore),
      );

      // User borrows maximum amount, which is up to 142.50% or $701.754385964912 - $500 = 201.7543859649
      await arc.borrow(
        signers.minter.address,
        utils.parseEther('201.7543859649'),
        getScoreProof(minterCreditScore),
      );

      // Price drops to $0.91. Vault is in danger but not liquidated yet
      await arc.updatePrice(utils.parseEther('0.91'));

      // User's credit score increases to 950
      const newMinterCreditScore = {
        account: signers.minter.address,
        amount: BigNumber.from(950),
      };
      const newCreditTree = new CreditScoreTree([newMinterCreditScore, liquidatorCreditScore]);
      await creditScoreContract.updateMerkleRoot(newCreditTree.getHexRoot());

      // Liquidator tries to liquidate but tx reverts, because the user's credit score
      // lowered the c-ratio when the liquidation happens
      await expect(
        arc.liquidate(signers.minter.address, undefined, undefined, signers.liquidator),
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
      await arc.liquidate(signers.minter.address, undefined, undefined, signers.liquidator);

      const {
        stablexAmt: postStablexBalance,
        collateralAmt: postCollateralBalance,
        arcCollateralAmt: postArcCollateralAmt,
        stablexTotalSupply: postStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);
      const debtPaid = utils.parseEther('701.754385964912');

      // The debt has been taken from the liquidator (STABLEx)
      expect(postStablexBalance).to.eq(preStablexBalance.sub(debtPaid));

      // The collateral has been given to the liquidator
      expect(postCollateralBalance).to.eq(
        preCollateralBalance.add(utils.parseEther('896.09876999776')),
      );

      // A portion of collateral is sent to the fee collector
      expect(postArcCollateralAmt).eq(
        preArcCollateralAmt.add(utils.parseEther('4.74126333332148')),
      );

      // The total STABLEx supply has decreased
      expect(postStablexTotalSupply).to.eq(preStablexTotalSupply.sub(debtPaid));

      // The vault collateral amount has decreased
      const postLiquidationVault = await arc.getVault(signers.minter.address);
      expect(postLiquidationVault.collateralAmount).to.eq(utils.parseEther('298.245614035088'));

      // The vault debt amount has been paid off
      expect(postLiquidationVault.borrowedAmount).to.eq(0);
    });
  });
});
