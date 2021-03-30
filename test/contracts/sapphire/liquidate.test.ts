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

  function getScoreProof(creditScore: CreditScore): CreditScoreProof {
    return {
      account: creditScore.account,
      score: creditScore.amount,
      merkleProof: creditScoreTree.getProof(creditScore.account, creditScore.amount),
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
    await arc.liquidate(signers.minter.address, undefined, undefined, signers.liquidator);

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
      getScoreProof(newMinterCreditScore),
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

    await arc.liquidate(signers.minter.address, undefined, undefined, signers.liquidator);

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

    await arc.liquidate(signers.minter.address, undefined, undefined, signers.liquidator);

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
    await arc.liquidate(signers.minter.address, undefined, undefined, signers.liquidator);

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
    await arc.liquidate(signers.minter.address, undefined, undefined, signers.liquidator);

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

  it('liquidates the remains if the price crashes by a large amount', async () => {
    // If the price drops more than the value of the collateral
    // A liquidator can take whatever remaining value is in the position
  });

  it('should not liquidate a collateralized position ', async () => {});

  it('should not liquidate if the credit score improved such that vault is immune to liquidations', async () => {
    /**
     * The user is under-collateralised, but their credit score increases
     * making them immune to the liquidation and causing it to throw
     */
  });

  it('should not liquidate without enough debt', async () => {});

  it('should not liquidate if the price increases', async () => {});

  it('should not liquidate twice in a row', async () => {
    /**
     * Given the price does not change, there isn't a lot of time elapsed and the credit score
     * did not drop significantly, someone should not be able to liquidate twice or more in a row
     */
    // 1. Liquidate
    // 2. Liquidate again -> expect revert: position is collateralized
  });
});

// Accompanying sheet: https://docs.google.com/spreadsheets/d/1rmFbUxnM4gyi1xhcYKBwcdadvXrHBPKbeX7DLk8KQgE/edit#gid=387958619
describe('SapphireCore.liquidate() scenarios', () => {
  it(
    'Scenario 1: the position gets liquidated because the collateral price hits the liquidation price',
  );
  it('Scenario 2: The borrow amount is greater than the collateral value and a liquidation occurs');
  it(
    'Scenario 3: the user changes their position, then their credit score decreases and liquidation occurs',
  );
  it(
    'Scenario 4: the user changes their position, then their credit score increases which protects him from liquidation. Then the price drops and gets liquidated',
  );
});
