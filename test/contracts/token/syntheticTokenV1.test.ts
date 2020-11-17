import 'module-alias/register';

import simpleDescribe from '@test/helpers/simpleDescribe';
import { ITestContext } from '@test/helpers/simpleDescribe';
import { expectRevert } from '@test/helpers/expectRevert';
import {
  Account,
  addSnapshotBeforeRestoreAfterEach,
  getWaffleExpect,
} from '../../helpers/testingUtils';

import { BigNumber } from 'ethers/utils';
import { SyntheticTokenV1 } from '@src/typings/SyntheticTokenV1';
import { ArcProxy } from '@src/typings';

let ownerAccount: Account;
let arcAccount: Account;
let arcAccount1: Account;
let arcAccount2: Account;
let userAccount: Account;
let otherAccount: Account;

const expect = getWaffleExpect();

let syntheticToken: SyntheticTokenV1;

async function init(ctx: ITestContext): Promise<void> {
  ownerAccount = ctx.accounts[0];
  arcAccount = ctx.accounts[1];
  userAccount = ctx.accounts[2];
  otherAccount = ctx.accounts[3];
  arcAccount1 = ctx.accounts[4];
  arcAccount2 = ctx.accounts[5];
}

async function getContract(caller: Account) {
  return SyntheticTokenV1.at(caller.signer, syntheticToken.address);
}

