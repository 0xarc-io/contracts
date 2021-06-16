import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ArcProxyFactory } from '@src/typings';
import { DefiPassportFactory } from '@src/typings/DefiPassportFactory';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { deployContract } from 'ethereum-waffle';
import { ethers } from 'hardhat';
import { deployDefiPassport } from '../deployers';

describe('DefiPassport', () => {
  let owner: SignerWithAddress;

  before(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#init', () => {
    it('sets the name and symbol of the NFT', async () => {
      const name = 'DeFi Passport';
      const symbol = 'DefiPassport';

      const defiPassport = await deployDefiPassport(owner);

      await defiPassport.init(name, symbol);

      expect(await defiPassport.name()).to.eq(name);
      expect(await defiPassport.symbol()).to.eq(symbol);
    });

    it('reverts if called a second time');
  });

  describe('#claim', () => {
    it('reverts if user has no credit score proof');

    it('mints a Defi Passport to the user with the given skin');

    it('reverts if claims a second time');
  });

  describe('#setBaseURI', () => {
    it('reverts if called by non-admin');

    it('sets the base URI of tokens');
  });

  /**
   * TODO: add setSkin function.
   *
   * For this we most likely need a DefiPassportSkin NFT
   */
});
