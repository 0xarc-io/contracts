import 'module-alias/register';

import { BigNumber, utils } from 'ethers';
import chai from 'chai';

import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { solidity } from 'ethereum-waffle';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';
import { WaitlistBatch } from '@src/typings/WaitlistBatch';
import {
  TestToken,
  TestTokenFactory,
  WaitlistBatchFactory,
} from '@src/typings';
import { MockWaitlistBatchFactory } from '@src/typings/MockWaitlistBatchFactory';

chai.use(solidity);
const expect = chai.expect;

const CURRENT_TIMESTAMP = 100;

describe('WhitelistBatch', () => {
  let ownerAccount: SignerWithAddress;
  let userAccount: SignerWithAddress;
  let moderator: SignerWithAddress;
  let user2: SignerWithAddress;
  let waitlist: WaitlistBatch;
  let userWaitlist: WaitlistBatch;
  let depositToken: TestToken;

  const batch = {
    totalSpots: BigNumber.from(5),
    startTimestamp: BigNumber.from(CURRENT_TIMESTAMP + 10),
    depositAmount: BigNumber.from(10),
  };

  async function setupBatch() {
    await waitlist.addNewBatch(
      batch.totalSpots,
      batch.startTimestamp,
      batch.depositAmount,
    );

    await depositToken.mintShare(user2.address, batch.depositAmount.div(2));

    const user2DepositToken = TestTokenFactory.connect(
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

    depositToken = await new TestTokenFactory(ownerAccount).deploy(
      'TEST',
      'TEST',
      18,
    );

    waitlist = await new MockWaitlistBatchFactory(ownerAccount).deploy(
      depositToken.address,
    );
    waitlist.setCurrentTimestamp(CURRENT_TIMESTAMP);

    userWaitlist = MockWaitlistBatchFactory.connect(
      waitlist.address,
      userAccount,
    );

    const userDepositToken = TestTokenFactory.connect(
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
    it('sets the deposit currency', async () => {
      expect(await waitlist.depositCurrency()).to.eq(depositToken.address);
    });
  });

  describe('#applyToBatch', () => {
    let user2Waitlist: WaitlistBatch;

    before(() => {
      user2Waitlist = WaitlistBatchFactory.connect(waitlist.address, user2);
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
      await waitlist.addNewBatch(1, CURRENT_TIMESTAMP, batch.depositAmount);

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
      await waitlist.enableClaims([1]);
      await userWaitlist.applyToBatch(1);
      await userWaitlist.reclaimTokens();

      await expect(userWaitlist.applyToBatch(1)).to.be.revertedWith(
        'WaitlistBatch: cannot apply to more than one batch',
      );
    });

    it('can apply to a valid batch', async () => {
      // Add new batch to increment the batch number
      await waitlist.addNewBatch(
        batch.totalSpots.sub(1),
        CURRENT_TIMESTAMP,
        batch.depositAmount,
      );

      await waitlist.setCurrentTimestamp(batch.startTimestamp);

      const preUserBalance = await depositToken.balanceOf(userAccount.address);
      const preContractBalance = await depositToken.balanceOf(waitlist.address);

      await userWaitlist.applyToBatch(2);

      const updatedBatch = await waitlist.batchMapping(2);
      const postUserBalance = await depositToken.balanceOf(userAccount.address);
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
        CURRENT_TIMESTAMP,
        batch.depositAmount,
      );

      await waitlist.setCurrentTimestamp(batch.startTimestamp);

      await userWaitlist.applyToBatch(1);

      await expect(userWaitlist.applyToBatch(1)).to.been.revertedWith(
        'WaitlistBatch: cannot apply to more than one batch',
      );
    });
  });

  describe('#addNewBatch', () => {
    it('cannot start a batch with the start date before now', async () => {
      await expect(
        waitlist.addNewBatch(5, CURRENT_TIMESTAMP - 1, 10),
      ).to.be.revertedWith(
        'WaitlistBatch: batch start time cannot be in the past',
      );
    });

    it('cannot start a batch with the deposit amount as 0', async () => {
      await expect(
        waitlist.addNewBatch(5, CURRENT_TIMESTAMP, 0),
      ).to.be.revertedWith('WaitlistBatch: deposit amount cannot be 0');
    });

    it('cannot start a batch with 0 spots', async () => {
      await expect(
        waitlist.addNewBatch(0, CURRENT_TIMESTAMP, 10),
      ).to.be.revertedWith('WaitlistBatch: batch cannot have 0 spots');
    });

    it('cannot start a batch as a non-owner', async () => {
      const unauthorizedWaitlist = MockWaitlistBatchFactory.connect(
        waitlist.address,
        userAccount,
      );

      await expect(
        unauthorizedWaitlist.addNewBatch(5, CURRENT_TIMESTAMP, 10),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('can start a valid new batch as the owner', async () => {
      const batch1 = {
        totalSpots: BigNumber.from(5),
        startTime: BigNumber.from(CURRENT_TIMESTAMP),
        depositAmount: BigNumber.from(10),
      };

      const batch2 = {
        totalSpots: BigNumber.from(3),
        startTime: BigNumber.from(CURRENT_TIMESTAMP + 10),
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
      expect(fetchedBatch.claimable).to.eq(false);
    });

    it('emits the NewBatchAdded event', async () => {
      await expect(waitlist.addNewBatch(5, CURRENT_TIMESTAMP, 10))
        .to.emit(waitlist, 'NewBatchAdded')
        .withArgs(5, CURRENT_TIMESTAMP, 10, 1);

      await expect(waitlist.addNewBatch(5, CURRENT_TIMESTAMP + 1, 10))
        .to.emit(waitlist, 'NewBatchAdded')
        .withArgs(5, CURRENT_TIMESTAMP + 1, 10, 2);
    });
  });

  describe('#changeBatchStartTimestamp', () => {
    beforeEach(async () => {
      await waitlist.addNewBatch(5, CURRENT_TIMESTAMP, 10);
    });

    it('cannot change the batch start timestamp as a non-owner', async () => {
      const unauthorizedWaitlist = MockWaitlistBatchFactory.connect(
        waitlist.address,
        userAccount,
      );
      await expect(
        unauthorizedWaitlist.changeBatchStartTimestamp(0, CURRENT_TIMESTAMP),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('cannot change the batch start timestamp for a non-existent batch', async () => {
      await expect(
        waitlist.changeBatchStartTimestamp(0, CURRENT_TIMESTAMP),
      ).to.be.revertedWith('WaitlistBatch: batch does not exit');

      await expect(
        waitlist.changeBatchStartTimestamp(2, CURRENT_TIMESTAMP),
      ).to.be.revertedWith('WaitlistBatch: batch does not exit');
    });

    it('cannot change the batch start timestamp to the past', async () => {
      await expect(
        waitlist.changeBatchStartTimestamp(1, CURRENT_TIMESTAMP - 10),
      ).to.be.revertedWith(
        'WaitlistBatch: batch start time cannot be in the past',
      );
    });

    it('can change the batch start timestamp as the owner', async () => {
      const newTime = CURRENT_TIMESTAMP + 21;
      await waitlist.changeBatchStartTimestamp(1, newTime);

      const updatedBatch = await waitlist.batchMapping(1);
      expect(updatedBatch.batchStartTimestamp).to.eq(newTime);
    });

    it('emits the BatchTimestampChanged event', async () => {
      const newTime = CURRENT_TIMESTAMP + 21;
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
      const unauthorizedWaitlist = MockWaitlistBatchFactory.connect(
        waitlist.address,
        userAccount,
      );

      await expect(
        unauthorizedWaitlist.changeBatchTotalSpots(0, batch.totalSpots.add(1)),
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

  describe('#enableClaims', () => {
    beforeEach(async () => {
      await waitlist.addNewBatch(
        batch.totalSpots,
        batch.startTimestamp,
        batch.depositAmount,
      );
    });

    it('cannot enable claims as a non-owner', async () => {
      const unauthorizedWaitlist = MockWaitlistBatchFactory.connect(
        waitlist.address,
        userAccount,
      );

      await expect(unauthorizedWaitlist.enableClaims([0])).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('cannot enable claims if claims have already been enabled', async () => {
      await waitlist.enableClaims([1]);

      await expect(waitlist.enableClaims([1])).to.be.revertedWith(
        'WaitlistBatch: batch has already claimable tokens',
      );
    });

    it('cannot enable claims for an inexisting batch', async () => {
      await expect(waitlist.enableClaims([0, 1])).to.be.revertedWith(
        'WaitlistBatch: the batch does not exist',
      );
    });

    it('can enable claims as the owner', async () => {
      let batch1 = await waitlist.batchMapping(1);
      expect(batch1.claimable).to.be.false;

      await waitlist.enableClaims([1]);

      batch1 = await waitlist.batchMapping(1);
      expect(batch1.claimable).to.be.true;

      // Add 2 more batches
      await waitlist.addNewBatch(
        batch.totalSpots,
        batch.startTimestamp,
        batch.depositAmount,
      );
      await waitlist.addNewBatch(
        batch.totalSpots,
        batch.startTimestamp,
        batch.depositAmount,
      );

      await waitlist.enableClaims([2, 3]);

      const batch2 = await waitlist.batchMapping(2);
      const batch3 = await waitlist.batchMapping(3);

      expect(batch2.claimable).to.be.true;
      expect(batch3.claimable).to.be.true;
    });

    it('emits the BatchClaimsEnabled event', async () => {
      await expect(waitlist.enableClaims([1]))
        .to.emit(waitlist, 'BatchClaimsEnabled')
        .withArgs([1]);
    });
  });

  describe('#setModerator', () => {
    it('reverts if called by a normie', async () => {
      const unauthorizedWaitlist = MockWaitlistBatchFactory.connect(
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

      expect(await moderatorWaitlist.blacklist(userAccount.address)).to.be.true;
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
      const unauthorizedWaitlist = MockWaitlistBatchFactory.connect(
        waitlist.address,
        userAccount,
      );

      await expect(
        unauthorizedWaitlist.removeFromBlacklist(userAccount.address),
      ).to.be.revertedWith('WaitlistBatch: caller is not moderator');
    });

    it('removes address to the blacklist', async () => {
      expect(await moderatorWaitlist.blacklist(userAccount.address)).to.be.true;

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

  describe('#transferTokens', () => {
    const tokensAmt = utils.parseEther('10');
    let otherToken: TestToken;

    before(async () => {
      otherToken = await new TestTokenFactory(ownerAccount).deploy(
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
      const unauthorizedWaitlist = MockWaitlistBatchFactory.connect(
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

    it('emits the TokensTransfered event', async () => {
      await expect(
        waitlist.transferTokens(
          otherToken.address,
          tokensAmt,
          ownerAccount.address,
        ),
      )
        .to.emit(waitlist, 'TokensTransfered')
        .withArgs(otherToken.address, tokensAmt, ownerAccount.address);
    });
  });

  describe('#reclaimTokens', () => {
    beforeEach(async () => {
      await waitlist.addNewBatch(
        batch.totalSpots,
        batch.startTimestamp,
        batch.depositAmount,
      );
    });

    it('cannot reclaim tokens if caller did not participate in a batch', async () => {
      await waitlist.enableClaims([1]);

      await expect(userWaitlist.reclaimTokens()).to.be.revertedWith(
        'WaitlistBatch: user did not participate in a batch',
      );
    });

    it('cannot reclaim tokens if the batch the user participated to does not have the tokens claimable', async () => {
      await waitlist.setCurrentTimestamp(batch.startTimestamp);
      await userWaitlist.applyToBatch(1);

      await expect(userWaitlist.reclaimTokens()).to.be.revertedWith(
        'WaitlistBatch: the tokens are not yet claimable',
      );
    });

    it('cannot reclaim tokens twice', async () => {
      await waitlist.enableClaims([1]);
      await waitlist.setCurrentTimestamp(batch.startTimestamp);
      await userWaitlist.applyToBatch(1);

      await userWaitlist.reclaimTokens();

      await expect(userWaitlist.reclaimTokens()).to.be.revertedWith(
        'WaitlistBatch: there are no tokens to reclaim',
      );
    });

    it('cannot reclaim if user is blacklisted', async () => {
      await waitlist.enableClaims([1]);
      await waitlist.setCurrentTimestamp(batch.startTimestamp);
      await userWaitlist.applyToBatch(1);

      await waitlist.setModerator(moderator.address);
      const moderatorWaitlist = waitlist.connect(moderator);
      await moderatorWaitlist.addToBlacklist(userAccount.address);

      await expect(userWaitlist.reclaimTokens()).to.be.revertedWith(
        'WaitlistBatch: user is blacklisted',
      );
    });

    it('reclaims the tokens to the user', async () => {
      await waitlist.enableClaims([1]);
      await waitlist.setCurrentTimestamp(batch.startTimestamp);
      await userWaitlist.applyToBatch(1);

      const preBalance = await depositToken.balanceOf(userAccount.address);
      await userWaitlist.reclaimTokens();
      const postBalance = await depositToken.balanceOf(userAccount.address);

      expect(postBalance).to.eq(preBalance.add(batch.depositAmount));
    });

    it('emits the TokensReclaimed event', async () => {
      await waitlist.enableClaims([1]);
      await waitlist.setCurrentTimestamp(batch.startTimestamp);
      await userWaitlist.applyToBatch(1);

      await expect(userWaitlist.reclaimTokens())
        .to.emit(userWaitlist, 'TokensReclaimed')
        .withArgs(userAccount.address, batch.depositAmount);
    });
  });

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

      // Set claimable and reclaim amount
      await waitlist.enableClaims([1]);
      await userWaitlist.reclaimTokens();

      batchInfo = await userWaitlist.getBatchInfoForUser(userAccount.address);
      expect(batchInfo.depositAmount).to.eq(0);
    });
  });
});