simpleDescribe('SyntheticTokenV1', init, (ctx: ITestContext) => {
  beforeEach(async () => {
    syntheticToken = await SyntheticTokenV1.deploy(ownerAccount.signer);
    const proxy = await ArcProxy.deploy(
      ownerAccount.signer,
      syntheticToken.address,
      ownerAccount.address,
      [],
    );
    syntheticToken = await SyntheticTokenV1.at(ownerAccount.signer, proxy.address);
    await syntheticToken.init('ARCx', 'ARCx', 1);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#mint', () => {
    beforeEach(async () => {
      const contract = await getContract(ownerAccount);
      await contract.addMinter(arcAccount.address, 10);
      expect(await contract.getMinterLimit(arcAccount.address)).to.equal(new BigNumber(10));
    });

    it('should not be able to mint as an unauthorised user', async () => {
      const contract = await getContract(otherAccount);
      await expect(contract.mint(otherAccount.address, 10)).to.be.reverted;
    });

    it('should be able to mint as arc', async () => {
      const contract = await getContract(arcAccount);
      await contract.mint(arcAccount.address, 9);
      expect(await (await syntheticToken.balanceOf(arcAccount.address)).toNumber()).to.equal(9);
    });

    it('should be able to mint to the limit', async () => {
      const contract = await getContract(arcAccount);
      await contract.mint(arcAccount.address, 10);
      expect(await (await syntheticToken.balanceOf(arcAccount.address)).toNumber()).to.equal(10);
      const issuance = await syntheticToken.getMinterIssued(arcAccount.address);
      expect(issuance.value).to.equal(new BigNumber(10));
      expect(issuance.sign).to.be.true;
      await expect(contract.mint(arcAccount.address, 10)).to.be.reverted;
    });

    it('should not be able to mint over the limit', async () => {
      const contract = await getContract(arcAccount);
      await expect(contract.mint(arcAccount.address, 11)).to.be.reverted;
    });
  });

  describe('#addMinter', () => {
    it('should not be able to add a minter as an unauthorised user', async () => {
      const contract = await getContract(otherAccount);
      await expect(contract.addMinter(otherAccount.address, 100)).to.be.reverted;
    });

    it('should be able to add a minter as the owner', async () => {
      const contract = await getContract(ownerAccount);
      await contract.addMinter(arcAccount.address, 100);

      let minters = await contract.getAllMinters();
      expect(minters.length).to.equal(1);
      expect(minters[0]).to.equal(arcAccount.address);
      expect(await contract.isValidMinter(arcAccount.address)).to.be.true;
      expect(await contract.getMinterLimit(arcAccount.address)).to.equal(100);

      await contract.addMinter(arcAccount1.address, 100);
      minters = await contract.getAllMinters();
      expect(minters.length).to.equal(2);
      expect(minters[0]).to.equal(arcAccount.address);
      expect(minters[1]).to.equal(arcAccount1.address);
      expect(await contract.isValidMinter(arcAccount.address)).to.be.true;
      expect(await contract.isValidMinter(arcAccount1.address)).to.be.true;
      expect(await contract.getMinterLimit(arcAccount.address)).to.equal(100);
      expect(await contract.getMinterLimit(arcAccount1.address)).to.equal(100);

      await contract.addMinter(arcAccount2.address, 100);
      minters = await contract.getAllMinters();
      expect(minters.length).to.equal(3);
      expect(minters[0]).to.equal(arcAccount.address);
      expect(minters[1]).to.equal(arcAccount1.address);
      expect(minters[2]).to.equal(arcAccount2.address);
      expect(await contract.isValidMinter(arcAccount.address)).to.be.true;
      expect(await contract.isValidMinter(arcAccount1.address)).to.be.true;
      expect(await contract.isValidMinter(arcAccount2.address)).to.be.true;
      expect(await contract.getMinterLimit(arcAccount.address)).to.equal(100);
      expect(await contract.getMinterLimit(arcAccount1.address)).to.equal(100);
      expect(await contract.getMinterLimit(arcAccount2.address)).to.equal(100);

      await contract.removeMinter(arcAccount1.address);
      minters = await contract.getAllMinters();
      expect(minters.length).to.equal(2);
      expect(minters[0]).to.equal(arcAccount.address);
      expect(minters[1]).to.equal(arcAccount2.address);
      expect(await contract.isValidMinter(arcAccount.address)).to.be.true;
      expect(await contract.isValidMinter(arcAccount1.address)).to.be.false;
      expect(await contract.isValidMinter(arcAccount2.address)).to.be.true;
      expect(await contract.getMinterLimit(arcAccount.address)).to.equal(100);
      expect(await contract.getMinterLimit(arcAccount1.address)).to.equal(0);
      expect(await contract.getMinterLimit(arcAccount2.address)).to.equal(100);

      await contract.removeMinter(arcAccount.address);
      minters = await contract.getAllMinters();
      expect(minters.length).to.equal(1);
      expect(minters[0]).to.equal(arcAccount2.address);
      expect(await contract.isValidMinter(arcAccount.address)).to.be.false;
      expect(await contract.isValidMinter(arcAccount1.address)).to.be.false;
      expect(await contract.isValidMinter(arcAccount2.address)).to.be.true;
      expect(await contract.getMinterLimit(arcAccount.address)).to.equal(0);
      expect(await contract.getMinterLimit(arcAccount1.address)).to.equal(0);
      expect(await contract.getMinterLimit(arcAccount2.address)).to.equal(100);
    });

    it('should not be able to add a minter as another minter', async () => {
      const ownerContract = await getContract(ownerAccount);
      await ownerContract.addMinter(arcAccount.address, 100);

      const arcContract = await getContract(arcAccount);
      await expectRevert(arcContract.addMinter(otherAccount.address, 100));
    });

    it('should not be able to re-add a minter as the owner', async () => {
      const contract = await getContract(ownerAccount);
      await contract.addMinter(arcAccount.address, 100);
      await expectRevert(contract.addMinter(arcAccount.address, 100));
    });
  });

  describe('#removeMinter', () => {
    beforeEach(async () => {
      const contract = await getContract(ownerAccount);
      await contract.addMinter(arcAccount.address, 100);
    });

    it('should not be able to remove a minter as an unauthorised user', async () => {
      const contract = await getContract(otherAccount);
      await expectRevert(contract.removeMinter(otherAccount.address));
    });

    it('should be able to remove a minter as the owner', async () => {
      const contract = await getContract(ownerAccount);
      await contract.removeMinter(arcAccount.address);

      expect(await (await contract.getAllMinters()).length).to.equal(0);
      expect(await contract.isValidMinter(arcAccount.address)).to.be.false;
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

  describe('#updateMinterLimit', () => {
    beforeEach(async () => {
      const contract = await getContract(ownerAccount);
      await contract.addMinter(arcAccount.address, 100);
    });

    it('should not be able to update the limit as an unauthorised user', async () => {
      const contract = await getContract(otherAccount);
      await expect(contract.updateMinterLimit(arcAccount.address, 200)).to.be.reverted;
    });

    it('should not be able to set the limit for an invalid minter', async () => {
      const contract = await getContract(ownerAccount);
      await expect(contract.updateMinterLimit(arcAccount1.address, 200)).to.be.reverted;
    });

    it('should be able to update the limit as the owner', async () => {
      const contract = await getContract(ownerAccount);
      await contract.updateMinterLimit(arcAccount.address, 200);
      expect(await contract.getMinterLimit(arcAccount.address)).to.equal(200);
    });

    it('should be able to mint more if the limits increase', async () => {
      const minterContract = await getContract(arcAccount);

      await minterContract.mint(otherAccount.address, 100);
      let issuance = await minterContract.getMinterIssued(arcAccount.address);
      expect(issuance.value).to.equal(100);
      expect(issuance.sign).to.be.true;

      await expect(minterContract.mint(otherAccount.address, 1)).to.be.reverted;
      const ownerContract = await getContract(ownerAccount);

      await ownerContract.updateMinterLimit(arcAccount.address, 200);
      await minterContract.mint(otherAccount.address, 100);

      issuance = await minterContract.getMinterIssued(arcAccount.address);
      expect(await minterContract.getMinterLimit(arcAccount.address)).to.equal(200);
      expect(issuance.value).to.equal(200);
      expect(issuance.sign).to.be.true;

      await expect(minterContract.mint(otherAccount.address, 1)).to.be.reverted;
    });
  });

  describe('#burn', () => {
    beforeEach(async () => {
      const contract = await getContract(ownerAccount);
      await contract.addMinter(arcAccount.address, 100);
      const minterContract = await getContract(arcAccount);
      await minterContract.mint(userAccount.address, 10);
    });

    it('should not be able to burn as an unauthorised user', async () => {
      const contract = await getContract(otherAccount);
      await expect(contract.burn(userAccount.address, 10)).to.be.reverted;
    });

    it('should be able to burn as arc (and reduce issuance count)', async () => {
      expect(await (await syntheticToken.balanceOf(userAccount.address)).toNumber()).to.equal(10);

      const contract = await getContract(arcAccount);
      let issuance = await contract.getMinterIssued(arcAccount.address);
      expect(issuance.value).to.equal(10);
      expect(issuance.sign).to.be.true;

      await contract.burn(userAccount.address, 10);

      expect(await (await syntheticToken.balanceOf(userAccount.address)).toNumber()).to.equal(0);
      issuance = await contract.getMinterIssued(arcAccount.address);
      expect(issuance.value).to.equal(0);
    });

    it('should be able to go into negative issuance and still mint more', async () => {});
  });

  describe('#transferCollateral', () => {
    beforeEach(async () => {
      const contract = await getContract(ownerAccount);
      await contract.addMinter(arcAccount.address, 100);
      const minterContract = await getContract(arcAccount);
      await minterContract.mint(syntheticToken.address, 10);
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

  describe('#updateMetadata', () => {
    beforeEach(async () => {
      const contract = await getContract(ownerAccount);
      await contract.addMinter(arcAccount.address, 100);
    });

    it('should not be able to update metadata as an unauthorised user', async () => {
      const contract = await getContract(otherAccount);
      await expectRevert(contract.updateMetadata('NEW', 'NEW'));
    });

    it('should be able to update metadata as a minter', async () => {
      const contract = await getContract(ownerAccount);
      await contract.updateMetadata('New Token', 'NEW');
      expect(await contract.name()).to.equal('New Token');
      expect(await contract.symbol()).to.equal('NEW');
    });
  });
});
