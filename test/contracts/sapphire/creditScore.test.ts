import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import 'module-alias/register';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';

chai.use(solidity);

/**
 * This is the core credit score contract and is where a user's credit score will
 * be posted. The logic around this contract needs to be very sound since we anticipate
 * it to be a core DeFi primitive for other applications to build on.
 */
describe.only('SapphireCreditScore', () => {
  // Utils will need to be developed to generate valid + invalid merkle roots
  let ctx: ITestContext;

  before(async () => {
    ctx = await generateContext(sapphireFixture, async () => {});
  });

  it('should have merkle root updater not equal owner',  async () => {
    const merkleRootUpdater = await ctx.contracts.sapphire.creditScore.merkleRootUpdater();
    expect(merkleRootUpdater).not.eq(ctx.signers.admin.address);
    expect(merkleRootUpdater).eq(ctx.signers.interestSetter.address);
  })

  describe('#updateMerkleRoot', () => {
    it('should not be able to update the merkle root as an unauthorised user', async () => {
      await expect(ctx.contracts.sapphire.creditScore.connect(ctx.signers.unauthorised).updateMerkleRoot('0x0000000000000000000000000000000000000000000000000000000000000000')).to.be.revertedWith('SapphireCreditScore: caller is not authorized to update merkle root');
    });

    it('should not be able to update as the owner if the contract is not paused', async () => {
      await expect(ctx.contracts.sapphire.creditScore.updateMerkleRoot('0x0000000000000000000000000000000000000000000000000000000000000000')).to.be.revertedWith('SapphireCreditScore: pause contract to update merkle root as owner');
    });

    it('should not be able to be called by the root updater before the delay duration', async () => {});

    it('should not be able to post an empty root', async () => {});

    it('should be able to update the merkle root as the root updater', async () => {
      // Ensure the last updated date was updated
      // The current merkle root has been updated from the upcoming merkle root
      // The upcoming merkle root has been set in queue
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
