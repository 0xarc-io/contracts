import 'module-alias/register';

import { BigNumber, utils } from 'ethers';
import chai from 'chai';

import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { solidity } from 'ethereum-waffle';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';
import { WaitlistBatch } from '@src/typings/WaitlistBatch';
import {
  MockWaitlistBatch,
  TestToken,
  TestToken__factory,
  WaitlistBatch__factory,
} from '@src/typings';
import { MockWaitlistBatch__factory } from '@src/typings';

chai.use(solidity);
const expect = chai.expect;

const BASE_TIMESTAMP = 100;
const DEPOSIT_LOCKUP_DURATION = 10;

describe('WhitelistBatch', () => {
  let ownerAccount: SignerWithAddress;
  let userAccount: SignerWithAddress;
  let moderator: SignerWithAddress;
  let user2: SignerWithAddress;
  let waitlist: MockWaitlistBatch;
  let userWaitlist: MockWaitlistBatch;
  let depositToken: TestToken;

  const batch = {
    totalSpots: BigNumber.from(5),
    startTimestamp: BigNumber.from(BASE_TIMESTAMP + 10),
    depositAmount: BigNumber.from(10),
  };

  function currentTimestamp() {
    return waitlist.currentTimestamp();
  }

  async function setupBatch() {
    await waitlist.addNewBatch(
      batch.totalSpots,
      batch.startTimestamp,
      batch.depositAmount,
    );

    await depositToken.mintShare(user2.address, batch.depositAmount.div(2));

    const user2DepositToken = TestToken__factory.connect(
      depositToken.address,
      user2,
    );
    await user2DepositToken.approve(
      waitlist.address,
      batch.depositAmount.div(2),
    );
  }

  before(async () => {
    const signers = await ethers.getSigners();
    ownerAccount = signers[0];
    userAccount = signers[1];
    user2 = signers[2];
    moderator = signers[3];

    depositToken = await new TestToken__factory(ownerAccount).deploy(
      'TEST',
      'TEST',
      18,
    );

    waitlist = await new MockWaitlistBatch__factory(ownerAccount).deploy(
      depositToken.address,
      DEPOSIT_LOCKUP_DURATION,
    );
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    waitlist.setCurrentTimestamp(BASE_TIMESTAMP);

    userWaitlist = MockWaitlistBatch__factory.connect(
      waitlist.address,
      userAccount,
    );

    const userDepositToken = TestToken__factory.connect(
      depositToken.address,
      userAccount,
    );
    await depositToken.mintShare(
      userAccount.address,
      batch.depositAmount.mul(2),
    );
    await userDepositToken.approve(
      waitlist.address,
      batch.depositAmount.mul(2),
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#constructor', () => {
    it('sets the deposit currency and the deposit lockup duration', async () => {
      expect(await waitlist.depositCurrency()).to.eq(depositToken.address);
      expect(await waitlist.depositLockupDuration()).to.eq(
        DEPOSIT_LOCKUP_DURATION,
      );
    });
  });

  describe('View functions', () => {
    describe('#getBatchInfoForUser', () => {
      beforeEach(async () => {
        await waitlist.addNewBatch(
          batch.totalSpots,
          batch.startTimestamp,
          batch.depositAmount,
        );
      });

      it('returns false if user did not participate to a batch', async () => {
        const batchInfo = await userWaitlist.getBatchInfoForUser(
          userWaitlist.address,
        );

        expect(batchInfo.hasParticipated).to.be.false;
      });

      it('returns true, the batch number and the deposit amount for a user who participated', async () => {
        await waitlist.setCurrentTimestamp(batch.startTimestamp);
        await userWaitlist.applyToBatch(1);

        let batchInfo = await userWaitlist.getBatchInfoForUser(
          userAccount.address,
        );

        expect(batchInfo.hasParticipated).to.be.true;
        expect(batchInfo.batchNumber).to.eq(1);
        expect(batchInfo.depositAmount).to.eq(batch.depositAmount);

        // Approve and reclaim amount
        await waitlist.approveBatch(1);
        await waitlist.setCurrentTimestamp(
          (await currentTimestamp()).add(DEPOSIT_LOCKUP_DURATION),
        );
        await userWaitlist.reclaimTokens();

        batchInfo = await userWaitlist.getBatchInfoForUser(userAccount.address);
        expect(batchInfo.depositAmount).to.eq(0);
      });
    });

    describe('#getDepositRetrievalTimestamp', () => {
      beforeEach(async () => {
        await setupBatch();
        await waitlist.setCurrentTimestamp(batch.startTimestamp);
      });

      it('returns 0 if the user did not participate in a batch', async () => {
        expect(
          await userWaitlist.getDepositRetrievalTimestamp(userAccount.address),
        ).to.eq(0);
      });

      it(`returns 0 if the user's batch was not yet approved`, async () => {
        await userWaitlist.applyToBatch(1);

        const batchInfo = await userWaitlist.getBatchInfoForUser(
          userAccount.address,
        );
        expect(batchInfo.batchNumber).to.eq(1);
        expect((await waitlist.batchMapping(1)).approvedAt).to.eq(0);

        expect(
          await userWaitlist.getDepositRetrievalTimestamp(userAccount.address),
        ).to.eq(0);
      });

      it('returns the epoch when the user can withdraw their funds', async () => {
        await userWaitlist.applyToBatch(1);
        await waitlist.approveBatch(1);

        expect(
          await userWaitlist.getDepositRetrievalTimestamp(userAccount.address),
        ).to.eq((await currentTimestamp()).add(DEPOSIT_LOCKUP_DURATION));
      });
    });
  });

  describe('Mutative functions', () => {
    describe('#applyToBatch', () => {
      let user2Waitlist: WaitlistBatch;

      before(() => {
        user2Waitlist = WaitlistBatch__factory.connect(waitlist.address, user2);
      });

      beforeEach(setupBatch);

      it('cannot apply to a non-existent batch', async () => {
        await waitlist.setCurrentTimestamp(batch.startTimestamp);

        await expect(userWaitlist.applyToBatch(0)).to.be.revertedWith(
          'WaitlistBatch: batch does not exist',
        );
      });

      it('cannot apply to a filled up batch', async () => {
        // Add a batch with only 1 spot
        await waitlist.addNewBatch(1, BASE_TIMESTAMP, batch.depositAmount);

        await waitlist.setCurrentTimestamp(batch.startTimestamp);

        await userWaitlist.applyToBatch(2);

        await expect(user2Waitlist.applyToBatch(2)).to.be.revertedWith(
          'WaitlistBatch: batch is filled',
        );
      });

      it('cannot apply without having enough currency', async () => {
        await waitlist.setCurrentTimestamp(batch.startTimestamp);

        await expect(user2Waitlist.applyToBatch(1)).to.be.revertedWith(
          'SafeERC20: TRANSFER_FROM_FAILED',
        );
      });

      it('cannot apply before the start time', async () => {
        await expect(userWaitlist.applyToBatch(1)).to.be.revertedWith(
          'WaitlistBatch: cannot apply before the start time',
        );
      });

      it('cannot apply again after having reclaimed', async () => {
        await waitlist.setCurrentTimestamp(batch.startTimestamp);
        await userWaitlist.applyToBatch(1);
        await waitlist.approveBatch(1);
        await waitlist.setCurrentTimestamp(
          (await currentTimestamp()).add(DEPOSIT_LOCKUP_DURATION),
        );

        await userWaitlist.reclaimTokens();

        await expect(userWaitlist.applyToBatch(1)).to.be.revertedWith(
          'WaitlistBatch: cannot apply to more than one batch',
        );
      });

      it('can apply to a valid batch', async () => {
        // Add new batch to increment the batch number
        await waitlist.addNewBatch(
          batch.totalSpots.sub(1),
          BASE_TIMESTAMP,
          batch.depositAmount,
        );

        await waitlist.setCurrentTimestamp(batch.startTimestamp);

        const preUserBalance = await depositToken.balanceOf(
          userAccount.address,
        );
        const preContractBalance = await depositToken.balanceOf(
          waitlist.address,
        );

        await userWaitlist.applyToBatch(2);

        const updatedBatch = await waitlist.batchMapping(2);
        const postUserBalance = await depositToken.balanceOf(
          userAccount.address,
        );
        const postContractBalance = await depositToken.balanceOf(
          waitlist.address,
        );

        const batchNumber = await userWaitlist.userBatchMapping(
          userAccount.address,
        );
        const recordedBalance = await userWaitlist.userDepositMapping(
          batchNumber,
          userAccount.address,
        );

        expect(batchNumber).to.eq(2);
        expect(recordedBalance).to.eq(batch.depositAmount);
        expect(postUserBalance).to.eq(preUserBalance.sub(batch.depositAmount));
        expect(postContractBalance).to.eq(
          preContractBalance.add(batch.depositAmount),
        );

        // Check batch variables
        expect(updatedBatch.totalSpots).to.eq(batch.totalSpots.sub(1));
        expect(updatedBatch.filledSpots).to.eq(1);
        expect(updatedBatch.depositAmount).to.eq(batch.depositAmount);
      });

      it('cannot apply if already applied to a previous batch', async () => {
        await waitlist.addNewBatch(
          batch.totalSpots,
          BASE_TIMESTAMP,
          batch.depositAmount,
        );

        await waitlist.setCurrentTimestamp(batch.startTimestamp);

        await userWaitlist.applyToBatch(1);

        await expect(userWaitlist.applyToBatch(1)).to.been.revertedWith(
          'WaitlistBatch: cannot apply to more than one batch',
        );
      });
    });

    describe('#reclaimTokens', () => {
      beforeEach(async () => {
        await waitlist.addNewBatch(
          batch.totalSpots,
          batch.startTimestamp,
          batch.depositAmount,
        );

        await waitlist.setCurrentTimestamp(batch.startTimestamp);
      });

      it('cannot reclaim tokens if caller did not participate in a batch', async () => {
        await waitlist.approveBatch(1);

        const batch = await waitlist.batchMapping(1);
        await waitlist.setCurrentTimestamp(
          batch.approvedAt.add(DEPOSIT_LOCKUP_DURATION),
        );

        await expect(userWaitlist.reclaimTokens()).to.be.revertedWith(
          'WaitlistBatch: user did not participate in a batch',
        );
      });

      it('cannot reclaim tokens twice', async () => {
        await userWaitlist.applyToBatch(1);
        await waitlist.approveBatch(1);

        const batch = await waitlist.batchMapping(1);
        await waitlist.setCurrentTimestamp(
          batch.approvedAt.add(DEPOSIT_LOCKUP_DURATION),
        );

        await userWaitlist.reclaimTokens();

        await expect(userWaitlist.reclaimTokens()).to.be.revertedWith(
          'WaitlistBatch: there are no tokens to reclaim',
        );
      });

      it('cannot reclaim if user is blacklisted', async () => {
        await userWaitlist.applyToBatch(1);
        await waitlist.approveBatch(1);

        const batch = await waitlist.batchMapping(1);
        await waitlist.setCurrentTimestamp(
          batch.approvedAt.add(DEPOSIT_LOCKUP_DURATION),
        );

        await waitlist.setModerator(moderator.address);
        const moderatorWaitlist = waitlist.connect(moderator);
        await moderatorWaitlist.addToBlacklist(userAccount.address);

        await expect(userWaitlist.reclaimTokens()).to.be.revertedWith(
          'WaitlistBatch: user is blacklisted',
        );
      });

      it('reverts if the batch is not approved', async () => {
        await userWaitlist.applyToBatch(1);
        await waitlist.setCurrentTimestamp(
          (await currentTimestamp()).add(DEPOSIT_LOCKUP_DURATION),
        );

        await expect(userWaitlist.reclaimTokens()).to.be.revertedWith(
          'WaitlistBatch: the batch is not approved yet',
        );
      });

      it('reverts if the batch is approved but the time limit has not passed', async () => {
        await userWaitlist.applyToBatch(1);
        await waitlist.approveBatch(1);

        const batch = await waitlist.batchMapping(1);
        await waitlist.setCurrentTimestamp(
          batch.approvedAt.add(DEPOSIT_LOCKUP_DURATION - 1),
        );

        await expect(userWaitlist.reclaimTokens()).to.be.revertedWith(
          'WaitlistBatch: the deposit lockup duration has not passed yet',
        );
      });

      it('reclaims the tokens to the user after the batch is approved and the time limit was passed', async () => {
        await userWaitlist.applyToBatch(1);
        await waitlist.approveBatch(1);

        const batch = await waitlist.batchMapping(1);
        await waitlist.setCurrentTimestamp(
          batch.approvedAt.add(DEPOSIT_LOCKUP_DURATION),
        );

        const preBalance = await depositToken.balanceOf(userAccount.address);
        await userWaitlist.reclaimTokens();
        const postBalance = await depositToken.balanceOf(userAccount.address);

        expect(postBalance).to.eq(preBalance.add(batch.depositAmount));
      });

      it('emits the TokensReclaimed event', async () => {
        await userWaitlist.applyToBatch(1);
        await waitlist.approveBatch(1);

        const batch = await waitlist.batchMapping(1);
        await waitlist.setCurrentTimestamp(
          batch.approvedAt.add(DEPOSIT_LOCKUP_DURATION),
        );

        await expect(userWaitlist.reclaimTokens())
          .to.emit(userWaitlist, 'TokensReclaimed')
          .withArgs(userAccount.address, batch.depositAmount);
      });
    });
  });

  describe('Admin functions', () => {
    describe('#addNewBatch', () => {
      it('cannot start a batch with the start date before now', async () => {
        await expect(
          waitlist.addNewBatch(5, BASE_TIMESTAMP - 1, 10),
        ).to.be.revertedWith(
          'WaitlistBatch: batch start time cannot be in the past',
        );
      });

      it('cannot start a batch with the deposit amount as 0', async () => {
        await expect(
          waitlist.addNewBatch(5, BASE_TIMESTAMP, 0),
        ).to.be.revertedWith('WaitlistBatch: deposit amount cannot be 0');
      });

      it('cannot start a batch with 0 spots', async () => {
        await expect(
          waitlist.addNewBatch(0, BASE_TIMESTAMP, 10),
        ).to.be.revertedWith('WaitlistBatch: batch cannot have 0 spots');
      });

      it('cannot start a batch as a non-owner', async () => {
        const unauthorizedWaitlist = MockWaitlistBatch__factory.connect(
          waitlist.address,
          userAccount,
        );

        await expect(
          unauthorizedWaitlist.addNewBatch(5, BASE_TIMESTAMP, 10),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('can start a valid new batch as the owner', async () => {
        const batch1 = {
          totalSpots: BigNumber.from(5),
          startTime: BigNumber.from(BASE_TIMESTAMP),
          depositAmount: BigNumber.from(10),
        };

        const batch2 = {
          totalSpots: BigNumber.from(3),
          startTime: BigNumber.from(BASE_TIMESTAMP + 10),
          depositAmount: BigNumber.from(15),
        };

        await waitlist.addNewBatch(
          batch1.totalSpots,
          batch1.startTime,
          batch1.depositAmount,
        );

        expect(
          await waitlist.nextBatchNumber(),
          'The next batch number increased by 1',
        ).to.eq(2);

        await waitlist.addNewBatch(
          batch2.totalSpots,
          batch2.startTime,
          batch2.depositAmount,
        );

        expect(
          await waitlist.nextBatchNumber(),
          'The next batch number increased by 1',
        ).to.eq(3);

        const fetchedBatch = await waitlist.batchMapping(1);
        expect(fetchedBatch.totalSpots).to.eq(batch1.totalSpots);
        expect(fetchedBatch.filledSpots).to.eq(0);
        expect(fetchedBatch.batchStartTimestamp).to.eq(batch1.startTime);
        expect(fetchedBatch.depositAmount).to.eq(batch1.depositAmount);
        expect(fetchedBatch.approvedAt).to.eq(0);
      });

      it('emits the NewBatchAdded event', async () => {
        await expect(waitlist.addNewBatch(5, BASE_TIMESTAMP, 10))
          .to.emit(waitlist, 'NewBatchAdded')
          .withArgs(5, BASE_TIMESTAMP, 10, 1);

        await expect(waitlist.addNewBatch(5, BASE_TIMESTAMP + 1, 10))
          .to.emit(waitlist, 'NewBatchAdded')
          .withArgs(5, BASE_TIMESTAMP + 1, 10, 2);
      });
    });

    describe('#approveBatch', () => {
      beforeEach(async () => {
        await waitlist.addNewBatch(5, BASE_TIMESTAMP, 10);
      });

      it('reverts if called by non-admin', async () => {
        await expect(userWaitlist.approveBatch(1)).to.be.revertedWith(
          'Ownable: caller is not the owner',
        );
      });

      it('reverts if the batch does not exist', async () => {
        await expect(waitlist.approveBatch(2)).to.be.revertedWith(
          'WaitlistBatch: the batch does not exist',
        );
      });

      it('approves a batch', async () => {
        let batch = await waitlist.batchMapping(1);
        expect(batch.approvedAt).to.eq(0);

        await waitlist.approveBatch(1);

        batch = await waitlist.batchMapping(1);
        expect(batch.approvedAt).to.eq(await waitlist.currentTimestamp());
      });

      it('reverts if the batch was already approved', async () => {
        await waitlist.approveBatch(1);

        await expect(waitlist.approveBatch(1)).to.be.revertedWith(
          'WaitlistBatch: the batch is already approved',
        );
      });
    });

    describe('#changeBatchStartTimestamp', () => {
      beforeEach(async () => {
        await waitlist.addNewBatch(5, BASE_TIMESTAMP, 10);
      });

      it('cannot change the batch start timestamp as a non-owner', async () => {
        const unauthorizedWaitlist = MockWaitlistBatch__factory.connect(
          waitlist.address,
          userAccount,
        );
        await expect(
          unauthorizedWaitlist.changeBatchStartTimestamp(0, BASE_TIMESTAMP),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('cannot change the batch start timestamp for a non-existent batch', async () => {
        await expect(
          waitlist.changeBatchStartTimestamp(0, BASE_TIMESTAMP),
        ).to.be.revertedWith('WaitlistBatch: batch does not exit');

        await expect(
          waitlist.changeBatchStartTimestamp(2, BASE_TIMESTAMP),
        ).to.be.revertedWith('WaitlistBatch: batch does not exit');
      });

      it('cannot change the batch start timestamp to the past', async () => {
        await expect(
          waitlist.changeBatchStartTimestamp(1, BASE_TIMESTAMP - 10),
        ).to.be.revertedWith(
          'WaitlistBatch: batch start time cannot be in the past',
        );
      });

      it('can change the batch start timestamp as the owner', async () => {
        const newTime = BASE_TIMESTAMP + 21;
        await waitlist.changeBatchStartTimestamp(1, newTime);

        const updatedBatch = await waitlist.batchMapping(1);
        expect(updatedBatch.batchStartTimestamp).to.eq(newTime);
      });

      it('emits the BatchTimestampChanged event', async () => {
        const newTime = BASE_TIMESTAMP + 21;
        await expect(waitlist.changeBatchStartTimestamp(1, newTime))
          .to.emit(waitlist, 'BatchTimestampChanged')
          .withArgs(1, newTime);
      });
    });

    describe('#changeBatchTotalSpots', () => {
      beforeEach(async () => {
        await waitlist.addNewBatch(
          batch.totalSpots,
          batch.startTimestamp,
          batch.depositAmount,
        );
      });

      it('cannot change the total spots as a non-owner', async () => {
        const unauthorizedWaitlist = MockWaitlistBatch__factory.connect(
          waitlist.address,
          userAccount,
        );

        await expect(
          unauthorizedWaitlist.changeBatchTotalSpots(
            0,
            batch.totalSpots.add(1),
          ),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('cannot change the total spots of an inexisting batch', async () => {
        await expect(
          waitlist.changeBatchTotalSpots(2, batch.totalSpots.add(1)),
        ).to.be.revertedWith('WaitlistBatch: the batch does not exist');
      });

      it('cannot change the total spots past the start date', async () => {
        await waitlist.setCurrentTimestamp(batch.startTimestamp.add(1));
        await expect(
          waitlist.changeBatchTotalSpots(1, batch.totalSpots.add(1)),
        ).to.be.revertedWith(
          'WaitlistBatch: the batch start date already passed',
        );
      });

      it('cannot change the total spots to less than the existing fill amount', async () => {
        await expect(
          waitlist.changeBatchTotalSpots(1, batch.totalSpots.sub(1)),
        ).to.be.revertedWith(
          'WaitlistBatch: cannot change total spots to a smaller or equal number',
        );
      });

      it('can change the total spots as the owner', async () => {
        const newSpotsAmt = batch.totalSpots.add(5);
        await waitlist.changeBatchTotalSpots(1, newSpotsAmt);

        const updatedBatch = await waitlist.batchMapping(1);
        expect(updatedBatch.totalSpots).to.eq(newSpotsAmt);
      });

      it('emits the BatchTotalSpotsUpdated event', async () => {
        const newSpotsAmt = batch.totalSpots.add(5);
        await expect(waitlist.changeBatchTotalSpots(1, newSpotsAmt))
          .to.emit(waitlist, 'BatchTotalSpotsUpdated')
          .withArgs(1, newSpotsAmt);
      });
    });

    describe('#transferTokens', () => {
      const tokensAmt = utils.parseEther('10');
      let otherToken: TestToken;

      before(async () => {
        otherToken = await new TestToken__factory(ownerAccount).deploy(
          'OTHER TOKEN',
          'OTHERTOK',
          18,
        );
      });

      beforeEach(async () => {
        // Mint 10 tokens to the contract
        await otherToken.mintShare(waitlist.address, tokensAmt);
      });

      it('cannot transfer tokens as a non-owner', async () => {
        const unauthorizedWaitlist = MockWaitlistBatch__factory.connect(
          waitlist.address,
          userAccount,
        );

        await expect(
          unauthorizedWaitlist.transferTokens(
            otherToken.address,
            tokensAmt,
            ownerAccount.address,
          ),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('can transfer tokens as the owner', async () => {
        const preBalance = await otherToken.balanceOf(ownerAccount.address);

        await waitlist.transferTokens(
          otherToken.address,
          tokensAmt,
          ownerAccount.address,
        );

        const postBalance = await otherToken.balanceOf(ownerAccount.address);

        expect(postBalance).to.eq(preBalance.add(tokensAmt));
      });

      it('emits the TokensTransferred event', async () => {
        await expect(
          waitlist.transferTokens(
            otherToken.address,
            tokensAmt,
            ownerAccount.address,
          ),
        )
          .to.emit(waitlist, 'TokensTransferred')
          .withArgs(otherToken.address, tokensAmt, ownerAccount.address);
      });
    });

    describe('#setModerator', () => {
      it('reverts if called by a normie', async () => {
        const unauthorizedWaitlist = MockWaitlistBatch__factory.connect(
          waitlist.address,
          userAccount,
        );

        await expect(
          unauthorizedWaitlist.setModerator(unauthorizedWaitlist.address),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('sets the moderator if called by admin', async () => {
        await waitlist.setModerator(moderator.address);

        expect(await waitlist.moderator()).to.eq(moderator.address);
      });

      it('emits ModeratorSet event', async () => {
        await expect(waitlist.setModerator(moderator.address))
          .to.emit(waitlist, 'ModeratorSet')
          .withArgs(moderator.address);
      });
    });

    describe('setDepositLockupDuration', () => {
      it('reverts if called by non-owner', async () => {
        await expect(
          userWaitlist.setDepositLockupDuration(5),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('sets the deposit lockup duration', async () => {
        const newDuration = DEPOSIT_LOCKUP_DURATION + 21;

        expect(await waitlist.depositLockupDuration()).to.eq(
          DEPOSIT_LOCKUP_DURATION,
        );

        await waitlist.setDepositLockupDuration(newDuration);

        expect(await waitlist.depositLockupDuration()).to.eq(newDuration);
      });
    });
  });

  describe('Moderator functions', () => {
    describe('#addToBlacklist', () => {
      before(async () => {
        await waitlist.setModerator(moderator.address);
      });

      it('reverts if called by non-moderator', async () => {
        const unauthorizedWaitlist = waitlist.connect(user2.address);

        await expect(
          unauthorizedWaitlist.addToBlacklist(userAccount.address),
        ).to.be.revertedWith('WaitlistBatch: caller is not moderator');
      });

      it('adds address to the blacklist', async () => {
        const moderatorWaitlist = waitlist.connect(moderator);

        await moderatorWaitlist.addToBlacklist(userAccount.address);

        expect(await moderatorWaitlist.blacklist(userAccount.address)).to.be
          .true;
      });

      it('emits AddedToBlacklist event', async () => {
        const moderatorWaitlist = waitlist.connect(moderator);

        await expect(moderatorWaitlist.addToBlacklist(userAccount.address))
          .to.emit(moderatorWaitlist, 'AddedToBlacklist')
          .withArgs(userAccount.address);
      });
    });

    describe('#removeFromBlacklist', () => {
      let moderatorWaitlist: WaitlistBatch;

      before(async () => {
        moderatorWaitlist = waitlist.connect(moderator);
        await moderatorWaitlist.addToBlacklist(userAccount.address);
      });

      after(async () => {
        await moderatorWaitlist.removeFromBlacklist(userAccount.address);
      });

      it('reverts if called by non-moderator', async () => {
        const unauthorizedWaitlist = MockWaitlistBatch__factory.connect(
          waitlist.address,
          userAccount,
        );

        await expect(
          unauthorizedWaitlist.removeFromBlacklist(userAccount.address),
        ).to.be.revertedWith('WaitlistBatch: caller is not moderator');
      });

      it('removes address to the blacklist', async () => {
        expect(await moderatorWaitlist.blacklist(userAccount.address)).to.be
          .true;

        await moderatorWaitlist.removeFromBlacklist(userAccount.address);

        expect(await moderatorWaitlist.blacklist(userAccount.address)).to.be
          .false;
      });

      it('emits RemovedFromBlacklist event', async () => {
        await expect(moderatorWaitlist.removeFromBlacklist(userAccount.address))
          .to.emit(moderatorWaitlist, 'RemovedFromBlacklist')
          .withArgs(userAccount.address);
      });
    });
  });
});
