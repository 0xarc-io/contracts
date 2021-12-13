import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
  DefaultPassportSkin,
  DefiPassport,
  MockDefiPassportFactory,
} from '@src/typings';
import { constants, utils } from 'ethers';
import { DefaultPassportSkinFactory } from '@src/typings/DefaultPassportSkinFactory';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployDefiPassport } from '../../deployers';
import { DefiPassportSkinFactory } from '@src/typings/DefiPassportSkinFactory';
import { DefiPassportSkin } from '@src/typings/DefiPassportSkin';

const DEFAULT_NAME = 'Defi Passport';
const DEFAULT_SYMBOL = 'DFP';
const DEFAULT_BASE_URI = 'https://default.base.uri/';

describe('DefiPassport', () => {
  let defiPassportSkin: DefiPassportSkin;

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
  async function mintUserPassport(
    defiPassport: DefiPassport,
    user: SignerWithAddress,
  ) {
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

    const defiPassport = await deployDefiPassport(admin);
    await defiPassport.init('Defi Passport', 'DefiPassport', admin.address);

    // Register default skin
    await defiPassport.setDefaultSkin(defaultPassportSkin.address, true);

    // Mint 2 defi passports
    await mintUserPassport(defiPassport, user1);
    user2PassportTokenId = await mintUserPassport(defiPassport, user2);

    await defiPassport.setBaseURI(DEFAULT_BASE_URI);

    // Upgrade contract
    const upgradeImpl = await new DefiPassportSkinFactory(admin).deploy();
    const proxy = ArcProxyFactory.connect(defiPassport.address, admin);
    await proxy.upgradeTo(upgradeImpl.address);
    defiPassportSkin = DefiPassportSkinFactory.connect(proxy.address, admin);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('Upgrade related tests', () => {
    describe('Confirm removal of functions', () => {
      it('reverts if mint is called', () => {
        expect(() =>
          defiPassportSkin.mint(
            user2.address,
            defaultPassportSkin.address,
            defaultSkinTokenId,
          ),
        ).to.throw('defiPassportSkin.mint is not a function');
      });

      it('reverts if setActiveSkin is called', () => {
        expect(() =>
          defiPassportSkin.setActiveSkin(
            defaultPassportSkin.address,
            defaultSkinTokenId,
          ),
        ).to.throw('defiPassportSkin.setActiveSkin is not a function');
      });

      it('reverts if isSkinAvailable is called', () => {
        expect(() =>
          defiPassportSkin.isSkinAvailable(
            user1.address,
            defaultPassportSkin.address,
            defaultSkinTokenId,
          ),
        ).to.throw('defiPassportSkin.isSkinAvailable is not a function');
      });

      it('reverts if setSkinManager are called', () => {
        expect(() => defiPassportSkin.setSkinManager(admin.address)).to.throw(
          'defiPassportSkin.setSkinManager is not a function',
        );
      });

      it('reverts if setWhitelistedSkin is called', () => {
        expect(() =>
          defiPassportSkin.setWhitelistedSkin(
            defaultPassportSkin.address,
            true,
          ),
        ).to.throw('defiPassportSkin.setWhitelistedSkin is not a function');
      });

      it('reverts if setApprovedSkin is called', () => {
        expect(() =>
          defiPassportSkin.setApprovedSkin(
            defaultPassportSkin.address,
            defaultSkinTokenId,
            true,
          ),
        ).to.throw('defiPassportSkin.setApprovedSkin is not a function');
      });

      it('reverts if setApprovedSkins or approvedSkins are called', () => {
        expect(() =>
          defiPassportSkin.setApprovedSkins([
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
        ).to.throw('defiPassportSkin.setApprovedSkins is not a function');

        expect(() =>
          defiPassportSkin.approvedSkins(
            defaultPassportSkin.address,
            defaultSkinTokenId,
          ),
        ).to.throw('defiPassportSkin.approvedSkins is not a function');
      });

      it('reverts if setDefaultSkin or defaultSkins are called', () => {
        expect(() =>
          defiPassportSkin.setDefaultSkin(defaultPassportSkin.address, true),
        ).to.throw('defiPassportSkin.setDefaultSkin is not a function');

        expect(() =>
          defiPassportSkin.defaultSkins(defaultPassportSkin.address),
        ).to.throw('defiPassportSkin.defaultSkins is not a function');
      });

      it('reverts if setActiveDefaultSkin or defaultActiveSkin are called', () => {
        expect(() =>
          defiPassportSkin.setActiveDefaultSkin(defaultPassportSkin.address),
        ).to.throw('defiPassportSkin.setActiveDefaultSkin is not a function');

        expect(() => defiPassportSkin.defaultActiveSkin()).to.throw(
          'defiPassportSkin.defaultActiveSkin is not a function',
        );
      });
    });

    describe('#balanceOf', () => {
      it('preserves the balance of the users after upgrade', async () => {
        expect(await defiPassportSkin.balanceOf(user1.address)).to.eq(1);

        expect(await defiPassportSkin.balanceOf(user2.address)).to.eq(1);
      });
    });

    describe('#tokenOfOwnerByIndex', () => {
      it('preserves the token id of an user after upgrade', async () => {
        expect(
          await defiPassportSkin.tokenOfOwnerByIndex(user2.address, 0),
        ).to.eq(user2PassportTokenId);
      });
    });

    describe('#approve', () => {
      it('reverts if the the caller is not the admin of the token', async () => {
        await expect(
          defiPassportSkin.approve(user1.address, user2PassportTokenId),
        ).to.be.revertedWith(
          'ERC721: approve caller is not owner nor approved for all',
        );
      });

      it('reverts if the token does not exist', async () => {
        await expect(
          defiPassportSkin.connect(user2).approve(user1.address, 999),
        ).to.be.revertedWith('ERC721: owner query for nonexistent token');
      });

      it('approves the token & transfers', async () => {
        await defiPassportSkin
          .connect(user2)
          .approve(user1.address, user2PassportTokenId);

        expect(await defiPassportSkin.balanceOf(user1.address)).to.eq(1);
        expect(await defiPassportSkin.balanceOf(user2.address)).to.eq(1);

        await defiPassportSkin
          .connect(user1)
          .transferFrom(user2.address, user1.address, user2PassportTokenId);

        expect(await defiPassportSkin.balanceOf(user1.address)).to.eq(2);
        expect(await defiPassportSkin.balanceOf(user2.address)).to.eq(0);
      });
    });

    describe('#transferFrom', () => {
      it('reverts if caller is not `from` and the token is not approved for `from`', async () => {
        await expect(
          defiPassportSkin.transferFrom(
            user2.address,
            admin.address,
            user2PassportTokenId,
          ),
        ).to.be.revertedWith(
          'ERC721: transfer caller is not owner nor approved',
        );

        await defiPassportSkin
          .connect(user2)
          .approve(user1.address, user2PassportTokenId);

        await expect(
          defiPassportSkin.transferFrom(
            user2.address,
            admin.address,
            user2PassportTokenId,
          ),
        ).to.be.revertedWith(
          'ERC721: transfer caller is not owner nor approved',
        );
      });

      it('reverts if `to` is the zero address', async () => {
        await expect(
          defiPassportSkin
            .connect(user2)
            .transferFrom(
              user2.address,
              constants.AddressZero,
              user2PassportTokenId,
            ),
        ).to.be.revertedWith('ERC721: transfer to the zero address');
      });
    });

    describe('#safeTransferFrom(from, to, tokenId)', () => {
      it('runs `_safeTransferFrom`', async () => {
        expect(await defiPassportSkin.ownerOf(user2PassportTokenId)).to.eq(
          user2.address,
        );

        await defiPassportSkin
          .connect(user2)
          ['safeTransferFrom(address,address,uint256)'](
            user2.address,
            user1.address,
            user2PassportTokenId,
          );

        expect(await defiPassportSkin.ownerOf(user2PassportTokenId)).to.eq(
          user1.address,
        );
      });
    });

    describe('safeTransferFrom(from, to, tokenId, _data)', () => {
      it('runs `_safeTransferFrom`', async () => {
        expect(await defiPassportSkin.ownerOf(user2PassportTokenId)).to.eq(
          user2.address,
        );

        await defiPassportSkin
          .connect(user2)
          ['safeTransferFrom(address,address,uint256,bytes)'](
            user2.address,
            user1.address,
            user2PassportTokenId,
            [],
          );

        expect(await defiPassportSkin.ownerOf(user2PassportTokenId)).to.eq(
          user1.address,
        );
      });
    });

    describe('#setApprovalForAll', () => {
      it('runs  `setApprovalForAll` from ERC721', async () => {
        expect(await defiPassportSkin.ownerOf(user2PassportTokenId)).to.eq(
          user2.address,
        );

        await defiPassportSkin
          .connect(user2)
          .setApprovalForAll(user1.address, true);
        await defiPassportSkin
          .connect(user1)
          .transferFrom(user2.address, user1.address, user2PassportTokenId);

        expect(await defiPassportSkin.ownerOf(user2PassportTokenId)).to.eq(
          user1.address,
        );
      });
    });

    describe('setNameAndSymbol', () => {
      it('reverts if the caller by non-admin', async () => {
        await expect(
          defiPassportSkin.connect(user1).setNameAndSymbol('test', 'test'),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it.only('sets a new name and symbol', async () => {
        expect(defiPassportSkin.name()).to.eq(DEFAULT_NAME);
        expect(defiPassportSkin.symbol()).to.eq(DEFAULT_SYMBOL);

        await defiPassportSkin.setNameAndSymbol('test', 'TEST');

        expect(defiPassportSkin.name()).to.eq('test');
        expect(defiPassportSkin.symbol()).to.eq('TEST');
      });
    });

    describe('#tokenURI', () => {
      it('returns the correct token URI', async () => {
        expect(await defiPassportSkin.baseURI()).to.eq(DEFAULT_BASE_URI);
        expect(await defiPassportSkin.tokenURI(user2PassportTokenId)).to.eq(
          `${DEFAULT_BASE_URI}${user2PassportTokenId}`,
        );

        const tokenUriPrefix = 'https://test/';

        expect(await defiPassportSkin.tokenURI(user2PassportTokenId)).to.eq(
          `${tokenUriPrefix}${user2PassportTokenId}`,
        );
      });
    });
  });

  describe('Base contract tests', () => {
    describe('#init', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          defiPassportSkin.connect(user1).init('a', 'b'),
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
        await expect(defiPassportSkin.init('a', 'b')).to.be.revertedWith(
          'Initializable: contract is already initialized',
        );
      });
    });

    describe('#setBaseURI', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          defiPassportSkin
            .connect(user1)
            .setBaseURI(utils.formatBytes32String('test')),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('sets the base URI of tokens', async () => {
        const uri = 'https://test.com/defipassport';

        await defiPassportSkin.setBaseURI(uri);

        expect(await defiPassportSkin.baseURI()).to.eq(uri);
      });

      it('it is included in the token URI', async () => {
        const uri = 'https://test.com/defipassport/';

        await defiPassportSkin.setBaseURI(uri);

        const tokenId = await defiPassportSkin.tokenOfOwnerByIndex(
          user1.address,
          0,
        );

        expect(await defiPassportSkin.tokenURI(tokenId)).to.eq(uri + tokenId);
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
