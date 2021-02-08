import 'module-alias/register';

import { BigNumber } from 'ethers';
import { expect } from 'chai';

import { expectRevert } from '@test/helpers/expectRevert';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { WhitelistSale } from '@src/typings/WhitelistSale';
import { TestToken, TestTokenFactory, WhitelistSaleFactory } from '@src/typings';
import { deployTestToken } from '../deployers';
import ArcNumber from '@src/utils/ArcNumber';

let signers: SignerWithAddress[];
let ownerAccount: SignerWithAddress;
let userAccount: SignerWithAddress;

describe('WhitelistSale', () => {
  let whitelistSale: WhitelistSale;
  let currency: TestToken;

  function setAllocation(user: SignerWithAddress, allocation: BigNumber) {
    return whitelistSale.setAllocation([user.address], [allocation]);
  }

  before(async () => {
    signers = await ethers.getSigners();
    ownerAccount = signers[0];
    userAccount = signers[1];
  });

  beforeEach(async () => {
    currency = await deployTestToken(ownerAccount, 'TestToken', 'TESTx');
    whitelistSale = await new WhitelistSaleFactory(ownerAccount).deploy(currency.address);

    // Give some test tokens to the user account
    const mintAmount = ArcNumber.new(10);
    await currency.mintShare(userAccount.address, mintAmount);
    const userTokenContract = TestTokenFactory.connect(currency.address, userAccount);
    await userTokenContract.approve(whitelistSale.address, mintAmount);
  });

  describe('#setAllocation', () => {
    it('should not be able to set the allocation as a non-owner', async () => {
      const userWhiteSaleContract = WhitelistSaleFactory.connect(
        whitelistSale.address,
        userAccount,
      );

      await expectRevert(
        userWhiteSaleContract.setAllocation(
          [signers[1].address, signers[2].address],
          [ArcNumber.new(10), ArcNumber.new(20)],
        ),
      );
    });

    it('should not be able to set allocations if the users and allocations arrays have a different length', async () => {
      await expectRevert(
        whitelistSale.setAllocation([signers[1].address, signers[2].address], [ArcNumber.new(10)]),
      );
    });

    it('should be able to set the allocation correctly', async () => {
      const signer1Allocation = ArcNumber.new(10);
      const signer2Allocation = ArcNumber.new(20);

      await whitelistSale.setAllocation(
        [signers[1].address, signers[2].address],
        [signer1Allocation, signer2Allocation],
      );

      const participant1 = await whitelistSale.getParticipant(signers[1].address);
      const participant2 = await whitelistSale.getParticipant(signers[2].address);

      expect(participant1.allocation).to.be.eq(signer1Allocation);
      expect(participant1.spent).to.be.eq(BigNumber.from(0));
      expect(participant2.allocation).to.be.eq(signer2Allocation);
      expect(participant2.spent).to.be.eq(BigNumber.from(0));
    });

    it('should be able to remove an allocation successfully', async () => {
      // Add two allocations
      const signer1Allocation = ArcNumber.new(10);
      const signer2Allocation = ArcNumber.new(20);

      await whitelistSale.setAllocation(
        [signers[1].address, signers[2].address],
        [signer1Allocation, signer2Allocation],
      );

      const participant2 = await whitelistSale.getParticipant(signers[2].address);

      // Remove allocation of user 1
      await whitelistSale.setAllocation([signers[1].address], [BigNumber.from(0)]);

      const participant1New = await whitelistSale.getParticipant(signers[1].address);
      const participant2New = await whitelistSale.getParticipant(signers[2].address);

      expect(participant1New.allocation).to.eq(BigNumber.from(0));
      expect(participant2.allocation).to.eq(participant2New.allocation);
    });
  });

  describe('#claimAllocation', () => {
    it('should not be able to claim if the sale has not started', async () => {
      await setAllocation(userAccount, ArcNumber.new(10));

      const userWhiteSaleContract = WhitelistSaleFactory.connect(
        whitelistSale.address,
        userAccount,
      );

      await expectRevert(userWhiteSaleContract.claimAllocation(ArcNumber.new(5)));
    });

    it('should not be able to cliam more than the allocation', async () => {
      await setAllocation(userAccount, ArcNumber.new(5));

      const userWhiteSaleContract = WhitelistSaleFactory.connect(
        whitelistSale.address,
        userAccount,
      );

      await expectRevert(userWhiteSaleContract.claimAllocation(ArcNumber.new(6)));
    });

    it('should not be able to claim more than the allocation if amountToClaim + amountSpent > allocation', async () => {
      await whitelistSale.updateSaleStatus(true);
      await setAllocation(userAccount, ArcNumber.new(5));

      const userWhiteSaleContract = WhitelistSaleFactory.connect(
        whitelistSale.address,
        userAccount,
      );

      await userWhiteSaleContract.claimAllocation(ArcNumber.new(3));

      await expectRevert(userWhiteSaleContract.claimAllocation(ArcNumber.new(3)));
    });

    it('should be able to spend up to the allocation', async () => {
      await whitelistSale.updateSaleStatus(true);
      await setAllocation(userAccount, ArcNumber.new(5));

      const userWhiteSaleContract = WhitelistSaleFactory.connect(
        whitelistSale.address,
        userAccount,
      );

      await userWhiteSaleContract.claimAllocation(ArcNumber.new(5));

      const participantInfo = await userWhiteSaleContract.participants(userAccount.address);

      expect(participantInfo.spent).to.eq(ArcNumber.new(5));
    });

    it('should be able to spend more if the allocation increases', async () => {
      await whitelistSale.updateSaleStatus(true);
      await setAllocation(userAccount, ArcNumber.new(5));

      const userWhiteSaleContract = WhitelistSaleFactory.connect(
        whitelistSale.address,
        userAccount,
      );

      await userWhiteSaleContract.claimAllocation(ArcNumber.new(5));

      await setAllocation(userAccount, ArcNumber.new(6));

      await userWhiteSaleContract.claimAllocation(ArcNumber.new(1));

      const participantInfo = await userWhiteSaleContract.participants(userAccount.address);

      expect(participantInfo.spent).to.eq(ArcNumber.new(6));
    });

    it.only('should transfer the funds from user to owner', async () => {
      await whitelistSale.updateSaleStatus(true);
      await setAllocation(userAccount, ArcNumber.new(5));

      const userWhiteSaleContract = WhitelistSaleFactory.connect(
        whitelistSale.address,
        userAccount,
      );

      await userWhiteSaleContract.claimAllocation(ArcNumber.new(5));

      expect(await currency.balanceOf(ownerAccount.address)).to.eq(ArcNumber.new(5));
    });
  });

  describe('#updateSaleStatus', () => {
    it('should not be able to update the sale status as a non-owner', async () => {
      const userContract = WhitelistSaleFactory.connect(whitelistSale.address, userAccount);
      await expectRevert(userContract.updateSaleStatus(true));
    });

    it('should update the sale status as an owner', async () => {
      await whitelistSale.updateSaleStatus(true);

      let status = await whitelistSale.saleOpen();

      expect(status).to.be.true;

      await whitelistSale.updateSaleStatus(false);
      status = await whitelistSale.saleOpen();

      expect(status).to.be.false;
    });
  });
});
