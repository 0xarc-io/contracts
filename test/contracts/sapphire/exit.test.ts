import { CreditScore } from '@arc-types/sapphireCore';
import { TestingSigners } from '@arc-types/testing';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { approve } from '@src/utils/approve';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { getScoreProof } from '@src/utils/getScoreProof';
import {
  DEFAULT_COLLATERAL_DECIMALS,
  DEFAULT_PRICE,
} from '@test/helpers/sapphireDefaults';
import { setupBaseVault } from '@test/helpers/setupBaseVault';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

const COLLATERAL_AMOUNT = utils.parseUnits('1000', DEFAULT_COLLATERAL_DECIMALS);
const BORROW_AMOUNT = utils.parseEther('500');

describe('SapphireCore.exit()', () => {
  let ctx: ITestContext;

  let arc: SapphireTestArc;
  let signers: TestingSigners;

  let scoredMinterCreditScore: CreditScore;
  let creditScoreTree: CreditScoreTree;

  function getCollateralBalance(user: SignerWithAddress) {
    return ctx.sdks.sapphire.collateral().balanceOf(user.address);
  }

  function getSynthBalance(user: SignerWithAddress) {
    return ctx.sdks.sapphire.synthetic().balanceOf(user.address);
  }

  async function init(ctx: ITestContext) {
    scoredMinterCreditScore = {
      account: ctx.signers.scoredMinter.address,
      amount: BigNumber.from(500),
    };

    const liquidatorCreditScore = {
      account: ctx.signers.liquidator.address,
      amount: BigNumber.from(500),
    };

    creditScoreTree = new CreditScoreTree([
      scoredMinterCreditScore,
      liquidatorCreditScore,
    ]);
  }

  before(async () => {
    ctx = await generateContext(sapphireFixture, init);
    signers = ctx.signers;
    arc = ctx.sdks.sapphire;

    await setupSapphire(ctx, {
      merkleRoot: creditScoreTree.getHexRoot(),
    });

    // Set the price to $1
    await ctx.sdks.sapphire.updatePrice(DEFAULT_PRICE);
  });

  addSnapshotBeforeRestoreAfterEach();

  it('reverts if user does not have enough balance to close his vault');

  it('repays all the debt and returns collateral to the user', async () => {
    await setupBaseVault(
      arc,
      signers.scoredMinter,
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      getScoreProof(scoredMinterCreditScore, creditScoreTree),
    );

    let vault = await arc.getVault(signers.scoredMinter.address);
    let collateralBalance = await getCollateralBalance(signers.scoredMinter);
    let synthBalance = await getSynthBalance(signers.scoredMinter);

    expect(vault.collateralAmount).to.eq(COLLATERAL_AMOUNT);
    expect(vault.borrowedAmount).to.eq(BORROW_AMOUNT);
    expect(collateralBalance).to.eq(0);
    expect(synthBalance).to.eq(BORROW_AMOUNT);

    // Approve repay amount
    await approve(
      BORROW_AMOUNT,
      arc.syntheticAddress(),
      arc.coreAddress(),
      signers.scoredMinter,
    );

    await arc.exit(
      getScoreProof(scoredMinterCreditScore, creditScoreTree),
      undefined,
      signers.scoredMinter,
    );

    vault = await arc.getVault(signers.scoredMinter.address);
    collateralBalance = await getCollateralBalance(signers.scoredMinter);
    synthBalance = await getSynthBalance(signers.scoredMinter);

    expect(vault.collateralAmount).to.eq(0);
    expect(vault.borrowedAmount).to.eq(0);
    expect(collateralBalance).to.eq(COLLATERAL_AMOUNT);
    expect(synthBalance).to.eq(0);
  });

  it(
    'repays all the debt + accrued interest and returns collateral to the user',
  );
});
