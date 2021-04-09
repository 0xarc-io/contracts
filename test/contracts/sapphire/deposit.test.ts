import { CreditScore } from '@arc-types/sapphireCore';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { TestToken } from '@src/typings';
import { getScoreProof } from '@src/utils/getScoreProof';
import { DEFAULT_HiGH_C_RATIO, DEFAULT_LOW_C_RATIO, DEFAULT_PRICE } from '@test/helpers/sapphireDefaults';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

const COLLATERAL_AMOUNT = utils.parseEther('100');

describe('SapphireCore.deposit()', () => {
  let ctx: ITestContext;
  let arc: SapphireTestArc;
  let creditScoreTree: CreditScoreTree;
  let creditScore1: CreditScore;
  let creditScore2: CreditScore;
  let scoredMinter: SignerWithAddress;
  let minter: SignerWithAddress;
  let collateral: TestToken;

  before(async () => {
    ctx = await generateContext(sapphireFixture, init);
    arc = ctx.sdks.sapphire;
    scoredMinter = ctx.signers.scoredMinter;
    minter = ctx.signers.minter;
  });

  addSnapshotBeforeRestoreAfterEach();

  async function init(ctx: ITestContext): Promise<void> {
    creditScore1 = {
      account: ctx.signers.scoredMinter.address,
      amount: BigNumber.from(500),
    };
    creditScore2 = {
      account: ctx.signers.interestSetter.address,
      amount: BigNumber.from(20),
    };
    creditScoreTree = new CreditScoreTree([creditScore1, creditScore2]);

    await setupSapphire(ctx, {
      highCollateralRatio: DEFAULT_HiGH_C_RATIO,
      lowCollateralRatio: DEFAULT_LOW_C_RATIO,
      price: DEFAULT_PRICE,
      merkleRoot: creditScoreTree.getHexRoot(),
    });
  }

  it('deposit without credit score', async () => {
    const preMinterBalance = await collateral.balanceOf(minter.address);
    const preCoreBalance = await collateral.balanceOf(arc.coreAddress());

    await arc.deposit(COLLATERAL_AMOUNT, undefined, undefined, minter);

    expect(await collateral.balanceOf(minter.address)).eq(preMinterBalance.sub(COLLATERAL_AMOUNT));
    expect(await collateral.balanceOf(arc.coreAddress())).eq(preCoreBalance.add(COLLATERAL_AMOUNT));
  });

  it('deposit with credit score', async () => {
    const preMinterBalance = await collateral.balanceOf(scoredMinter.address);
    const preCoreBalance = await collateral.balanceOf(arc.coreAddress());

    await arc.deposit(
      COLLATERAL_AMOUNT,
      getScoreProof(creditScore1, creditScoreTree),
      undefined,
      minter,
    );

    expect(await collateral.balanceOf(scoredMinter.address)).eq(
      preMinterBalance.sub(COLLATERAL_AMOUNT),
    );
    expect(await collateral.balanceOf(arc.coreAddress())).eq(preCoreBalance.add(COLLATERAL_AMOUNT));
  });

  it('throw if not enough funds', async () => {
    const preMinterBalance = await collateral.balanceOf(minter.address);

    await expect(arc.deposit(preMinterBalance.add(1), undefined, undefined, minter)).revertedWith('SapphireCoreV1: not enough funds')
  });
});
