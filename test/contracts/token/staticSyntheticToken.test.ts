import 'module-alias/register';

import { expect } from 'chai';

import { expectRevert } from '@test/helpers/expectRevert';
import { StaticSyntheticToken } from '@src/typings/StaticSyntheticToken';
import { deployStaticSynthetic } from '../deployers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { StaticSyntheticTokenFactory } from '@src/typings/StaticSyntheticTokenFactory';
import { ethers } from 'hardhat';

let ownerAccount: SignerWithAddress;
let arcAccount: SignerWithAddress;
let arcAccount1: SignerWithAddress;
let arcAccount2: SignerWithAddress;
let userAccount: SignerWithAddress;
let otherAccount: SignerWithAddress;

let syntheticToken: StaticSyntheticToken;

async function getContract(caller: SignerWithAddress) {
  return new StaticSyntheticTokenFactory(caller).attach(syntheticToken.address);
}

describe('StaticSyntheticToken', () => {
  beforeEach(async () => {
    const signers = await ethers.getSigners();
    ownerAccount = signers[0];
    arcAccount = signers[1];
    userAccount = signers[2];
    otherAccount = signers[3];
    arcAccount1 = signers[4];
    arcAccount2 = signers[5];
  });

  beforeEach(async () => {
    syntheticToken = await deployStaticSynthetic(ownerAccount);
    syntheticToken = await new StaticSyntheticTokenFactory(arcAccount).attach(
      syntheticToken.address,
    );
  });

  describe('#mint', () => {
    beforeEach(async () => {
      const contract = await getContract(ownerAccount);
      await contract.addMinter(arcAccount.address);
    });

    it('should not be able to mint as an unauthorised user', async () => {
      const contract = await getContract(otherAccount);
      await expectRevert(contract.mint(otherAccount.address, 10));
    });

    it('should be able to mint as arc', async () => {
      const contract = await getContract(arcAccount);
      await contract.mint(arcAccount.address, 10);
      expect(await (await syntheticToken.balanceOf(arcAccount.address)).toNumber()).to.equal(10);
    });
  });

  describe('#addMinter', () => {
    it('should not be able to add a minter as an unauthorised user', async () => {
      const contract = await getContract(otherAccount);
      await expectRevert(contract.addMinter(otherAccount.address));
    });

    it('should be able to add a minter as the owner', async () => {
      const contract = await getContract(ownerAccount);
      await contract.addMinter(arcAccount.address);

      expect(await (await contract.getAllMinters()).length).to.equal(1);
      expect(await contract.mintersArray(0)).to.equal(arcAccount.address);
      expect(await contract.minters(arcAccount.address)).to.be.true;

      await contract.addMinter(arcAccount1.address);
      expect(await (await contract.getAllMinters()).length).to.equal(2);
      expect(await contract.mintersArray(0)).to.equal(arcAccount.address);
      expect(await contract.mintersArray(1)).to.equal(arcAccount1.address);
      expect(await contract.minters(arcAccount.address)).to.be.true;
      expect(await contract.minters(arcAccount1.address)).to.be.true;

      await contract.addMinter(arcAccount2.address);
      expect(await (await contract.getAllMinters()).length).to.equal(3);
      expect(await contract.mintersArray(0)).to.equal(arcAccount.address);
      expect(await contract.mintersArray(1)).to.equal(arcAccount1.address);
      expect(await contract.mintersArray(2)).to.equal(arcAccount2.address);
      expect(await contract.minters(arcAccount.address)).to.be.true;
      expect(await contract.minters(arcAccount1.address)).to.be.true;
      expect(await contract.minters(arcAccount2.address)).to.be.true;

      await contract.removeMinter(arcAccount1.address);
      expect(await (await contract.getAllMinters()).length).to.equal(2);
      expect(await contract.mintersArray(0)).to.equal(arcAccount.address);
      expect(await contract.mintersArray(1)).to.equal(arcAccount2.address);
      expect(await contract.minters(arcAccount.address)).to.be.true;
      expect(await contract.minters(arcAccount1.address)).to.be.false;
      expect(await contract.minters(arcAccount2.address)).to.be.true;

      await contract.removeMinter(arcAccount.address);
      expect(await (await contract.getAllMinters()).length).to.equal(1);
      expect(await contract.mintersArray(0)).to.equal(arcAccount2.address);
      expect(await contract.minters(arcAccount.address)).to.be.false;
      expect(await contract.minters(arcAccount1.address)).to.be.false;
      expect(await contract.minters(arcAccount2.address)).to.be.true;
    });

    it('should not be able to add a minter as another minter', async () => {
      const ownerContract = await getContract(ownerAccount);
      await ownerContract.addMinter(arcAccount.address);

      const arcContract = await getContract(arcAccount);
      await expectRevert(arcContract.addMinter(otherAccount.address));
    });

    it('should not be able to re-add a minter as the owner', async () => {
      const contract = await getContract(ownerAccount);
      await contract.addMinter(arcAccount.address);
      await expectRevert(contract.addMinter(arcAccount.address));
    });
  });

  describe('#removeMinter', () => {
    beforeEach(async () => {
      const contract = await getContract(ownerAccount);
      await contract.addMinter(arcAccount.address);
    });

    it('should not be able to remove a minter as an unauthorised user', async () => {
      const contract = await getContract(otherAccount);
      await expectRevert(contract.removeMinter(otherAccount.address));
    });

    it('should be able to remove a minter as the owner', async () => {
      const contract = await getContract(ownerAccount);
      await contract.removeMinter(arcAccount.address);

      expect(await (await contract.getAllMinters()).length).to.equal(0);
      expect(await contract.minters(arcAccount.address)).to.be.false;
    });

    it('should not be able to remove a minter as another minter', async () => {
      const arcContract = await getContract(arcAccount);
      await expectRevert(arcContract.removeMinter(otherAccount.address));
    });

    it('should not be able to remove a non-existent minter as the owner', async () => {
      const contract = await getContract(ownerAccount);
      await contract.removeMinter(arcAccount.address);
      await expectRevert(contract.removeMinter(arcAccount.address));
    });
  });

  describe('#burn', () => {
    beforeEach(async () => {
      const contract = await getContract(ownerAccount);
      await contract.addMinter(arcAccount.address);
      await syntheticToken.mint(userAccount.address, 10);
    });

    it('should not be able to burn as an unauthorised user', async () => {
      const contract = await getContract(otherAccount);
      await expectRevert(contract.burn(userAccount.address, 10));
    });

    it('should be able to burn as arc', async () => {
      expect(await (await syntheticToken.balanceOf(userAccount.address)).toNumber()).to.equal(10);
      const contract = await getContract(arcAccount);
      await contract.burn(userAccount.address, 10);
      expect(await (await syntheticToken.balanceOf(userAccount.address)).toNumber()).to.equal(0);
    });
  });

  describe('#transferCollateral', () => {
    beforeEach(async () => {
      const contract = await getContract(ownerAccount);
      await contract.addMinter(arcAccount.address);
      await syntheticToken.mint(syntheticToken.address, 10);
    });

    it('should not be able to transfer collateral as an unauthorised user', async () => {
      const contract = await getContract(otherAccount);
      await expectRevert(
        contract.transferCollateral(syntheticToken.address, userAccount.address, 10),
      );
    });

    it('should be able to transfer collateral as arc', async () => {
      const contract = await getContract(arcAccount);
      await contract.transferCollateral(syntheticToken.address, userAccount.address, 10);
      expect(await (await syntheticToken.balanceOf(userAccount.address)).toNumber()).to.equal(10);
    });
  });
});
