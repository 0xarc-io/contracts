import { SapphireTestArc } from '@src/SapphireTestArc';
import { BigNumber } from 'ethers';
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

const LOW_C_RATIO = ArcDecimal.new(1.15);
const HIGH_C_RATIO = ArcDecimal.new(1.5);
const LIQUIDATION_USER_FEE = ArcDecimal.new(0.1);
const LIQUIDATION_ARC_RATIO = ArcDecimal.new(0.1);
/**
 * The margin between the maximum borrow c-ratio and the c-ratio
 * when the position gets liquidated.
 *
 * Ex: The maximum borrow amount has a c-ratio of 130% and the
 * c-ratio when the position is liquidated is 120%, assuming the margin
 * is set at 10%
 */
const MARGIN_MAX_BORROW_AND_LIQ_PERCENT = ArcDecimal.new(0.1);

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
    const minCRatio = await mapper.map(
      minterCreditScore.amount,
      1000,
      LOW_C_RATIO.value,
      HIGH_C_RATIO.value,
    );
    return minCRatio.sub(MARGIN_MAX_BORROW_AND_LIQ_PERCENT.value);
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
   * Sets up a basic position using the `COLLATERAL_AMOUNT` amount at a price of `COLLATERAL_PRICE`
   * and a debt of `DEBT_AMOUNT` as defaults amounts, unless specified otherwise
   */
  async function setupBasePosition(
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

    // Open position and mint debt
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
      lowCollateralRatio: LOW_C_RATIO.value,
      highCollateralRatio: HIGH_C_RATIO.value,
      liquidationMarginPercent: MARGIN_MAX_BORROW_AND_LIQ_PERCENT.value,
      merkleRoot: creditScoreTree.getHexRoot(),
      fees: {
        liquidationUserFee: LIQUIDATION_USER_FEE.value,
        liquidationArcRatio: LIQUIDATION_ARC_RATIO.value,
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
  it('liquidates an undercollateralized position', async () => {
    /**
     * When a liquidation is done we need to check the following
     * - Ensure that the liquidator has enough debt (STABLEx)
     * - Ensure the position is under-collateralized
     *
     * When a liquidation happens we need to check
     * - The debt has been taken from the liquidator (STABLEx)
     * - The collateral has been given to the liquidator
     * - The total STABLEx supply has decreased
     * - The position collateral amount has decreased
     * - The position debt amount has decreased
     * - A portion of collateral is sent to the fee collector
     */

    // Sets up a basic position
    await setupBasePosition();

    expect(await balanceOf(signers.liquidator, debtTokenAddress)).to.be.gte(DEBT_AMOUNT);

    // Drop the price by half to make the position under-collateralized
    const newPrice = COLLATERAL_PRICE.div(2);
    await arc.updatePrice(newPrice);

    // Make sure position is under-collateralized
    const liquidationCRatio = await getLiquidationCRatio();
    const currentCRatio = COLLATERAL_AMOUNT.mul(newPrice).div(DEBT_AMOUNT);
    expect(currentCRatio).to.be.lte(liquidationCRatio);

    const {
      stablexAmt: preStablexBalance,
      collateralAmt: preCollateralBalance,
      arcCollateralAmt: preArcCollateralAmt,
      stablexTotalSupply: preStablexTotalSupply,
    } = await getBalancesForLiquidation(signers.liquidator);

    // Liquidate position
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
      preCollateralBalance.add(ArcDecimal.new(994.736842105263).value),
    );

    // A portion of collateral is sent to the fee collector
    expect(postArcCollateralAmt).eq(
      preArcCollateralAmt.add(ArcDecimal.new(5.26315789473684).value),
    );

    // The total STABLEx supply has decreased
    expect(postStablexTotalSupply).to.eq(preStablexTotalSupply.sub(ArcNumber.new(475)));

    // The position collateral amount has decreased
    const postLiquidationPosition = await arc.getPosition(signers.minter.address);
    expect(postLiquidationPosition.collateralAmount).to.eq(0);

    // The position debt amount has decreased
    expect(postLiquidationPosition.borrowedAmount).to.eq(DEBT_AMOUNT.sub(ArcNumber.new(475)));
  });

  // Test 2 in https://docs.google.com/spreadsheets/d/1rmFbUxnM4gyi1xhcYKBwcdadvXrHBPKbeX7DLk8KQgE/edit?usp=sharing
  it('provides a lower score proof and then liquidates the position', async () => {
    /**
     * The base position is at a healthy 200% c-ratio when the price is $1.
     * Changing the price to $0.68 will change the c-ratio to 135%.
     * Since the minter has a 500 credit score, their position won't be liquidated
     * until 132.5%.
     * If the credit score drops to 50, their position can get liquidated if the c-ratio
     * goes below 148.25%.
     */

    // Sets up a basic position
    await setupBasePosition();

    // Change the price to drop the c-ratio to 135%
    const newPrice = ArcDecimal.new(0.68);
    await arc.updatePrice(newPrice.value);

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
      preCollateralBalance.add(ArcDecimal.new(769.920156428222).value),
    );

    // A portion of collateral is sent to the fee collector
    expect(postArcCollateralAmt).eq(
      preArcCollateralAmt.add(ArcDecimal.new(4.07365162131336).value),
    );

    // The total STABLEx supply has decreased
    expect(postStablexTotalSupply).to.eq(preStablexTotalSupply.sub(DEBT_AMOUNT));

    // The position collateral amount has decreased
    const postLiquidationPosition = await arc.getPosition(signers.minter.address);
    expect(postLiquidationPosition.collateralAmount).to.eq(ArcDecimal.new(226.006191950464).value);

    // The position debt amount has decreased
    expect(postLiquidationPosition.borrowedAmount).to.eq(0);
  });

  it('liquidates if interest accumulates (1 day)', async () => {
    // Open a position at the boundary
    // Set the liquidation safety margin to 0 so we can borrow at the edge
    await arc.core().setBorrowSafetyMargin(0);

    // When opening a position without a credit score, a credit score of 0 is assumed
    const maxBorrowAmount = COLLATERAL_AMOUNT.mul(BASE).div(HIGH_C_RATIO.value);
    await setupBasePosition(COLLATERAL_AMOUNT, maxBorrowAmount);

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

    const position = await arc.getPosition(signers.minter.address);

    expect(position.borrowedAmount).to.eq(0);
    expect(position.collateralAmount).to.be.lt(COLLATERAL_AMOUNT);
    // Checking for "less than" because the interest had also been paid
    expect(await arc.synthetic().balanceOf(signers.liquidator.address)).to.be.lt(
      preStablexBalance.sub(maxBorrowAmount),
    );
    expect(await arc.collateral().balanceOf(signers.liquidator.address)).to.be.gt(
      preCollateralBalance,
    );
  });

  it('liquidates if interest accumulates (1 year)', async () => {
    // Open a position at the boundary
    // Set the liquidation safety margin to 0 so we can borrow at the edge
    await arc.core().setBorrowSafetyMargin(0);

    // When opening a position without a credit score, a credit score of 0 is assumed
    const maxBorrowAmount = COLLATERAL_AMOUNT.mul(BASE).div(HIGH_C_RATIO.value);
    await setupBasePosition(COLLATERAL_AMOUNT, maxBorrowAmount);

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

    const position = await arc.getPosition(signers.minter.address);

    expect(position.borrowedAmount).to.eq(0);
    expect(position.collateralAmount).to.be.lt(COLLATERAL_AMOUNT);
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
    // If the price drops twice, the position bes liquidated twice

    await setupBasePosition(COLLATERAL_AMOUNT, DEBT_AMOUNT);

    // Set the price to $0.75 so the c-ratio drops at 150%
    let newPrice = ArcDecimal.new(0.75).value;
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
      preCollateralBalance.add(ArcDecimal.new(698.060941828255).value),
    );
    expect(postArcCollateralAmt).to.eq(
      preArcCollateralAmt.add(ArcDecimal.new(3.69344413665743).value),
    );
    expect(postSTablexTotalSupply).to.eq(preSTablexTotalSupply.sub(DEBT_AMOUNT));

    // Borrow to the limit (up to 160% c-ratio)
    const position = await arc.getPosition(signers.minter.address);
    const maxBorrowAmount = COLLATERAL_AMOUNT.sub(position.collateralAmount.value)
      .mul(newPrice)
      .div(ArcDecimal.new(1.6).value);

    await arc.borrow(signers.minter.address, maxBorrowAmount);

    // Drop the price to $0.70 to bring the c-ratio down to 150% again
    newPrice = ArcDecimal.new(0.7).value;
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
      preCollateralBalance.add(ArcDecimal.new(208.19361422948).value),
    );
    expect(postArcCollateralAmt).to.eq(
      preArcCollateralAmt.add(ArcDecimal.new(1.10155351444169).value),
    );
    expect(postSTablexTotalSupply).to.eq(preSTablexTotalSupply.sub(maxBorrowAmount));
  });

  it('should not liquidate a collateralized position ', async () => {
    await setupBasePosition();

    await expect(
      arc.liquidate(
        signers.minter.address,
        getScoreProof(minterCreditScore),
        undefined,
        signers.liquidator,
      ),
    ).to.be.revertedWith('SapphireCoreV1: position is collateralized');
  });

  // Test 4 in https://docs.google.com/spreadsheets/d/1rmFbUxnM4gyi1xhcYKBwcdadvXrHBPKbeX7DLk8KQgE/edit?usp=sharing
  it('should not liquidate if the credit score improved such that vault is immune to liquidations', async () => {
    /**
     * The user is under-collateralised, but their credit score increases
     * making them immune to the liquidation and causing it to throw
     */

    // First, open the position with a credit score of 0
    let newMinterCreditScore = {
      account: signers.minter.address,
      amount: BigNumber.from(0),
    };
    let newCreditTree = new CreditScoreTree([newMinterCreditScore, liquidatorCreditScore]);
    await creditScoreContract.updateMerkleRoot(newCreditTree.getHexRoot());

    await setupBasePosition(
      COLLATERAL_AMOUNT,
      DEBT_AMOUNT,
      undefined,
      getScoreProof(newMinterCreditScore, newCreditTree),
    );

    // Drop the price to $0.70 to bring the c-ratio down to 140%
    await arc.updatePrice(ArcDecimal.new(0.7).value);

    /**
     * The position is vulnerable for liquidation at this point.
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
    ).to.be.revertedWith('SapphireCoreV1: position is collateralized');
  });

  it('should not liquidate without enough debt', async () => {
    await setupBasePosition();

    await arc.updatePrice(ArcDecimal.new(0.65).value);

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
    await setupBasePosition();

    // Price drops, setting the c-ratio to 130%
    await arc.updatePrice(ArcDecimal.new(0.65).value);

    // Position is vulnerable here. Price increases again so the c-ratio becomes 133%
    // (the liquidation c-ratio is 132.5%)
    await arc.updatePrice(ArcDecimal.new(0.665).value);

    await expect(
      arc.liquidate(signers.minter.address, getScoreProof(minterCreditScore)),
    ).to.be.revertedWith('SapphireCoreV1: position is collateralized');
  });

  it('should not liquidate twice in a row', async () => {
    /**
     * Given the price does not change, there isn't a lot of time elapsed and the credit score
     * did not drop significantly, someone should not be able to liquidate twice or more in a row
     */

    await setupBasePosition();

    // Price drops, setting the c-ratio to 130%
    await arc.updatePrice(ArcDecimal.new(0.65).value);

    // Liquidate position
    await arc.liquidate(
      signers.minter.address,
      getScoreProof(minterCreditScore),
      undefined,
      signers.liquidator,
    );

    // Liquidate position again
    await expect(
      arc.liquidate(
        signers.minter.address,
        getScoreProof(minterCreditScore),
        undefined,
        signers.liquidator,
      ),
    ).to.be.revertedWith('SapphireCoreV1: there is no debt to liquidate');

    // Liquidate position again
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
    it('Scenario 1: the position gets liquidated because the collateral price hits the liquidation price', async () => {
      // User opens a position of 1000 tokens and borrows at a 200% c-ratio
      await setupBasePosition(
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT,
        undefined,
        getScoreProof(minterCreditScore),
      );

      // Price increases to $1.25
      await arc.updatePrice(ArcDecimal.new(1.25).value);

      // User maxes out his borrow amount.
      // $377.19298245614 is the max borrow amount ($877.19) - 500
      await arc.borrow(
        signers.minter.address,
        ArcDecimal.new(377.19298245614).value,
        getScoreProof(minterCreditScore),
      );

      // Price decreases to $1.16. The position's c-ratio becomes 132.24%
      await arc.updatePrice(ArcDecimal.new(1.16).value);

      // The collateral price is under the liquidation price. The liquidation occurs

      const {
        stablexAmt: preStablexBalance,
        collateralAmt: preCollateralBalance,
        arcCollateralAmt: preArcCollateralAmt,
        stablexTotalSupply: preStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);

      // Liquidate position
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
      const stableXPaid = ArcDecimal.new(877.19298245614).value;
      expect(postStablexBalance).to.eq(preStablexBalance.sub(stableXPaid));

      // The collateral has been given to the liquidator
      expect(postCollateralBalance).to.eq(
        preCollateralBalance.add(ArcDecimal.new(790.421764628731).value),
      );

      // A portion of collateral is sent to the fee collector
      expect(postArcCollateralAmt).eq(
        preArcCollateralAmt.add(ArcDecimal.new(4.01716287871692).value),
      );

      // The total STABLEx supply has decreased
      expect(postStablexTotalSupply).to.eq(preStablexTotalSupply.sub(stableXPaid));

      // The position collateral amount has decreased
      const postLiquidationPosition = await arc.getPosition(signers.minter.address);
      expect(postLiquidationPosition.collateralAmount).to.eq(
        ArcDecimal.new(205.561072492552).value,
      );

      expect(postLiquidationPosition.borrowedAmount).to.eq(0);
    });

    it('Scenario 2: The borrow amount is greater than the collateral value and a liquidation occurs', async () => {
      // User opens a position of 1000 tokens and borrows at a 200% c-ratio
      await setupBasePosition(
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT,
        undefined,
        getScoreProof(minterCreditScore),
      );

      // Price decreases to $0.45
      await arc.updatePrice(ArcDecimal.new(0.45).value);

      // The liquidation occurs. The entire collateral is sold at discount and the user has an outstanding debt

      const {
        stablexAmt: preStablexBalance,
        collateralAmt: preCollateralBalance,
        arcCollateralAmt: preArcCollateralAmt,
        stablexTotalSupply: preStablexTotalSupply,
      } = await getBalancesForLiquidation(signers.liquidator);

      // Liquidate position
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
      const stableXPaid = ArcDecimal.new(427.5).value;
      expect(postStablexBalance).to.eq(preStablexBalance.sub(stableXPaid));

      // The collateral has been given to the liquidator
      expect(postCollateralBalance).to.eq(
        preCollateralBalance.add(ArcDecimal.new(994.736842105263).value),
      );

      // A portion of collateral is sent to the fee collector
      expect(postArcCollateralAmt).eq(
        preArcCollateralAmt.add(ArcDecimal.new(5.26315789473684).value),
      );

      // The total STABLEx supply has decreased
      expect(postStablexTotalSupply).to.eq(preStablexTotalSupply.sub(stableXPaid));

      // The position collateral amount is gone
      const postLiquidationPosition = await arc.getPosition(signers.minter.address);
      expect(postLiquidationPosition.collateralAmount).to.eq(0);

      expect(postLiquidationPosition.borrowedAmount).to.eq(ArcDecimal.new(72.5).value);
    });

    it('Scenario 3: the user changes their position, then their credit score decreases and liquidation occurs', async () => {
      // User opens a position of 1000 tokens and borrows at a 200% c-ratio
      await setupBasePosition();

      // User removes 100 collateral
      await arc.withdraw(
        signers.minter.address,
        ArcNumber.new(100),
        getScoreProof(minterCreditScore),
      );

      // User repays $150
      await arc.repay(signers.minter.address, ArcNumber.new(150), getScoreProof(minterCreditScore));

      // The collateral price drops to $0.54
      await arc.updatePrice(ArcDecimal.new(0.54).value);

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
        preCollateralBalance.add(ArcDecimal.new(678.670360110803).value),
      );

      // A portion of collateral is sent to the fee collector
      expect(postArcCollateralAmt).eq(
        preArcCollateralAmt.add(ArcDecimal.new(3.59084846619473).value),
      );

      // The total STABLEx supply has decreased
      expect(postStablexTotalSupply).to.eq(preStablexTotalSupply.sub(debtPaid));

      // The position collateral amount has decreased
      const postLiquidationPosition = await arc.getPosition(signers.minter.address);
      expect(postLiquidationPosition.collateralAmount).to.eq(ArcDecimal.new(217.738791423).value);

      // The position debt amount has been paid off
      expect(postLiquidationPosition.borrowedAmount).to.eq(0);
    });

    it('Scenario 4: the user changes their position, then their credit score increases which protects him from liquidation. Then the price drops and gets liquidated', async () => {
      // User opens a position of 1000 tokens and borrows at a 200% c-ratio
      await setupBasePosition(
        COLLATERAL_AMOUNT,
        DEBT_AMOUNT,
        undefined,
        getScoreProof(minterCreditScore),
      );

      // User borrows maximum amount, which is up to 142.50% or $701.754385964912 - $500 = 201.7543859649
      await arc.borrow(
        signers.minter.address,
        ArcDecimal.new(201.7543859649).value,
        getScoreProof(minterCreditScore),
      );

      // Price drops to $0.91. Position is in danger but not liquidated yet
      await arc.updatePrice(ArcDecimal.new(0.91).value);

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
      ).to.be.revertedWith('SapphireCoreV1: position is collateralized');

      // Price drops to $0.82. Position is liquidated
      await arc.updatePrice(ArcDecimal.new(0.82).value);

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
      const debtPaid = ArcDecimal.new(701.754385964912).value;

      // The debt has been taken from the liquidator (STABLEx)
      expect(postStablexBalance).to.eq(preStablexBalance.sub(debtPaid));

      // The collateral has been given to the liquidator
      expect(postCollateralBalance).to.eq(
        preCollateralBalance.add(ArcDecimal.new(896.09876999776).value),
      );

      // A portion of collateral is sent to the fee collector
      expect(postArcCollateralAmt).eq(
        preArcCollateralAmt.add(ArcDecimal.new(4.74126333332148).value),
      );

      // The total STABLEx supply has decreased
      expect(postStablexTotalSupply).to.eq(preStablexTotalSupply.sub(debtPaid));

      // The position collateral amount has decreased
      const postLiquidationPosition = await arc.getPosition(signers.minter.address);
      expect(postLiquidationPosition.collateralAmount).to.eq(
        ArcDecimal.new(298.245614035088).value,
      );

      // The position debt amount has been paid off
      expect(postLiquidationPosition.borrowedAmount).to.eq(0);
    });
  });
});
