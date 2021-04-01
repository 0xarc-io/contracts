import { BigNumber } from '@ethersproject/bignumber';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { constants, utils } from 'ethers';
import 'module-alias/register';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

/**
 * The repay function allows a user to repay the STABLEx debt. This function, withdraw and liquidate
 * have the credit proof as optional since we never want to lock users from pulling out their funds.
 * Our front-end will always send the proof but in the case that it can't, users can still repay
 * and withdraw directly.
 */
describe('SapphireCore.repay()', () => {
  let arc: SapphireTestArc;

  async function init(ctx: ITestContext) {
    const creditScore1 = {
      account: ctx.signers.minter.address,
      amount: BigNumber.from(500),
    };
    const creditScore2 = {
      account: ctx.signers.interestSetter.address,
      amount: BigNumber.from(20),
    };
    const creditScoreTree = new CreditScoreTree([creditScore1, creditScore2]);

    await setupSapphire(ctx, {
      lowCollateralRatio: constants.WeiPerEther,
      highCollateralRatio: constants.WeiPerEther.mul(2),
      merkleRoot: creditScoreTree.getHexRoot(),
    });
  }

  before(async () => {
    const ctx = await generateContext(sapphireFixture, init);
    arc = ctx.sdks.sapphire;
  });

  addSnapshotBeforeRestoreAfterEach();

  it('repays to increase the c-ratio', async () => {});

  it('repays to make the position collateralized', async () => {});

  it('repays without a score proof even if one exists on-chain', async () => {});

  it('repays someone elses position', async () => {});

  it('updates the totalBorrowed after a repay');

  it('updates the vault borrow and colllateral amounts');

  it('should not repay if the oracle is not added');

  it('should not repay if the oracle price is 0');

  it('should not repay to a vault that does not exist');

  it('should not repay with a score proof if no assesor is added', async () => {});

  it(`should not repay more than the vault's debt`);

  it('should not repay if contract is paused');
});
