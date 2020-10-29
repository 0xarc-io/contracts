import 'module-alias/register';

import simpleDescribe from '@test/helpers/simpleDescribe';
import { ITestContext } from '@test/helpers/simpleDescribe';
import { expectRevert } from '@src/utils/expectRevert';
import { SyntheticToken } from '@src/typings/SyntheticToken';
import { Account, getWaffleExpect } from '../../helpers/testingUtils';

let ownerAccount: Account;
let arcAccount: Account;
let arcAccount1: Account;
let arcAccount2: Account;
let userAccount: Account;
let otherAccount: Account;

const expect = getWaffleExpect();

let syntheticToken: SyntheticToken;

async function init(ctx: ITestContext): Promise<void> {
  ownerAccount = ctx.accounts[0];
  arcAccount = ctx.accounts[1];
  userAccount = ctx.accounts[2];
  otherAccount = ctx.accounts[3];
  arcAccount1 = ctx.accounts[4];
  arcAccount2 = ctx.accounts[5];
}

async function getContract(caller: Account) {
  return SyntheticToken.at(caller.wallet, syntheticToken.address);
}

simpleDescribe('SyntheticToken', init, (ctx: ITestContext) => {
  beforeEach(async () => {
    syntheticToken = await SyntheticToken.deploy(ownerAccount.wallet, 'ARCUSD', 'ARCUSD');

    syntheticToken = await SyntheticToken.at(arcAccount.wallet, syntheticToken.address);
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
