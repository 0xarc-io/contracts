import 'module-alias/register';

import { BigNumber } from 'ethers';
import chai from 'chai';

import { expectRevert } from '@test/helpers/expectRevert';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { TestToken, TestTokenFactory, WhitelistSaleFactory } from '@src/typings';
import { deployTestToken } from '../deployers';
import ArcNumber from '@src/utils/ArcNumber';
import { solidity } from 'ethereum-waffle';

chai.use(solidity);
const expect = chai.expect;

let signers: SignerWithAddress[];
let ownerAccount: SignerWithAddress;
let userAccount: SignerWithAddress;

describe('WhitelistSale', () => {
  let whitelistSaleAddress: string;
  let currency: TestToken;

  function connectAs(signer: SignerWithAddress) {
    return WhitelistSaleFactory.connect(whitelistSaleAddress, signer);
  }

  function setAllocation(user: SignerWithAddress, allocation: BigNumber) {
    return connectAs(ownerAccount).setAllocation([user.address], [allocation]);
  }

  before(async () => {
    signers = await ethers.getSigners();
    ownerAccount = signers[0];
    userAccount = signers[1];
  });

  beforeEach(async () => {
    currency = await deployTestToken(ownerAccount, 'TestToken', 'TESTx');

    const whitelistSale = await new WhitelistSaleFactory(ownerAccount).deploy(currency.address);

    // Give some test tokens to the user account
    const mintAmount = ArcNumber.new(10);
    await currency.mintShare(userAccount.address, mintAmount);
    const userTokenContract = TestTokenFactory.connect(currency.address, userAccount);
    await userTokenContract.approve(whitelistSale.address, mintAmount);

    whitelistSaleAddress = whitelistSale.address;
  });

  describe('#setHardCap', () => {
    it('should not be able to set the hard cap as a non-owner', async () => {
      const contract = await connectAs(userAccount);
      expect(await contract.totalHardCap()).to.equal(ArcNumber.new(0));
      await expectRevert(contract.setHardCap(5));
    });

    it('should be able to set the hard cap as the owner', async () => {
      const contract = await connectAs(ownerAccount);
      expect(await contract.totalHardCap()).to.equal(ArcNumber.new(0));

      const HARD_CAP = ArcNumber.new(50);
      await contract.setHardCap(HARD_CAP);
      expect(await contract.totalHardCap()).to.equal(HARD_CAP);
    });
  });

  describe('#setAllocation', () => {
    it('should not be able to set the allocation as a non-owner', async () => {
      const userWhiteSaleContract = connectAs(userAccount);

      await expectRevert(
        userWhiteSaleContract.setAllocation(
          [signers[1].address, signers[2].address],
          [ArcNumber.new(10), ArcNumber.new(20)],
        ),
      );
    });

    it('should not be able to set allocations if the users and allocations arrays have a different length', async () => {
      const whitelistSale = connectAs(ownerAccount);
      await expectRevert(
        whitelistSale.setAllocation([signers[1].address, signers[2].address], [ArcNumber.new(10)]),
      );
    });

    it('should be able to set the allocation correctly', async () => {
      const whitelistSale = connectAs(ownerAccount);
      const signer1Allocation = ArcNumber.new(10);
      const signer2Allocation = ArcNumber.new(20);

      await whitelistSale.setAllocation(
        [signers[1].address, signers[2].address],
        [signer1Allocation, signer2Allocation],
      );

      const participant1 = await whitelistSale.participants(signers[1].address);
      const participant2 = await whitelistSale.participants(signers[2].address);

      expect(participant1.allocation).to.be.eq(signer1Allocation);
      expect(participant1.spent).to.be.eq(BigNumber.from(0));
      expect(participant2.allocation).to.be.eq(signer2Allocation);
      expect(participant2.spent).to.be.eq(BigNumber.from(0));
    });

    it('should be able to remove an allocation successfully', async () => {
      // Add two allocations
      const whitelistSale = connectAs(ownerAccount);

      const signer1Allocation = ArcNumber.new(10);
      const signer2Allocation = ArcNumber.new(20);

      await whitelistSale.setAllocation(
        [signers[1].address, signers[2].address],
        [signer1Allocation, signer2Allocation],
      );

      const participant2 = await whitelistSale.participants(signers[2].address);

      // Remove allocation of user 1
      await whitelistSale.setAllocation([signers[1].address], [BigNumber.from(0)]);

      const participant1New = await whitelistSale.participants(signers[1].address);
      const participant2New = await whitelistSale.participants(signers[2].address);

      expect(participant1New.allocation).to.eq(BigNumber.from(0));
      expect(participant2.allocation).to.eq(participant2New.allocation);
    });
  });

  describe('#claimAllocation', () => {
    it('should not be able to claim if the sale has not started', async () => {
      await setAllocation(userAccount, ArcNumber.new(10));

      const whitelistSale = connectAs(userAccount);
      await expectRevert(whitelistSale.claimAllocation(ArcNumber.new(5)));
    });

    it('should not be able to cliam more than the allocation', async () => {
      await setAllocation(userAccount, ArcNumber.new(5));

      const ownerWhitelistSale = connectAs(ownerAccount);
      await ownerWhitelistSale.updateSaleStatus(true);
      await ownerWhitelistSale.setHardCap(ArcNumber.new(10));

      const userWhiteSaleContract = connectAs(userAccount);
      await expectRevert(userWhiteSaleContract.claimAllocation(ArcNumber.new(6)));
    });

    it('should not be able to claim the allocation if the hardcap is met', async () => {
      await setAllocation(userAccount, ArcNumber.new(10));

      const ownerWhitelistSale = connectAs(ownerAccount);
      await ownerWhitelistSale.updateSaleStatus(true);
      await ownerWhitelistSale.setHardCap(ArcNumber.new(7));

      const userWhiteSaleContract = connectAs(userAccount);
      await userWhiteSaleContract.claimAllocation(ArcNumber.new(5));
      await userWhiteSaleContract.claimAllocation(ArcNumber.new(2));

      expect(await userWhiteSaleContract.totalRaised()).to.equal(ArcNumber.new(7));
      await expectRevert(userWhiteSaleContract.claimAllocation(ArcNumber.new(1)));
    });

    it('should not be able to claim more than the allocation if amountToClaim + amountSpent > allocation', async () => {
      const ownerWhitelistSale = connectAs(ownerAccount);
      await ownerWhitelistSale.updateSaleStatus(true);
      await ownerWhitelistSale.setHardCap(ArcNumber.new(10));

      await setAllocation(userAccount, ArcNumber.new(5));

      const userWhiteSaleContract = connectAs(userAccount);
      await userWhiteSaleContract.claimAllocation(ArcNumber.new(3));

      await expectRevert(userWhiteSaleContract.claimAllocation(ArcNumber.new(3)));
    });

    it('should be able to spend up to the allocation', async () => {
      const ownerWhitelistSale = connectAs(ownerAccount);
      await ownerWhitelistSale.updateSaleStatus(true);
      await ownerWhitelistSale.setHardCap(ArcNumber.new(10));

      await setAllocation(userAccount, ArcNumber.new(5));

      const userWhiteSaleContract = connectAs(userAccount);
      await userWhiteSaleContract.claimAllocation(ArcNumber.new(5));

      const participantInfo = await userWhiteSaleContract.participants(userAccount.address);

      expect(participantInfo.spent).to.eq(ArcNumber.new(5));
    });

    it('should be able to spend more if the allocation increases', async () => {
      const ownerWhitelistSale = connectAs(ownerAccount);
      await ownerWhitelistSale.updateSaleStatus(true);
      await ownerWhitelistSale.setHardCap(ArcNumber.new(10));

      await setAllocation(userAccount, ArcNumber.new(5));

      const userWhiteSaleContract = connectAs(userAccount);

      await userWhiteSaleContract.claimAllocation(ArcNumber.new(5));
      await setAllocation(userAccount, ArcNumber.new(6));
      await userWhiteSaleContract.claimAllocation(ArcNumber.new(1));

      const participantInfo = await userWhiteSaleContract.participants(userAccount.address);
      expect(participantInfo.spent).to.eq(ArcNumber.new(6));
    });

    it('should transfer the funds from user to owner', async () => {
      const claimAmount = ArcNumber.new(5);
      const ownerWhitelistSale = connectAs(ownerAccount);
      await ownerWhitelistSale.updateSaleStatus(true);
      await ownerWhitelistSale.setHardCap(claimAmount);

      await setAllocation(userAccount, claimAmount);

      const userWhiteSaleContract = connectAs(userAccount);

      await expect(() => userWhiteSaleContract.claimAllocation(claimAmount)).to.changeTokenBalance(
        currency,
        ownerAccount,
        claimAmount,
      );
    });
  });

  describe('#updateSaleStatus', () => {
    it('should not be able to update the sale status as a non-owner', async () => {
      const whitelistSale = connectAs(userAccount);
      const userContract = WhitelistSaleFactory.connect(whitelistSale.address, userAccount);
      await expectRevert(userContract.updateSaleStatus(true));
    });

    it('should update the sale status as an owner', async () => {
      const whitelistSale = connectAs(ownerAccount);
      await whitelistSale.updateSaleStatus(true);

      let status = await whitelistSale.saleOpen();

      expect(status).to.be.true;

      await whitelistSale.updateSaleStatus(false);
      status = await whitelistSale.saleOpen();

      expect(status).to.be.false;
    });
  });
});
