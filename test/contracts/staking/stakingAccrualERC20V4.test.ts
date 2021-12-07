import { StakingAccrualERC20V4 } from '@src/typings';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';

describe('StakingAccrualERC20V4', () => {
  let contract: StakingAccrualERC20V4;

  before(async () => {
    // set up base contract
    // user 1 stakes
    // user 2 stakes
    // some tokens are topped up
    // contract is upgraded
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#stake', () => {
    it('reverts if proof is set and no proof is provided');

    it('reverts if proof is set and the wrong proof is passed');

    it('reverts if proof is set and the score is smaller than the threshold');

    it(
      'stakes if proof is set and score is greater than or equal to the threshold',
    );

    it('stakes if no proof is passed');
  });

  describe('#setProofProtocol', () => {
    it('reverts if called by non-admin');

    it('sets the proof protocol and the score threshold');
  });
});
