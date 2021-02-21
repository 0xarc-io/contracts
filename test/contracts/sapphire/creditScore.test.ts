import 'module-alias/register';

/**
 * This is the core credit score contract and is where a user's credit score will
 * be posted. The logic around this contract needs to be very sound since we anticipate
 * it to be a core DeFi primitive for other applications to build on.
 */
describe('SapphireCreditScore', () => {
  // Utils will need to be developed to generate valid + invalid merkle roots

  describe('#updateMerkleRoot', () => {
    it('should not be able to update the merkle root as an unauthorised user', async () => {});

    it('should not be able to update as the owner if the contract is not paused', async () => {});

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
