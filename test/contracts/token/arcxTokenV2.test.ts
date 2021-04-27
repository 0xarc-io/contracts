import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ArcxToken, ArcxTokenFactory } from '@src/typings';
import { ArcxTokenV2 } from '@src/typings/ArcxTokenV2';
import { ArcxTokenV2Factory } from '@src/typings/ArcxTokenV2Factory';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber, constants, utils } from 'ethers';
import { ethers } from 'hardhat';

const TOKEN_AMOUNT = utils.parseEther('100');
const TOKEN_MULTIPLIER = BigNumber.from('10000');

describe('ArcxTokenV2', () => {
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  let oldArcx: ArcxToken;
  let arcx: ArcxTokenV2;

  before(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
    user = signers[1];

    oldArcx = await new ArcxTokenFactory(owner).deploy();
    arcx = await new ArcxTokenV2Factory(owner).deploy(oldArcx.address);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#constructor', () => {
    it('reverts if old token is address 0', async () => {
      await expect(
        new ArcxTokenV2Factory(owner).deploy(constants.AddressZero),
      ).to.be.revertedWith('ArcxTokenV2: old ARCX token cannot be address 0');
    });

    it('sets the address of the old arcx token', async () => {
      expect(await arcx.oldArcxToken()).to.eq(oldArcx.address);
    });
  });

  describe('#claim', () => {
    it('reverts if user did not approve token', async () => {
      // Mint old tokens
      await oldArcx.mint(user.address, TOKEN_AMOUNT);

      await expect(arcx.connect(user).claim()).to.be.revertedWith(
        'SafeERC20: TRANSFER_FROM_FAILED',
      );
    });

    it('reverts if user has a 0 balance of the old arcx token', async () => {
      let oldArcBalance = await oldArcx.balanceOf(user.address);
      let newArcBalance = await arcx.balanceOf(user.address);

      expect(oldArcBalance).to.eq(0);
      expect(newArcBalance).to.eq(0);

      await expect(arcx.connect(user).claim()).to.be.revertedWith(
        'ArcxTokenV2: user has 0 balance of old tokens',
      );

      oldArcBalance = await oldArcx.balanceOf(user.address);
      newArcBalance = await arcx.balanceOf(user.address);

      expect(oldArcBalance).to.eq(0);
      expect(newArcBalance).to.eq(0);
    });

    it('transfers the old tokens to the owner and mints the new tokens to the caller', async () => {
      // Mint old tokens
      await oldArcx.mint(user.address, TOKEN_AMOUNT);

      let oldArcBalance = await oldArcx.balanceOf(user.address);
      let newArcBalance = await arcx.balanceOf(user.address);
      let ownerOldBalance = await oldArcx.balanceOf(owner.address);

      expect(oldArcBalance).to.eq(TOKEN_AMOUNT);
      expect(newArcBalance).to.eq(0);
      expect(ownerOldBalance).to.eq(0);

      // Approve token
      await oldArcx.connect(user).approve(arcx.address, TOKEN_AMOUNT);

      await arcx.connect(user).claim();

      oldArcBalance = await oldArcx.balanceOf(user.address);
      newArcBalance = await arcx.balanceOf(user.address);
      ownerOldBalance = await oldArcx.balanceOf(owner.address);

      expect(oldArcBalance).to.eq(0);
      expect(newArcBalance).to.eq(TOKEN_AMOUNT.mul(TOKEN_MULTIPLIER));
      expect(ownerOldBalance).to.eq(TOKEN_AMOUNT);
    });

    it('emits the Claimed event', async () => {
      // Mint old tokens
      await oldArcx.mint(user.address, TOKEN_AMOUNT);

      const arcxContract = arcx.connect(user);

      // Approve token
      await oldArcx.connect(user).approve(arcx.address, TOKEN_AMOUNT);

      await expect(arcxContract.claim())
        .to.emit(arcxContract, 'Claimed')
        .withArgs(user.address, TOKEN_AMOUNT.mul(TOKEN_MULTIPLIER));
    });
  });

  describe('#mint', () => {
    it('reverts if called by non-owner', async () => {
      await expect(
        arcx.connect(user).mint(user.address, TOKEN_AMOUNT),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('mints tokens to user if called by owner', async () => {
      let balance = await arcx.balanceOf(user.address);
      expect(balance).to.eq(0);

      await arcx.mint(user.address, TOKEN_AMOUNT);

      balance = await arcx.balanceOf(user.address);
      expect(balance).to.eq(TOKEN_AMOUNT);
    });
  });

  describe('#burn', () => {
    it('reverts if called by non-owner', async () => {
      await expect(
        arcx.connect(user).burn(owner.address, TOKEN_AMOUNT),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('burns the amount of tokens if called by owner', async () => {
      await arcx.mint(user.address, TOKEN_AMOUNT);

      let balance = await arcx.balanceOf(user.address);
      expect(balance).to.eq(TOKEN_AMOUNT);

      await arcx.burn(user.address, TOKEN_AMOUNT);

      balance = await arcx.balanceOf(user.address);
      expect(balance).to.eq(0);
    });
  });
});
