import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import 'module-alias/register';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';

chai.use(solidity);

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
const ONE_BYTES32 = '0x1111111111111111111111111111111111111111111111111111111111111111';
const TWO_BYTES32 = '0x2222222222222222222222222222222222222222222222222222222222222222';

/**
 * This is the core credit score contract and is where a user's credit score will
 * be posted. The logic around this contract needs to be very sound since we anticipate
 * it to be a core DeFi primitive for other applications to build on.
 */
describe.only('SapphireCreditScore', () => {
  // Utils will need to be developed to generate valid + invalid merkle roots
  let ctx: ITestContext;

  beforeEach(async () => {
    ctx = await generateContext(sapphireFixture, async () => {});
  });

  it('should have merkle root updater not equal owner',  async () => {
    const merkleRootUpdater = await ctx.contracts.sapphire.creditScore.merkleRootUpdater();
    expect(merkleRootUpdater).not.eq(ctx.signers.admin.address);
    expect(merkleRootUpdater).eq(ctx.signers.interestSetter.address);
  })

  describe('#setPause', () => {
    it('initially not active',  async () => {
      expect(await ctx.contracts.sapphire.creditScore.isPaused()).to.be.true;
    })

    it('revert if set pause as unauthorize', async () => {
      expect(await ctx.contracts.sapphire.creditScore.merkleRootUpdater()).not.eq(ctx.signers.unauthorised.address);
      expect(await ctx.contracts.sapphire.creditScore.owner()).not.eq(ctx.signers.unauthorised.address);
      await expect(ctx.contracts.sapphire.creditScore.connect(ctx.signers.unauthorised).setPause(false)).to.be.revertedWith('Ownable: caller is not the owner');
    })

    it('revert if set pause as merkle root updater', async () => {
      expect(await ctx.contracts.sapphire.creditScore.merkleRootUpdater()).eq(ctx.signers.interestSetter.address);
      await expect(ctx.contracts.sapphire.creditScore.connect(ctx.signers.interestSetter).setPause(false)).to.be.revertedWith('Ownable: caller is not the owner');
    })

    it('set pause as owner', async () => {
      await expect(ctx.contracts.sapphire.creditScore.setPause(false)).not.to.be.reverted;
    })
  })

  describe('#updateMerkleRoot', () => {
    beforeEach(async () => {
      await ctx.contracts.sapphire.creditScore.setPause(false);
    });

    it('should not be able to update the merkle root as an unauthorised user', async () => {
      await expect(ctx.contracts.sapphire.creditScore.connect(ctx.signers.unauthorised).updateMerkleRoot(ZERO_BYTES32)).to.be.revertedWith('SapphireCreditScore: caller is not authorized to update merkle root');
    });

    it('should not be able to update as the owner if the contract is not paused', async () => {
      await expect(ctx.contracts.sapphire.creditScore.updateMerkleRoot(ZERO_BYTES32)).to.be.revertedWith('SapphireCreditScore: pause contract to update merkle root as owner');
    });

    it('should not be able to be called by the root updater before the delay duration', async () => {
      await ctx.contracts.sapphire.creditScore.connect(ctx.signers.interestSetter).updateMerkleRoot(ZERO_BYTES32);
      await expect(ctx.contracts.sapphire.creditScore.connect(ctx.signers.interestSetter).updateMerkleRoot(ZERO_BYTES32)).to.be.revertedWith('SapphireCreditScore: too frequent root update');
    });

    xit('should not be able to post an empty root', async () => {
      // calling with null or undefined as merkle root throw error cannot call .toHex() on undefined/null
      await expect(ctx.contracts.sapphire.creditScore.connect(ctx.signers.interestSetter).updateMerkleRoot(null as any)).to.be.revertedWith('SapphireCreditScore: root is empty');
    });

    it('instantly update merkle root as the root owner', async () => {
      await ctx.contracts.sapphire.creditScore.setPause(true);
      const upcomingMerkleRoot = await ctx.contracts.sapphire.creditScore.upcomingMerkleRoot();
      await ctx.contracts.sapphire.creditScore.connect(ctx.signers.admin).updateMerkleRoot(ONE_BYTES32);
      expect(await ctx.contracts.sapphire.creditScore.upcomingMerkleRoot()).eq(upcomingMerkleRoot);
      expect(await ctx.contracts.sapphire.creditScore.currentMerkleRoot()).eq(ONE_BYTES32);
    });

    it('instantly update merkle root as the root owner avoiding time delay ', async () => {
      await ctx.contracts.sapphire.creditScore.connect(ctx.signers.interestSetter).updateMerkleRoot(ONE_BYTES32);
      const initialLastMerkleRootUpdate = await ctx.contracts.sapphire.creditScore.lastMerkleRootUpdate();
      const initialUpcomingMerkleRoot = await ctx.contracts.sapphire.creditScore.upcomingMerkleRoot();
      await ctx.contracts.sapphire.creditScore.connect(ctx.signers.admin).setPause(true);
      await ctx.contracts.sapphire.creditScore.connect(ctx.signers.admin).updateMerkleRoot(TWO_BYTES32);
      // should this method update lastMerkleRootUpdate timestamp?
      expect(await ctx.contracts.sapphire.creditScore.lastMerkleRootUpdate()).eq(initialLastMerkleRootUpdate);
      expect(await ctx.contracts.sapphire.creditScore.upcomingMerkleRoot()).eq(initialUpcomingMerkleRoot);
      expect(await ctx.contracts.sapphire.creditScore.currentMerkleRoot()).eq(TWO_BYTES32);
    });

    it('should be able to update the merkle root as the root updater', async () => {
      const initialLastMerkleRootUpdate = await ctx.contracts.sapphire.creditScore.lastMerkleRootUpdate();
      const initialUpcomingMerkleRoot = await ctx.contracts.sapphire.creditScore.upcomingMerkleRoot();
      await ctx.contracts.sapphire.creditScore.connect(ctx.signers.interestSetter).updateMerkleRoot(ONE_BYTES32);
      expect(await ctx.contracts.sapphire.creditScore.lastMerkleRootUpdate()).not.eq(initialLastMerkleRootUpdate);
      expect(await ctx.contracts.sapphire.creditScore.currentMerkleRoot()).eq(initialUpcomingMerkleRoot);
      expect(await ctx.contracts.sapphire.creditScore.upcomingMerkleRoot()).eq(ONE_BYTES32);
    });
  });

  describe('#request', async () => {
    it('should be able to verify and update a users score', async () => {
      // Check if the merkle root exists and if the last updated is the same as now then return stored
      // If not, ensure validity of root then update current score and last updated
      // Return verified score
    });

    it('should not be able to request an invalid proof', async () => {});

    it('should not reverify a score if the timestamps are the same', async () => {
      // Check this through event emission
    });
  });
});
