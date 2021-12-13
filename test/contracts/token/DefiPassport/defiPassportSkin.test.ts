import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
  DefaultPassportSkin,
  MockDefiPassportFactory,
} from '@src/typings';
import { utils } from 'ethers';
import { DefaultPassportSkinFactory } from '@src/typings/DefaultPassportSkinFactory';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployDefiPassport } from '../../deployers';
import { DefiPassportSkinFactory } from '@src/typings/DefiPassportSkinFactory';
import { DefiPassportSkin } from '@src/typings/DefiPassportSkin';

describe('DefiPassport', () => {
  let defiPassport: DefiPassportSkin;

  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let defaultPassportSkin: DefaultPassportSkin;
  let defaultSkinTokenId: BigNumber;
  let user2PassportTokenId: BigNumber;

  async function _setupSkins() {
    defaultPassportSkin = await new DefaultPassportSkinFactory(admin).deploy(
      'Default passport skin nft',
      'DPS',
    );

    await defaultPassportSkin.mint(admin.address, '');
    defaultSkinTokenId = await defaultPassportSkin.tokenOfOwnerByIndex(
      admin.address,
      0,
    );
  }

  /**
   * Helper function that mints a passport to a given user
   */
  async function mintUserPassport(user: SignerWithAddress) {
    await defiPassport.mint(
      user.address,
      defaultPassportSkin.address,
      defaultSkinTokenId,
    );

    return defiPassport.tokenOfOwnerByIndex(user.address, 0);
  }

  before(async () => {
    const signers = await ethers.getSigners();
    admin = signers[0];
    user1 = signers[1];
    user2 = signers[2];

    await _setupSkins();

    defiPassport = await deployDefiPassport(admin);
    await defiPassport.init('Defi Passport', 'DefiPassport', admin.address);

    // Register default skin
    await defiPassport.setDefaultSkin(defaultPassportSkin.address, true);

    // Mint 2 defi passports
    await mintUserPassport(user1);
    user2PassportTokenId = await mintUserPassport(user2);

    // Upgrade contract
    const upgradeImpl = await new DefiPassportSkinFactory(admin).deploy();
    const proxy = ArcProxyFactory.connect(defiPassport.address, admin);
    await proxy.upgradeTo(upgradeImpl.address);
    defiPassport = DefiPassportSkinFactory.connect(proxy.address, admin);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('Upgrade related tests', () => {
    describe('Confirm removal of functions', () => {
      it('reverts if mint is called', async () => {
        await expect(
          defiPassport.mint(
            user2.address,
            defaultPassportSkin.address,
            defaultSkinTokenId,
          ),
        ).to.be.revertedWith('Function not supported');
      });

      it('reverts if setActiveSkin is called', async () => {
        await expect(
          defiPassport.setActiveSkin(
            defaultPassportSkin.address,
            defaultSkinTokenId,
          ),
        ).to.be.revertedWith('Function not supported');
      });

      it('reverts if isSkinAvailable is called', async () => {
        await expect(
          defiPassport.isSkinAvailable(
            user1.address,
            defaultPassportSkin.address,
            defaultSkinTokenId,
          ),
        ).to.be.revertedWith('Function not supported');
      });

      it('reverts if setSkinManager are called', async () => {
        await expect(
          defiPassport.setSkinManager(admin.address),
        ).to.be.revertedWith('Function not supported');
      });

      it('reverts if setWhitelistedSkin is called', async () => {
        await expect(
          defiPassport.setWhitelistedSkin(defaultPassportSkin.address, true),
        ).to.be.revertedWith('Function not supported');
      });

      it('reverts if setApprovedSkin is called', async () => {
        await expect(
          defiPassport.setApprovedSkin(
            defaultPassportSkin.address,
            defaultSkinTokenId,
            true,
          ),
        ).to.be.revertedWith('Function not supported');
      });

      it('reverts if setApprovedSkins or approvedSkins are called', async () => {
        await expect(
          defiPassport.setApprovedSkins([
            {
              skin: defaultPassportSkin.address,
              skinTokenIdStatuses: [
                {
                  tokenId: defaultSkinTokenId,
                  status: true,
                },
              ],
            },
          ]),
        ).to.be.revertedWith('Function not supported');

        await expect(
          defiPassport.approvedSkins(
            defaultPassportSkin.address,
            defaultSkinTokenId,
          ),
        ).to.be.revertedWith('Function not supported');
      });

      it('reverts if setDefaultSkin or defaultSkins are called', async () => {
        await expect(
          defiPassport.setDefaultSkin(defaultPassportSkin.address, true),
        ).to.be.revertedWith('Function not supported');

        await expect(
          defiPassport.defaultSkins(defaultPassportSkin.address),
        ).to.be.revertedWith('Function not supported');
      });

      it('reverts if setActiveDefaultSkin or defaultActiveSkin are called', async () => {
        await expect(
          defiPassport.setActiveDefaultSkin(defaultPassportSkin.address),
        ).to.be.revertedWith('Function not supported');

        await expect(defiPassport.defaultActiveSkin()).to.be.revertedWith(
          'Function not supported',
        );
      });
    });

    describe('#balanceOf', () => {
      it('preserves the balance of the users after upgrade', async () => {
        expect(await defiPassport.balanceOf(user1.address)).to.eq(1);

        expect(await defiPassport.balanceOf(user2.address)).to.eq(1);
      });
    });

    describe('#tokenOfOwnerByIndex', () => {
      it('preserves the token id of an user after upgrade', async () => {
        expect(await defiPassport.tokenOfOwnerByIndex(user2.address, 0)).to.eq(
          user2PassportTokenId,
        );
      });
    });

    describe('#approve', () => {
      it('reverts if the the caller is not the admin of the token', async () => {
        await expect(
          defiPassport.approve(user1.address, user2PassportTokenId),
        ).to.be.revertedWith(
          'ERC721: approve caller is not owner nor approved for all',
        );
      });

      it('reverts if the token does not exist', async () => {
        await expect(
          defiPassport.connect(user2).approve(user1.address, 999),
        ).to.be.revertedWith('ERC721: owner query for nonexistent token');
      });

      it('approves the token for transfer if called by the admin', async () => {
        await defiPassport
          .connect(user2)
          .approve(user1.address, user2PassportTokenId);

        expect(await defiPassport.balanceOf(user1.address)).to.eq(1);
        expect(await defiPassport.balanceOf(user2.address)).to.eq(1);

        await defiPassport
          .connect(user1)
          .transferFrom(user2.address, user1.address, user2PassportTokenId);

        expect(await defiPassport.balanceOf(user1.address)).to.eq(2);
        expect(await defiPassport.balanceOf(user2.address)).to.eq(0);
      });
    });

    describe('#transferFrom', () => {
      it(
        'reverts if caller is not `from` and the token is not approved for `from`',
      );

      it('reverts if `from` is the zero addres');

      it('reverts if `to` is the zero address');

      it('transfers the token to the receiver if token is approved');

      it('transfers the token to the if `from` is the admin');
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
          defiPassport.connect(user1).init('a', 'b', admin.address),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('sets the name and symbol of the NFT', async () => {
        const name = 'DeFi Passport';
        const symbol = 'DefiPassport';

        const _defiPassport = await deployDefiPassport(admin);

        await _defiPassport.init(name, symbol, admin.address);

        expect(await _defiPassport.name()).to.eq(name);
        expect(await _defiPassport.symbol()).to.eq(symbol);
      });

      it('reverts if called a second time', async () => {
        await expect(
          defiPassport.init('a', 'b', admin.address),
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
        admin,
      ).deploy();
      const proxy = await new ArcProxyFactory(admin).deploy(
        mockDefiPassport.address,
        admin.address,
        [],
      );
      const contract = MockDefiPassportFactory.connect(proxy.address, admin);
      await contract.init('test', 'test', admin.address);

      await contract
        .connect(admin)
        .setDefaultSkin(defaultPassportSkin.address, true);

      await contract.mint(
        user1.address,
        defaultPassportSkin.address,
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
