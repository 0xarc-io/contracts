import 'module-alias/register';

import { BigNumber, utils } from 'ethers';
import chai from 'chai';

import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { solidity } from 'ethereum-waffle';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';
import { WaitlistBatch } from '@src/typings/WaitlistBatch';
import { WaitlistBatchFactory } from '@src/typings/WaitlistBatchFactory';
import { TestToken, TestTokenFactory } from '@src/typings';
import { EVM } from '@test/helpers/EVM';

chai.use(solidity);
const expect = chai.expect;

describe('WhitelistBatch', () => {
  let ownerAccount: SignerWithAddress;
  let userAccount: SignerWithAddress;
  let waitlist: WaitlistBatch;
  let depositToken: TestToken;

  before(async () => {
    const signers = await ethers.getSigners();
    ownerAccount = signers[0];
    userAccount = signers[1];

    depositToken = await new TestTokenFactory(ownerAccount).deploy('TEST', 'TEST', 18);

    waitlist = await new WaitlistBatchFactory(ownerAccount).deploy(depositToken.address);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#constructor', () => {
    it('sets the deposit currency', async () => {
      expect(await waitlist.depositCurrency()).to.eq(depositToken.address);
    });
  });

  describe('#applyToBatch', () => {
    it('cannot apply to a non-existent batch');

    it('cannot apply to a filled up batch');

    it('cannot apply without having enough currency');

    it('cannot apply before the start time');

    it('can apply to a valid batch');

    it('cannot apply if already applied to a previous batch');
  });

  describe('#addNewBatch', () => {
    let now: number;

    beforeEach(async () => {
      const provider = ethers.provider;
      const currentBlockNr = await provider.getBlockNumber();
      const currentBlock = await provider.getBlock(currentBlockNr);
      // increment by one to reflect the new block being minde in the next tx
      now = currentBlock.timestamp + 1;
    });

    it('cannot start a batch with the start date before now', async () => {
      await expect(waitlist.addNewBatch(5, now - 1, 10)).to.be.revertedWith(
        'WaitlistBatch: batch start time cannot be in the past',
      );
    });

    it('cannot start a batch with the deposit amount as 0', async () => {
      console.log(now);
      await expect(waitlist.addNewBatch(5, now, 0)).to.be.revertedWith(
        'WaitlistBatch: deposit amount cannot be 0',
      );
    });

    it('cannot start a batch with 0 spots', async () => {
      await expect(waitlist.addNewBatch(0, now, 10)).to.be.revertedWith(
        'WaitlistBatch: batch cannot have 0 spots',
      );
    });

    it('cannot start a batch as a non-owner', async () => {
      const unauthorizedWaitlist = WaitlistBatchFactory.connect(waitlist.address, userAccount);

      await expect(unauthorizedWaitlist.addNewBatch(5, now, 10)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('can start a valid new batch as the owner', async () => {
      const batch1 = {
        totalSpots: BigNumber.from(5),
        startTime: BigNumber.from(now),
        depositAmount: BigNumber.from(10),
      };

      const batch2 = {
        totalSpots: BigNumber.from(3),
        startTime: BigNumber.from(now + 10),
        depositAmount: BigNumber.from(15),
      };

      await waitlist.addNewBatch(batch1.totalSpots, batch1.startTime, batch1.depositAmount);

      expect(
        await waitlist.totalNumberOfBatches(),
        'The total number of batches increased by 1',
      ).to.eq(1);

      await waitlist.addNewBatch(batch2.totalSpots, batch2.startTime, batch2.depositAmount);

      expect(
        await waitlist.totalNumberOfBatches(),
        'The total number of batches increased by 1',
      ).to.eq(2);

      const fetchedBatch = await waitlist.batchMapping(0);
      expect(fetchedBatch.totalSpots).to.eq(batch1.totalSpots);
      expect(fetchedBatch.filledSpots).to.eq(0);
      expect(fetchedBatch.batchStartTimestamp).to.eq(batch1.startTime);
      expect(fetchedBatch.depositAmount).to.eq(batch1.depositAmount);
      expect(fetchedBatch.claimable).to.eq(false);
    });

    it('emits the NewBatchAdded event', async () => {
      await expect(waitlist.addNewBatch(5, now, 10))
        .to.emit(waitlist, 'NewBatchAdded')
        .withArgs(5, now, 10, 0);

      await expect(waitlist.addNewBatch(5, now + 1, 10))
        .to.emit(waitlist, 'NewBatchAdded')
        .withArgs(5, now + 1, 10, 1);
    });
  });

  describe('#changeBatchStartTimestamp', () => {
    it('cannot change the batch start timestamp as a non-owner');

    it('cannot change the batch start timestamp for a non-existent batch');

    it('cannot change the batch start timestamp to the past');

    it('can change the batch start timestamp as the owner');
  });

  describe('#changeBatchTotalSpots', () => {
    it('cannot change the total spots as a non-owner');

    it('cannot change the total spots past the start date');

    it('cannot change the total spots to less than the existing fill amount');

    it('can change the total spots as the owner');
  });

  describe('#enableClaims', () => {
    it('cannot enable claims as a non-owner');

    it('cannot enable claims if claims have already been enabled');

    it('can enable claims as the owner');
  });

  describe('#transferTokens', () => {
    it('cannot transfer tokens as a non-owner');

    it('cannot transfer tokens of the deposit currency');

    it('can transfer tokens as the owner');
  });

  describe('#reclaimTokens', () => {
    it('cannot reclaim tokens if caller did not participate in a batch');

    it(
      'cannot reclaim tokens if the batch the user participated to does not have the tokens claimable',
    );
  });

  describe('#getBatchInfoForUser', () => {
    it('returns false if user did not participate to a batch');

    it('returns true, the batch number and the deposit amount for a user who participated');
  });
});
