import { PassportScore } from '@arc-types/sapphireTypes';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { PassportScoreTree } from '@src/MerkleTree';
import { SapphireTestArc } from '@test/helpers/SapphireTestArc';
import { TestToken, TestTokenFactory } from '@src/typings';
import { getScoreProof, getEmptyScoreProof } from '@src/utils/getScoreProof';
import { DEFAULT_COLLATERAL_DECIMALS } from '@test/helpers/sapphireDefaults';
import { CREDIT_PROOF_PROTOCOL } from '@src/constants';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

const COLLATERAL_AMOUNT = utils.parseUnits('100', DEFAULT_COLLATERAL_DECIMALS);

describe('SapphireCore.deposit()', () => {
  let ctx: ITestContext;
  let arc: SapphireTestArc;
  let creditScoreTree: PassportScoreTree;
  let creditScore1: PassportScore;
  let creditScore2: PassportScore;
  let scoredBorrower: SignerWithAddress;
  let borrower: SignerWithAddress;
  let collateral: TestToken;

  function init(ctx: ITestContext): Promise<void> {
    creditScore1 = {
      account: ctx.signers.scoredBorrower.address,
      protocol: utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
      score: BigNumber.from(500),
    };
    creditScore2 = {
      account: ctx.signers.interestSetter.address,
      protocol: utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
      score: BigNumber.from(20),
    };
    creditScoreTree = new PassportScoreTree([creditScore1, creditScore2]);

    return setupSapphire(ctx, {
      merkleRoot: creditScoreTree.getHexRoot(),
    });
  }

  before(async () => {
    ctx = await generateContext(sapphireFixture, init);
    arc = ctx.sdks.sapphire;
    scoredBorrower = ctx.signers.scoredBorrower;
    borrower = ctx.signers.borrower;
    collateral = TestTokenFactory.connect(arc.collateral().address, borrower);

    // mint and approve token
    await collateral.mintShare(borrower.address, COLLATERAL_AMOUNT);
    await collateral.mintShare(scoredBorrower.address, COLLATERAL_AMOUNT);

    await collateral.approveOnBehalf(
      borrower.address,
      arc.coreAddress(),
      COLLATERAL_AMOUNT,
    );
    await collateral.approveOnBehalf(
      scoredBorrower.address,
      arc.coreAddress(),
      COLLATERAL_AMOUNT,
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  it('reverts if the contract is paused', async () => {
    await arc.core().connect(ctx.signers.pauseOperator).setPause(true);

    await expect(
      arc.deposit(COLLATERAL_AMOUNT, undefined, undefined, borrower),
    ).revertedWith('SapphireCoreV1: the contract is paused');
  });

  it(`reverts if the user doesn't have enough funds`, async () => {
    const preBorrowerBalance = await collateral.balanceOf(borrower.address);

    await expect(
      arc.deposit(preBorrowerBalance.add(1), undefined, undefined, borrower),
    ).revertedWith('SafeERC20: TRANSFER_FROM_FAILED');
  });

  it('deposit without credit score', async () => {
    const preBorrowerBalance = await collateral.balanceOf(borrower.address);
    const preCoreBalance = await collateral.balanceOf(arc.coreAddress());

    await arc.deposit(COLLATERAL_AMOUNT, undefined, undefined, borrower);

    expect(await collateral.balanceOf(borrower.address)).eq(
      preBorrowerBalance.sub(COLLATERAL_AMOUNT),
    );
    expect(await collateral.balanceOf(arc.coreAddress())).eq(
      preCoreBalance.add(COLLATERAL_AMOUNT),
    );
  });

  it('deposit with credit score', async () => {
    const preBorrowerBalance = await collateral.balanceOf(
      scoredBorrower.address,
    );
    const preCoreBalance = await collateral.balanceOf(arc.coreAddress());

    await arc.deposit(
      COLLATERAL_AMOUNT,
      getScoreProof(creditScore1, creditScoreTree),
      undefined,
      scoredBorrower,
    );

    expect(
      await collateral.balanceOf(scoredBorrower.address),
      'scored borrower balance',
    ).eq(preBorrowerBalance.sub(COLLATERAL_AMOUNT));
    expect(await collateral.balanceOf(arc.coreAddress()), 'core balance').eq(
      preCoreBalance.add(COLLATERAL_AMOUNT),
    );

    const { collateralAmount } = await arc.getVault(scoredBorrower.address);
    expect(collateralAmount).to.eq(COLLATERAL_AMOUNT);
  });

  it('emits the Deposited event', async () => {
    const scoreProof = getScoreProof(creditScore1, creditScoreTree);
    await expect(
      arc.deposit(COLLATERAL_AMOUNT, scoreProof, undefined, scoredBorrower),
    )
      .to.emit(arc.core(), 'Deposited')
      .withArgs(
        scoredBorrower.address,
        COLLATERAL_AMOUNT,
        COLLATERAL_AMOUNT,
        0,
        0,
      );
  });

  it('sets the effective epoch of the sender to epoch + 2 if NO proof was passed', async () => {
    expect(
      await arc.core().expectedEpochWithProof(scoredBorrower.address),
    ).to.eq(0);

    const currentEpoch = await ctx.contracts.sapphire.passportScores.currentEpoch();
    await arc.deposit(
      COLLATERAL_AMOUNT,
      getEmptyScoreProof(
        scoredBorrower.address,
        utils.formatBytes32String('arcx.credit'),
      ),
      undefined,
      scoredBorrower,
    );

    expect(
      await arc.core().expectedEpochWithProof(scoredBorrower.address),
    ).to.eq(currentEpoch.add(2));
  });

  it('sets the effective epoch of the sender to the current epoch if a proof was passed', async () => {
    expect(
      await arc.core().expectedEpochWithProof(scoredBorrower.address),
    ).to.eq(0);

    const scoreProof = getScoreProof(creditScore1, creditScoreTree);
    const currentEpoch = await ctx.contracts.sapphire.passportScores.currentEpoch();
    await arc.deposit(COLLATERAL_AMOUNT, scoreProof, undefined, scoredBorrower);

    expect(
      await arc.core().expectedEpochWithProof(scoredBorrower.address),
    ).to.eq(currentEpoch);
  });

  it("reverts if proof is not the caller's", async () => {
    await collateral.mintShare(
      ctx.signers.interestSetter.address,
      COLLATERAL_AMOUNT,
    );
    await collateral.approveOnBehalf(
      ctx.signers.interestSetter.address,
      arc.coreAddress(),
      COLLATERAL_AMOUNT,
    );

    await expect(
      arc.deposit(
        COLLATERAL_AMOUNT,
        getScoreProof(creditScore1, creditScoreTree),
        undefined,
        ctx.signers.interestSetter,
      ),
    ).to.be.revertedWith('SapphireCoreV1: proof.account must match msg.sender');
  });
});
