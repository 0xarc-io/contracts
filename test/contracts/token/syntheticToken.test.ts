import 'jest';

import simpleDescribe from '@test/helpers/simpleDescribe';
import { ITestContext } from '@test/helpers/simpleDescribe';
import { Wallet } from 'ethers';
import { expectRevert } from '@src/utils/expectRevert';
import { SyntheticToken } from '@src/typings/SyntheticToken';

let ownerWallet: Wallet;
let arcWallet: Wallet;
let arcWallet1: Wallet;
let arcWallet2: Wallet;
let userWallet: Wallet;
let otherWallet: Wallet;

jest.setTimeout(30000);

let syntheticToken: SyntheticToken;

async function init(ctx: ITestContext): Promise<void> {
  ownerWallet = ctx.wallets[0];
  arcWallet = ctx.wallets[1];
  userWallet = ctx.wallets[2];
  otherWallet = ctx.wallets[3];
  arcWallet1 = ctx.wallets[4];
  arcWallet2 = ctx.wallets[5];
}

async function getContract(caller: Wallet) {
  return SyntheticToken.at(caller, syntheticToken.address);
}

simpleDescribe('SyntheticToken', init, (ctx: ITestContext) => {
  beforeEach(async () => {
    syntheticToken = await SyntheticToken.deploy(ownerWallet, 'ARCUSD', 'ARCUSD');

    syntheticToken = await SyntheticToken.at(arcWallet, syntheticToken.address);
  });

  describe('#mint', () => {
    beforeEach(async () => {
      const contract = await getContract(ownerWallet);
      await contract.addMinter(arcWallet.address);
    });

    it('should not be able to mint as an unauthorised user', async () => {
      const contract = await getContract(otherWallet);
      await expectRevert(contract.mint(otherWallet.address, 10));
    });

    it('should be able to mint as arc', async () => {
      const contract = await getContract(arcWallet);
      await contract.mint(arcWallet.address, 10);
      expect(await (await syntheticToken.balanceOf(arcWallet.address)).toNumber()).toEqual(10);
    });
  });

  describe('#addMinter', () => {
    it('should not be able to add a minter as an unauthorised user', async () => {
      const contract = await getContract(otherWallet);
      await expectRevert(contract.addMinter(otherWallet.address));
    });

    it('should be able to add a minter as the owner', async () => {
      const contract = await getContract(ownerWallet);
      await contract.addMinter(arcWallet.address);

      expect(await (await contract.getAllMinters()).length).toEqual(1);
      expect(await contract.mintersArray(0)).toEqual(arcWallet.address);
      expect(await contract.minters(arcWallet.address)).toBeTruthy();

      await contract.addMinter(arcWallet1.address);
      expect(await (await contract.getAllMinters()).length).toEqual(2);
      expect(await contract.mintersArray(0)).toEqual(arcWallet.address);
      expect(await contract.mintersArray(1)).toEqual(arcWallet1.address);
      expect(await contract.minters(arcWallet.address)).toBeTruthy();
      expect(await contract.minters(arcWallet1.address)).toBeTruthy();

      await contract.addMinter(arcWallet2.address);
      expect(await (await contract.getAllMinters()).length).toEqual(3);
      expect(await contract.mintersArray(0)).toEqual(arcWallet.address);
      expect(await contract.mintersArray(1)).toEqual(arcWallet1.address);
      expect(await contract.mintersArray(2)).toEqual(arcWallet2.address);
      expect(await contract.minters(arcWallet.address)).toBeTruthy();
      expect(await contract.minters(arcWallet1.address)).toBeTruthy();
      expect(await contract.minters(arcWallet2.address)).toBeTruthy();

      await contract.removeMinter(arcWallet1.address);
      expect(await (await contract.getAllMinters()).length).toEqual(2);
      expect(await contract.mintersArray(0)).toEqual(arcWallet.address);
      expect(await contract.mintersArray(1)).toEqual(arcWallet2.address);
      expect(await contract.minters(arcWallet.address)).toBeTruthy();
      expect(await contract.minters(arcWallet1.address)).toBeFalsy();
      expect(await contract.minters(arcWallet2.address)).toBeTruthy();

      await contract.removeMinter(arcWallet.address);
      expect(await (await contract.getAllMinters()).length).toEqual(1);
      expect(await contract.mintersArray(0)).toEqual(arcWallet2.address);
      expect(await contract.minters(arcWallet.address)).toBeFalsy();
      expect(await contract.minters(arcWallet1.address)).toBeFalsy();
      expect(await contract.minters(arcWallet2.address)).toBeTruthy();
    });

    it('should not be able to add a minter as another minter', async () => {
      const ownerContract = await getContract(ownerWallet);
      await ownerContract.addMinter(arcWallet.address);

      const arcContract = await getContract(arcWallet);
      await expectRevert(arcContract.addMinter(otherWallet.address));
    });

    it('should not be able to re-add a minter as the owner', async () => {
      const contract = await getContract(ownerWallet);
      await contract.addMinter(arcWallet.address);
      await expectRevert(contract.addMinter(arcWallet.address));
    });
  });

  describe('#removeMinter', () => {
    beforeEach(async () => {
      const contract = await getContract(ownerWallet);
      await contract.addMinter(arcWallet.address);
    });

    it('should not be able to remove a minter as an unauthorised user', async () => {
      const contract = await getContract(otherWallet);
      await expectRevert(contract.removeMinter(otherWallet.address));
    });

    it('should be able to remove a minter as the owner', async () => {
      const contract = await getContract(ownerWallet);
      await contract.removeMinter(arcWallet.address);

      expect(await (await contract.getAllMinters()).length).toEqual(0);
      expect(await contract.minters(arcWallet.address)).toBeFalsy();
    });

    it('should not be able to remove a minter as another minter', async () => {
      const arcContract = await getContract(arcWallet);
      await expectRevert(arcContract.removeMinter(otherWallet.address));
    });

    it('should not be able to remove a non-existent minter as the owner', async () => {
      const contract = await getContract(ownerWallet);
      await contract.removeMinter(arcWallet.address);
      await expectRevert(contract.removeMinter(arcWallet.address));
    });
  });

  describe('#burn', () => {
    beforeEach(async () => {
      const contract = await getContract(ownerWallet);
      await contract.addMinter(arcWallet.address);
      await syntheticToken.mint(userWallet.address, 10);
    });

    it('should not be able to burn as an unauthorised user', async () => {
      const contract = await getContract(otherWallet);
      await expectRevert(contract.burn(userWallet.address, 10));
    });

    it('should be able to burn as arc', async () => {
      expect(await (await syntheticToken.balanceOf(userWallet.address)).toNumber()).toEqual(10);
      const contract = await getContract(arcWallet);
      await contract.burn(userWallet.address, 10);
      expect(await (await syntheticToken.balanceOf(userWallet.address)).toNumber()).toEqual(0);
    });
  });

  describe('#transferCollateral', () => {
    beforeEach(async () => {
      const contract = await getContract(ownerWallet);
      await contract.addMinter(arcWallet.address);
      await syntheticToken.mint(syntheticToken.address, 10);
    });

    it('should not be able to transfer collateral as an unauthorised user', async () => {
      const contract = await getContract(otherWallet);
      await expectRevert(
        contract.transferCollateral(syntheticToken.address, userWallet.address, 10),
      );
    });

    it('should be able to transfer collateral as arc', async () => {
      const contract = await getContract(arcWallet);
      await contract.transferCollateral(syntheticToken.address, userWallet.address, 10);
      expect(await (await syntheticToken.balanceOf(userWallet.address)).toNumber()).toEqual(10);
    });
  });
});
