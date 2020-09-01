import 'jest';

import simpleDescribe from '@test/helpers/simpleDescribe';
import { ITestContext } from '@test/helpers/simpleDescribe';
import { Wallet } from 'ethers';
import { BigNumber } from 'ethers/utils';
import ArcDecimal from '@src/utils/ArcDecimal';
import ArcNumber from '@src/utils/ArcNumber';
import { expectRevert } from '@src/utils/expectRevert';
import { AddressAccrual } from '@src/typings/AddressAccrual';
import { SyntheticToken } from '@src/typings/SyntheticToken';

let ownerWallet: Wallet;
let arcWallet: Wallet;
let userWallet: Wallet;
let otherWallet: Wallet;

jest.setTimeout(30000);

let syntheticToken: SyntheticToken;

async function init(ctx: ITestContext): Promise<void> {
  ownerWallet = ctx.wallets[0];
  arcWallet = ctx.wallets[1];
  userWallet = ctx.wallets[2];
  otherWallet = ctx.wallets[3];
}

async function getContract(caller: Wallet) {
  return SyntheticToken.at(caller, syntheticToken.address);
}

simpleDescribe('SyntheticToken', init, (ctx: ITestContext) => {
  beforeEach(async () => {
    syntheticToken = await SyntheticToken.deploy(
      ownerWallet,
      arcWallet.address,
      'ARCUSD',
      'ARCUSD',
    );
    syntheticToken = await SyntheticToken.at(arcWallet, syntheticToken.address);
  });

  describe('#mint', () => {
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

  describe('#burn', () => {
    beforeEach(async () => {
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
