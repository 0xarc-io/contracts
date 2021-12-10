import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
  DefaultPassportSkin,
  DefiPassport,
  MockDefiPassportFactory,
} from '@src/typings';
import { utils } from 'ethers';
import { DefaultPassportSkinFactory } from '@src/typings/DefaultPassportSkinFactory';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployDefiPassport } from '../../deployers';

describe('DefiPassport', () => {
  let defiPassport: DefiPassport;

  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let skinManager: SignerWithAddress;
  let defaultPassportSkinContract: DefaultPassportSkin;
  let defaultSkinTokenId: BigNumber;

  async function _setupSkins() {
    defaultPassportSkinContract = await new DefaultPassportSkinFactory(
      owner,
    ).deploy('Default passport skin nft', 'DPS');

    await defaultPassportSkinContract.mint(owner.address, '');
    defaultSkinTokenId = await defaultPassportSkinContract.tokenOfOwnerByIndex(
      owner.address,
      0,
    );
  }

  /**
   * Helper function that mints a passport to a given user
   */
  async function mintUserPassport(user: SignerWithAddress) {
    await defiPassport.mint(
      user.address,
      defaultPassportSkinContract.address,
      defaultSkinTokenId,
    );

    return defiPassport.tokenOfOwnerByIndex(user.address, 0);
  }

  before(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
    user1 = signers[1];
    user2 = signers[2];
    skinManager = signers[3];

    await _setupSkins();

    defiPassport = await deployDefiPassport(owner);
    await defiPassport.init(
      'Defi Passport',
      'DefiPassport',
      skinManager.address,
    );

    // Mint 2 defi passports
    await mintUserPassport(user1);
    await mintUserPassport(user2);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('Upgrade related tests', () => {
    describe('Confirm removal of functions', () => {
      it('reverts if mint is called');

      it('reverts if setActiveSkin is called');

      it('reverts if isSkinAvailable is called');

      it('reverts if skinManager or setSkinManager are called');

      it('reverts if setWhitelistedSkin is called');

      it('reverts if setApprovedSkin is called');

      it('reverts if setApprovedSkins or approvedSkins are called');

      it('reverts if setDefaultSkin or defaultSkins are called');

      it('reverts if setActiveDefaultSkin or defaultActiveSkin are called');

      it('preserves the balance of the user1 after upgrade');

      it('preserves the token id of an owner after upgrade');
    });

    describe('#approve', () => {
      it('reverts if the the caller is not the owner of the token');

      it('reverts if the token does not exist');

      it('approves the token for transfer if called by the owner');
    });

    describe('#transferFrom', () => {
      it(
        'reverts if caller is not `from` and the token is not approved for `from`',
      );

      it('reverts if `from` is the zero addres');

      it('reverts if `to` is the zero address');

      it('transfers the token to the receiver if token is approved');

      it('transfers the token to the if `from` is the owner');
    });

    describe('#safeTransferFrom(from, to, tokenId)', () => {
      it('runs `_safeTransferFrom`');
    });

    describe('safeTransferFrom(from, to, tokenId, _data)', () => {
      it('runs `_safeTransferFrom`');
    });

    describe('#setApprovalForAll', () => {
      it('runs  `setApprovalForAll` from ERC721');
    });

    describe('setNameAndSymbol', () => {
      it('reverts if the caller by non-admin');

      it('sets a new name and symbol');
    });
  });

  describe('Base contract tests', () => {
    describe('#init', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          defiPassport.connect(user1).init('a', 'b', skinManager.address),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('sets the name and symbol of the NFT', async () => {
        const name = 'DeFi Passport';
        const symbol = 'DefiPassport';

        const _defiPassport = await deployDefiPassport(owner);

        await _defiPassport.init(name, symbol, skinManager.address);

        expect(await _defiPassport.name()).to.eq(name);
        expect(await _defiPassport.symbol()).to.eq(symbol);
      });

      it('reverts if called a second time', async () => {
        await expect(
          defiPassport.init('a', 'b', skinManager.address),
        ).to.be.revertedWith('Initializable: contract is already initialized');
      });
    });

    describe('#setBaseURI', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          defiPassport
            .connect(user1)
            .setBaseURI(utils.formatBytes32String('test')),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('sets the base URI of tokens', async () => {
        const uri = 'https://test.com/defipassport';

        await defiPassport.setBaseURI(uri);

        expect(await defiPassport.baseURI()).to.eq(uri);
      });

      it('it is included in the token URI', async () => {
        const uri = 'https://test.com/defipassport/';

        await defiPassport.setBaseURI(uri);

        await defiPassport
          .connect(skinManager)
          .setDefaultSkin(defaultPassportSkinContract.address, true);

        await defiPassport.mint(
          user1.address,
          defaultPassportSkinContract.address,
          defaultSkinTokenId,
        );

        const tokenId = await defiPassport.tokenOfOwnerByIndex(
          user1.address,
          0,
        );

        expect(await defiPassport.tokenURI(tokenId)).to.eq(
          uri + user1.address.toLowerCase(),
        );
      });
    });

    it('check burn implementation integrity', async () => {
      const mockDefiPassport = await new MockDefiPassportFactory(
        owner,
      ).deploy();
      const proxy = await new ArcProxyFactory(owner).deploy(
        mockDefiPassport.address,
        owner.address,
        [],
      );
      const contract = MockDefiPassportFactory.connect(proxy.address, owner);
      await contract.init('test', 'test', skinManager.address);

      await contract
        .connect(skinManager)
        .setDefaultSkin(defaultPassportSkinContract.address, true);

      await contract.mint(
        user1.address,
        defaultPassportSkinContract.address,
        defaultSkinTokenId,
      );

      expect(await contract.balanceOf(user1.address)).to.eq(1);
      expect(await contract.tokenURI(1)).to.not.be.empty;

      await contract.burn(1);

      expect(await contract.balanceOf(user1.address)).to.eq(0);

      // ERC721Metadata.tookenURI() reverts if token does not exist
      await expect(contract.tokenURI(1)).to.be.revertedWith(
        'ERC721Metadata: URI query for nonexistent token',
      );
    });
  });
});
