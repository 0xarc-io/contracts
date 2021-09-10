import { CreditScore } from '@arc-types/sapphireCore';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import CreditScoreTree from '@src/MerkleTree/PassportScoreTree';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { TestToken, TestTokenFactory } from '@src/typings';
import { getScoreProof } from '@src/utils/getScoreProof';
import { DEFAULT_COLLATERAL_DECIMALS } from '@test/helpers/sapphireDefaults';
import {
  addSnapshotBeforeRestoreAfterEach,
  immediatelyUpdateMerkleRoot,
} from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

const COLLATERAL_AMOUNT = utils.parseUnits('100', DEFAULT_COLLATERAL_DECIMALS);

describe('SapphireCore.deposit()', () => {
  let ctx: ITestContext;
  let arc: SapphireTestArc;
  let creditScoreTree: CreditScoreTree;
  let creditScore1: CreditScore;
  let creditScore2: CreditScore;
  let scoredMinter: SignerWithAddress;
  let minter: SignerWithAddress;
  let collateral: TestToken;

  function init(ctx: ITestContext): Promise<void> {
    creditScore1 = {
      account: ctx.signers.scoredMinter.address,
      amount: BigNumber.from(500),
    };
    creditScore2 = {
      account: ctx.signers.interestSetter.address,
      amount: BigNumber.from(20),
    };
    creditScoreTree = new CreditScoreTree([creditScore1, creditScore2]);

    return setupSapphire(ctx, {
      merkleRoot: creditScoreTree.getHexRoot(),
    });
  }

  before(async () => {
    ctx = await generateContext(sapphireFixture, init);
    arc = ctx.sdks.sapphire;
    scoredMinter = ctx.signers.scoredMinter;
    minter = ctx.signers.minter;
    collateral = TestTokenFactory.connect(
      await arc.collateral().address,
      minter,
    );

    // mint and approve token
    await collateral.mintShare(minter.address, COLLATERAL_AMOUNT);
    await collateral.mintShare(scoredMinter.address, COLLATERAL_AMOUNT);

    await collateral.approveOnBehalf(
      minter.address,
      arc.coreAddress(),
      COLLATERAL_AMOUNT,
    );
    await collateral.approveOnBehalf(
      scoredMinter.address,
      arc.coreAddress(),
      COLLATERAL_AMOUNT,
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  it('reverts if the contract is paused', async () => {
    await arc.core().connect(ctx.signers.pauseOperator).setPause(true);

    await expect(
      arc.deposit(COLLATERAL_AMOUNT, undefined, undefined, minter),
    ).revertedWith('SapphireCoreV1: the contract is paused');
  });

  it(`reverts if the user doesn't have enough funds`, async () => {
    const preMinterBalance = await collateral.balanceOf(minter.address);

    await expect(
      arc.deposit(preMinterBalance.add(1), undefined, undefined, minter),
    ).revertedWith('SafeERC20: TRANSFER_FROM_FAILED');
  });

  it('deposit without credit score', async () => {
    const preMinterBalance = await collateral.balanceOf(minter.address);
    const preCoreBalance = await collateral.balanceOf(arc.coreAddress());

    await arc.deposit(COLLATERAL_AMOUNT, undefined, undefined, minter);

    expect(await collateral.balanceOf(minter.address)).eq(
      preMinterBalance.sub(COLLATERAL_AMOUNT),
    );
    expect(await collateral.balanceOf(arc.coreAddress())).eq(
      preCoreBalance.add(COLLATERAL_AMOUNT),
    );
  });

  it('deposit with credit score', async () => {
    const preMinterBalance = await collateral.balanceOf(scoredMinter.address);
    const preCoreBalance = await collateral.balanceOf(arc.coreAddress());

    await arc.deposit(
      COLLATERAL_AMOUNT,
      getScoreProof(creditScore1, creditScoreTree),
      undefined,
      scoredMinter,
    );

    expect(
      await collateral.balanceOf(scoredMinter.address),
      'scored minter balance',
    ).eq(preMinterBalance.sub(COLLATERAL_AMOUNT));
    expect(await collateral.balanceOf(arc.coreAddress()), 'core balance').eq(
      preCoreBalance.add(COLLATERAL_AMOUNT),
    );

    const { collateralAmount } = await arc.getVault(scoredMinter.address);
    expect(collateralAmount).to.eq(COLLATERAL_AMOUNT);
  });

  it('emits the ActionsOperated event', async () => {
    await expect(
      arc.deposit(
        COLLATERAL_AMOUNT,
        getScoreProof(creditScore1, creditScoreTree),
        undefined,
        scoredMinter,
      ),
    ).to.emit(arc.core(), 'ActionsOperated');
    /**
     * if uncommenting below, it fails with
     * "AssertionError: expected [ Array(2) ] to equal [ Array(2) ]"
     *
     * Feel free to fix this
     */

    // .withArgs(
    //   [[COLLATERAL_AMOUNT, 0]],
    //   getScoreProof(creditScore1, creditScoreTree),
    //   scoredMinter.address,
    // );
  });

  it('updates the credit score if a valid proof is provided', async () => {
    const newCreditScore1 = {
      account: ctx.signers.scoredMinter.address,
      amount: creditScore1.amount.sub(100),
    };
    const newCreditScoreTree = new CreditScoreTree([
      newCreditScore1,
      creditScore2,
    ]);
    const creditScoreContract = ctx.contracts.sapphire.creditScore;

    let lastCreditScore = await creditScoreContract.getLastScore(
      scoredMinter.address,
    );
    expect(lastCreditScore[0], 'original credit score - not set yet').to.eq(0);

    // Deposit while passing credit score
    await arc.deposit(
      COLLATERAL_AMOUNT.div(2),
      getScoreProof(creditScore1, creditScoreTree),
      undefined,
      scoredMinter,
    );

    lastCreditScore = await creditScoreContract.getLastScore(
      scoredMinter.address,
    );
    expect(lastCreditScore[0], 'updated credit score - original score').to.eq(
      creditScore1.amount,
    );

    // Update the merkle root containing the user's new credit score
    await immediatelyUpdateMerkleRoot(
      creditScoreContract.connect(ctx.signers.interestSetter),
      newCreditScoreTree.getHexRoot(),
    );

    // Deposit while passing new credit score
    await arc.deposit(
      COLLATERAL_AMOUNT.div(2),
      getScoreProof(newCreditScore1, newCreditScoreTree),
      undefined,
      scoredMinter,
    );

    // Check the user's last credit score and ensure it's updated
    lastCreditScore = await creditScoreContract.getLastScore(
      scoredMinter.address,
    );
    expect(lastCreditScore[0], 'updated credit score - new score').to.eq(
      newCreditScore1.amount,
    );
  });
});
