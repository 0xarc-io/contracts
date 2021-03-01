import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber } from 'ethers';
import 'module-alias/register';
import { generateContext, ITestContext } from '../context';
import { createSapphireFixture } from '../fixtures';

chai.use(solidity);

const ONE_BYTES32 = '0x1111111111111111111111111111111111111111111111111111111111111111';
const TWO_BYTES32 = '0x2222222222222222222222222222222222222222222222222222222222222222';
const THREE_BYTES32 = '0x3333333333333333333333333333333333333333333333333333333333333333';

/**
 * This is the core credit score contract and is where a user's credit score will
 * be posted. The logic around this contract needs to be very sound since we anticipate
 * it to be a core DeFi primitive for other applications to build on.
 */
describe.only('SapphireCreditScore', () => {
  let ctx: ITestContext;

  beforeEach(async () => {
    ctx = await generateContext(createSapphireFixture(), async () => {});
  });

  it('should have merkle root updater not equal owner', async () => {
    const merkleRootUpdater = await ctx.contracts.sapphire.creditScore.merkleRootUpdater();
    expect(merkleRootUpdater).not.eq(ctx.signers.admin.address);
    expect(merkleRootUpdater).eq(ctx.signers.interestSetter.address);
  });

  describe('#setPause', () => {
    it('initially not active', async () => {
      expect(await ctx.contracts.sapphire.creditScore.isPaused()).to.be.true;
    });

    it('revert if trying to pause as an unauthorised user', async () => {
      expect(await ctx.contracts.sapphire.creditScore.merkleRootUpdater()).not.eq(
        ctx.signers.unauthorised.address,
      );
      expect(await ctx.contracts.sapphire.creditScore.owner()).not.eq(
        ctx.signers.unauthorised.address,
      );
      await expect(
        ctx.contracts.sapphire.creditScore.connect(ctx.signers.unauthorised).setPause(false),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('revert if set pause as merkle root updater', async () => {
      expect(await ctx.contracts.sapphire.creditScore.merkleRootUpdater()).eq(
        ctx.signers.interestSetter.address,
      );
      await expect(
        ctx.contracts.sapphire.creditScore.connect(ctx.signers.interestSetter).setPause(false),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('set pause as owner', async () => {
      expect(await ctx.contracts.sapphire.creditScore.isPaused()).to.be.true;
      await expect(ctx.contracts.sapphire.creditScore.setPause(false)).to.be.emit(
        { value: false },
        'PauseStatusUpdated',
      );
    });
  });

  describe('#updateMerkleRoot', () => {
    beforeEach(async () => {
      await ctx.contracts.sapphire.creditScore.setPause(false);
    });

    it('should not be able to update the merkle root as an unauthorised user', async () => {
      await expect(
        ctx.contracts.sapphire.creditScore
          .connect(ctx.signers.unauthorised)
          .updateMerkleRoot(ONE_BYTES32),
      ).to.be.revertedWith('SapphireCreditScore: caller is not authorized to update merkle root');
    });

    it('should not be able to be called by the root updater before the delay duration', async () => {
      await ctx.contracts.sapphire.creditScore
        .connect(ctx.signers.interestSetter)
        .updateMerkleRoot(ONE_BYTES32);
      await expect(
        ctx.contracts.sapphire.creditScore
          .connect(ctx.signers.interestSetter)
          .updateMerkleRoot(ONE_BYTES32),
      ).to.be.revertedWith('SapphireCreditScore: too frequent root update');
    });

    it('should not be able to post an empty root', async () => {
      await expect(
        ctx.contracts.sapphire.creditScore
          .connect(ctx.signers.interestSetter)
          .updateMerkleRoot('0x0000000000000000000000000000000000000000000000000000000000000000'),
      ).to.be.revertedWith('SapphireCreditScore: root is empty');
    });

    describe('as owner', () => {
      it('should not be able to update if the contract is not paused', async () => {
        await expect(
          ctx.contracts.sapphire.creditScore.updateMerkleRoot(ONE_BYTES32),
        ).to.be.revertedWith('SapphireCreditScore: pause contract to update merkle root as owner');
      });

      it('instantly update merkle root', async () => {
        await ctx.contracts.sapphire.creditScore.setPause(true);
        const currentMerkleRoot = await ctx.contracts.sapphire.creditScore.currentMerkleRoot();
        await ctx.contracts.sapphire.creditScore
          .connect(ctx.signers.admin)
          .updateMerkleRoot(TWO_BYTES32);
        expect(await ctx.contracts.sapphire.creditScore.upcomingMerkleRoot()).eq(TWO_BYTES32);
        expect(await ctx.contracts.sapphire.creditScore.currentMerkleRoot()).eq(currentMerkleRoot);
      });

      it('instantly update merkle root avoiding time delay ', async () => {
        await ctx.contracts.sapphire.creditScore
          .connect(ctx.signers.interestSetter)
          .updateMerkleRoot(TWO_BYTES32);
        const initialLastMerkleRootUpdate = await ctx.contracts.sapphire.creditScore.lastMerkleRootUpdate();
        const initialCurrentMerkleRoot = await ctx.contracts.sapphire.creditScore.currentMerkleRoot();
        await ctx.contracts.sapphire.creditScore.connect(ctx.signers.admin).setPause(true);
        await ctx.contracts.sapphire.creditScore
          .connect(ctx.signers.admin)
          .updateMerkleRoot(THREE_BYTES32);
        expect(await ctx.contracts.sapphire.creditScore.lastMerkleRootUpdate()).eq(
          initialLastMerkleRootUpdate,
        );
        expect(await ctx.contracts.sapphire.creditScore.currentMerkleRoot()).eq(
          initialCurrentMerkleRoot,
        );
        expect(await ctx.contracts.sapphire.creditScore.upcomingMerkleRoot()).eq(THREE_BYTES32);
      });
    });

    it('should be able to update the merkle root as the root updater', async () => {
      const initialLastMerkleRootUpdate = await ctx.contracts.sapphire.creditScore.lastMerkleRootUpdate();
      const initialUpcomingMerkleRoot = await ctx.contracts.sapphire.creditScore.upcomingMerkleRoot();
      await ctx.contracts.sapphire.creditScore
        .connect(ctx.signers.interestSetter)
        .updateMerkleRoot(TWO_BYTES32);
      expect(await ctx.contracts.sapphire.creditScore.lastMerkleRootUpdate()).not.eq(
        initialLastMerkleRootUpdate,
      );
      expect(await ctx.contracts.sapphire.creditScore.currentMerkleRoot()).eq(
        initialUpcomingMerkleRoot,
      );
      expect(await ctx.contracts.sapphire.creditScore.upcomingMerkleRoot()).eq(TWO_BYTES32);
    });
  });

  describe('#request', async () => {
    let tree: CreditScoreTree;
    let creditScore1;
    let creditScore2;

    beforeEach(async () => {
      creditScore1 = {
        account: ctx.signers.admin.address,
        amount: BigNumber.from(12),
      };
      creditScore2 = {
        account: ctx.signers.unauthorised.address,
        amount: BigNumber.from(20),
      };
      tree = new CreditScoreTree([creditScore1, creditScore2]);
      ctx = await generateContext(createSapphireFixture(tree.getHexRoot()), async () => {});
    });

    it('should be able to verify and update a users score', async () => {
      expect(await ctx.contracts.sapphire.creditScore.currentMerkleRoot()).eq(tree.getHexRoot());
      const initTimestamp = Math.round(Date.now() / 1000);
      const score = await ctx.contracts.sapphire.creditScore.request({
        account: creditScore1.account,
        score: creditScore1.amount,
        merkleProof: tree.getProof(creditScore1.account, creditScore1.amount),
      });
      expect(score).eq(creditScore1.amount);
      const {
        0: creditScore,
        1: lastUpdated,
      } = await ctx.contracts.sapphire.creditScore.getLastScore(creditScore1.account);
      expect(creditScore1.amount).eq(creditScore);
      expect(lastUpdated).gt(initTimestamp);
      expect(lastUpdated).lte(Math.round(Date.now() / 1000));

      // Check if the merkle root exists and if the last updated is the same as now then return stored
      // If not, ensure validity of root then update current score and last updated
      // Return verified score
    });

    it('should not be able to request an invalid proof', async () => {
      await expect(
        ctx.contracts.sapphire.creditScore.request({
          account: creditScore1.account,
          score: BigNumber.from(99),
          merkleProof: tree.getProof(creditScore1.account, creditScore1.amount),
        }),
      ).to.be.revertedWith('SapphireCreditScore: invalid  proof');
    });

    it('should not reverify a score if the timestamps are the same', async () => {
      await expect(
        ctx.contracts.sapphire.creditScore.request({
          account: creditScore1.account,
          score: BigNumber.from(99),
          merkleProof: tree.getProof(creditScore1.account, creditScore1.amount),
        }),
      ).to.be.emit(
        {
          account: creditScore1.account,
          score: creditScore1.amount,
          merkleProof: tree.getProof(creditScore1.account, creditScore1.amount),
        },
        'CreditScoreUpdated',
      );
      await expect(
        ctx.contracts.sapphire.creditScore.request({
          account: creditScore1.account,
          score: BigNumber.from(99),
          merkleProof: tree.getProof(creditScore1.account, creditScore1.amount),
        }),
      ).not.to.be.emit(
        {
          account: creditScore1.account,
          score: creditScore1.amount,
          lastUpdated: Math.round(Date.now() / 1000),
          merkleProof: tree.getProof(creditScore1.account, creditScore1.amount),
        },
        'CreditScoreUpdated',
      );
    });
  });

  describe('#updateMerkleRootUpdater', () => {
    it('as owner', async () => {
      await ctx.contracts.sapphire.creditScore.updateMerkleRootUpdater(
        ctx.signers.positionOperator.address,
      );
      expect(await ctx.contracts.sapphire.creditScore.merkleRootUpdater()).eq(
        ctx.signers.positionOperator.address,
      );
    });

    it('as non-owner', async () => {
      await expect(
        ctx.contracts.sapphire.creditScore
          .connect(ctx.signers.interestSetter)
          .updateMerkleRootUpdater(ctx.signers.interestSetter.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('#setMerkleRootDelay', () => {
    it('as owner', async () => {
      await ctx.contracts.sapphire.creditScore.setMerkleRootDelay(5);
      expect(await ctx.contracts.sapphire.creditScore.merkleRootDelayDuration()).eq(5);
    });

    it('as non-owner', async () => {
      await expect(
        ctx.contracts.sapphire.creditScore
          .connect(ctx.signers.interestSetter)
          .setMerkleRootDelay(5),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
});
