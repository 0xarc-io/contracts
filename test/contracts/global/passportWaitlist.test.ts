import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { approve } from '@src/utils';
import { TestToken, TestTokenFactory } from '@src/typings';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { MockPassportWaitlist } from '@src/typings/MockPassportWaitlist';
import { MockPassportWaitlistFactory } from '@src/typings/MockPassportWaitlistFactory';
import { utils } from 'ethers';

const PAYMENT_AMOUNT = utils.parseEther('50');

describe('PassportWaitlist', () => {
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  let waitlist: MockPassportWaitlist;
  let userWaitlist: MockPassportWaitlist;

  let paymentToken: TestToken;

  before(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
    user = signers[1];

    paymentToken = await new TestTokenFactory(owner).deploy('TEST', 'TEST', 18);

    waitlist = await new MockPassportWaitlistFactory(owner).deploy(
      paymentToken.address,
      PAYMENT_AMOUNT,
      owner.address,
    );
    userWaitlist = waitlist.connect(user);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#constructor', () => {
    it('sets the payment token and amount', async () => {
      expect(await waitlist.paymentToken()).to.eq(paymentToken.address);
      expect(await waitlist.paymentAmount()).to.eq(PAYMENT_AMOUNT);
      expect(await waitlist.paymentReceiver()).to.eq(owner.address);
    });
  });

  describe('#applyForPassport', () => {
    it('reverts if user does not have enough tokens to pay', async () => {
      await paymentToken.mintShare(user.address, PAYMENT_AMOUNT.sub(1));

      await approve(
        PAYMENT_AMOUNT,
        paymentToken.address,
        waitlist.address,
        user,
      );

      await expect(userWaitlist.applyForPassport()).to.be.revertedWith(
        'SafeERC20: TRANSFER_FROM_FAILED',
      );
    });

    it('reverts if user had not approved enough tokens', async () => {
      await paymentToken.mintShare(user.address, PAYMENT_AMOUNT);

      await approve(
        PAYMENT_AMOUNT.sub(1),
        paymentToken.address,
        waitlist.address,
        user,
      );

      await expect(userWaitlist.applyForPassport()).to.be.revertedWith(
        'SafeERC20: TRANSFER_FROM_FAILED',
      );
    });

    it('applies for the passport', async () => {
      await paymentToken.mintShare(user.address, PAYMENT_AMOUNT);
      await approve(
        PAYMENT_AMOUNT,
        paymentToken.address,
        waitlist.address,
        user,
      );

      const timestamp = 10;
      await waitlist.setCurrentTimestamp(timestamp);

      // emit UserApplied event with user, currency, amount and timestamp
      await expect(userWaitlist.applyForPassport())
        .to.emit(userWaitlist, 'UserApplied')
        .withArgs(
          user.address,
          paymentToken.address,
          PAYMENT_AMOUNT,
          timestamp,
        );
    });

    it('transferred the payment to the receiver', async () => {
      expect(await paymentToken.balanceOf(owner.address)).to.eq(0);

      await paymentToken.mintShare(user.address, PAYMENT_AMOUNT);
      await approve(
        PAYMENT_AMOUNT,
        paymentToken.address,
        waitlist.address,
        user,
      );

      await userWaitlist.applyForPassport();

      expect(await paymentToken.balanceOf(owner.address)).to.eq(PAYMENT_AMOUNT);
    });
  });

  describe('#setPayment', () => {
    let newTokenAddy: string;
    const newAmount = PAYMENT_AMOUNT.div(2);

    beforeEach(async () => {
      const newToken = await new TestTokenFactory(user).deploy(
        'TEST1',
        'TEST1',
        18,
      );
      newTokenAddy = newToken.address;
    });

    it('reverts if called by non-owner', async () => {
      await expect(
        userWaitlist.setPayment(newTokenAddy, newAmount, user.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('sets the payment token, amount and receiver', async () => {
      expect(await waitlist.paymentToken()).to.eq(paymentToken.address);
      expect(await waitlist.paymentAmount()).to.eq(PAYMENT_AMOUNT);
      expect(await waitlist.paymentReceiver()).to.eq(owner.address);

      await waitlist.setPayment(newTokenAddy, newAmount, user.address);

      expect(await waitlist.paymentToken()).to.eq(newTokenAddy);
      expect(await waitlist.paymentAmount()).to.eq(newAmount);
      expect(await waitlist.paymentReceiver()).to.eq(user.address);
    });
  });
});
