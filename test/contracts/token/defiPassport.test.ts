import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ArcProxyFactory } from '@src/typings';
import { DefiPassport } from '@src/typings/DefiPassport';
import { DefiPassportFactory } from '@src/typings/DefiPassportFactory';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { deployContract } from 'ethereum-waffle';
import { ethers } from 'hardhat';
import { deployDefiPassport } from '../deployers';

describe('DefiPassport', () => {
  let defiPassport: DefiPassport;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  before(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
    user = signers[1];

    defiPassport = await deployDefiPassport(owner);

    await defiPassport.init('Defi Passport', 'DefiPassport');
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#init', () => {
    it('reverts if called by non-admin', async () => {
      await expect(
        defiPassport.connect(user).init('a', 'b'),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('sets the name and symbol of the NFT', async () => {
      const name = 'DeFi Passport';
      const symbol = 'DefiPassport';

      const _defiPassport = await deployDefiPassport(owner);

      await _defiPassport.init(name, symbol);

      expect(await _defiPassport.name()).to.eq(name);
      expect(await _defiPassport.symbol()).to.eq(symbol);
    });

    it('reverts if called a second time', async () => {
      await expect(defiPassport.init('a', 'b')).to.be.revertedWith(
        'Initializable: contract is already initialized',
      );
    });
  });

  // mint(address to, address skin)
  describe('#mint', () => {
    it('reverts if the receiver has no credit score');

    it('mints the passport to the receiver');

    it('reverts if the receiver already has a passport');
  });

  describe('#setBaseURI', () => {
    it('reverts if called by non-admin');

    it('sets the base URI of tokens');
  });

  // setSkin(address skin)
  describe('#setSkin', () => {
    it('reverts if caller has no passport');

    it('reverts if caller does not have the specified skin');

    it('sets the skin');
  });

  describe('#getCurrentSkin', () => {
    it('returns the current skin of the specified passport');
  });

  describe('#setSkinManager', () => {
    it('reverts if called by non-admin');

    it('sets the skin manager');
  });

  describe('#revokeSkin', () => {
    it('reverts if called by non-skin-manager');

    it('adds a skin to the blacklist');
  });

  describe('#approveSkin', () => {
    it('reverts if called by non-skin-manager');

    it('adds the skin to the list of approved skins');
  });

  describe('#setCreditScoreContract', () => {
    it('reverts if called by non-admin');

    it('sets the credit score contract if called by admin');
  });

  describe('#approve', () => {
    it('reverts - defi passports are not transferrable');
  });

  describe('#transferFrom', () => {
    it('reverts - defi passports are not transferrable');
  });

  describe('#safeTransferFrom(from, to, tokenId)', () => {
    it('reverts - defi passports are not transferrable');
  });

  describe('#safeTransferFrom(from, to, tokenId, _data)', () => {
    it('reverts - defi passports are not transferrable');
  });

  describe('#setApprovedForAll', () => {
    it('reverts - defi passports are not transferrable');
  });

  /**
   * TODO: add setSkin function.
   *
   * For this we most likely need a DefiPassportSkin NFT
   */
});
