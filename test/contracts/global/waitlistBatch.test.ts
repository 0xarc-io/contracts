import 'module-alias/register';

import { BigNumber } from 'ethers';
import chai from 'chai';

import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { solidity } from 'ethereum-waffle';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';
import { WaitlistBatch } from '@src/typings/WaitlistBatch';
import { WaitlistBatchFactory } from '@src/typings/WaitlistBatchFactory';

chai.use(solidity);
const expect = chai.expect;

describe('WhitelistBatch', () => {
  let ownerAccount: SignerWithAddress;
  let userAccount: SignerWithAddress;
  let waitlist: WaitlistBatch;

  before(async () => {
    const signers = await ethers.getSigners();
    ownerAccount = signers[0];
    userAccount = signers[1];

    waitlist = await new WaitlistBatchFactory(ownerAccount).deploy();
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#constructor', () => {
    it('sets the deposit currency');
  });

  describe('#applyToBatch', () => {
    xit('cannot apply to a non-existent batch');

    xit('cannot apply to a filled up batch');

    xit('cannot apply without having enough currency');

    xit('cannot apply before the start time');

    xit('can apply to a valid batch');

    xit('cannot apply if already applied to a previous batch');
  });

  describe('#startNewBatch', () => {
    xit('cannot start a batch with the start date before now');

    xit('cannot start a batch with the deposit amount as 0');

    xit('cannot start a batch with 0 spots');

    xit('cannot start a batch as a non-owner');

    xit('can start a valid new batch as the owner');
  });

  describe('#changeBatchStartTimestamp', () => {
    xit('cannot change the batch start timestamp as a non-owner');

    xit('cannot change the batch start timestamp for a non-existent batch');

    xit('cannot change the batch start timestamp to the past');

    xit('can change the batch start timestamp as the owner');
  });

  describe('#changeBatchTotalSpots', () => {
    xit('cannot change the total spots as a non-owner');

    xit('cannot change the total spots past the start date');

    xit('cannot change the total spots to less than the existing fill amount');

    xit('can change the total spots as the owner');
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
