import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
  DefaultPassportSkin,
  DefaultPassportSkinFactory,
  DefiPassport,
  DefiPassportFactory,
  EarlyPassportSkin,
  EarlyPassportSkinFactory,
} from '@src/typings';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { ethers } from 'hardhat';

const BASE_URI = 'https://example.com/';

describe('EarlyPassportSkin', () => {
  let skinContract: EarlyPassportSkin;

  let defiPassport: DefiPassport;
  let defaultPassportSkin: DefaultPassportSkin;
  const defaultSkinId = '1';

  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  before(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
    user = signers[1];

    const defiPassportImpl = await new DefiPassportFactory(owner).deploy();
    const proxy = await new ArcProxyFactory(owner).deploy(
      defiPassportImpl.address,
      owner.address,
      [],
    );
    defiPassport = DefiPassportFactory.connect(proxy.address, owner);
    await defiPassport.init('DefiPassport', 'DFP', owner.address);

    defaultPassportSkin = await new DefaultPassportSkinFactory(owner).deploy(
      'Default skin NFT',
      'DPS',
    );
    await defaultPassportSkin.mint(owner.address, '');

    await defiPassport.setDefaultSkin(defaultPassportSkin.address, true);

    skinContract = await new EarlyPassportSkinFactory(owner).deploy(
      defiPassport.address,
    );
    await skinContract.setBaseURI(BASE_URI);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#safeMint', () => {
    it('reverts if user has no passport', async () => {
      await expect(skinContract.safeMint(user.address)).to.be.revertedWith(
        'ERC721Enumerable: owner index out of bounds',
      );
    });

    it('mints the skin NFT to the user', async () => {
      await skinContract.setPassportIdThreshold(1);
      await defiPassport.mint(
        user.address,
        defaultPassportSkin.address,
        defaultSkinId,
      );

      expect(await skinContract.balanceOf(user.address)).to.eq(0);

      await skinContract.safeMint(user.address);

      expect(await skinContract.balanceOf(user.address)).to.eq(1);
    });

    it('reverts if user has a passport ID greater than the threshold', async () => {
      await skinContract.setPassportIdThreshold(1);

      await defiPassport.mint(
        owner.address,
        defaultPassportSkin.address,
        defaultSkinId,
      );
      await defiPassport.mint(
        user.address,
        defaultPassportSkin.address,
        defaultSkinId,
      );

      await skinContract.safeMint(owner.address);

      await expect(skinContract.safeMint(user.address)).to.be.revertedWith(
        'EarlyPassportSkin: passport ID is too high',
      );
    });

    it('sets the tokenURI', async () => {
      await skinContract.setPassportIdThreshold(1);
      await defiPassport.mint(
        user.address,
        defaultPassportSkin.address,
        defaultSkinId,
      );

      await expect(skinContract.tokenURI(0)).to.be.revertedWith(
        'ERC721Metadata: URI query for nonexistent token',
      );

      await skinContract.safeMint(user.address);

      expect(await skinContract.tokenURI(0)).to.eq(BASE_URI + 0);
    });

    it('reverts if user already has an early passport skin minted', async () => {
      await skinContract.setPassportIdThreshold(1);
      await defiPassport.mint(
        user.address,
        defaultPassportSkin.address,
        defaultSkinId,
      );

      await skinContract.safeMint(user.address);

      await expect(skinContract.safeMint(user.address)).to.be.revertedWith(
        'EarlyPassportSkin: user has already minted the skin',
      );
    });

    it('reverts if user mints, transfers, then mints again', async () => {
      await skinContract.setPassportIdThreshold(1);
      await defiPassport.mint(
        user.address,
        defaultPassportSkin.address,
        defaultSkinId,
      );

      await skinContract.safeMint(user.address);

      await skinContract
        .connect(user)
        .transferFrom(user.address, owner.address, 0);

      await expect(skinContract.safeMint(user.address)).to.be.revertedWith(
        'EarlyPassportSkin: user has already minted the skin',
      );
    });
  });

  describe('#setPassportIdThreshold', () => {
    it('reverts if called by non-owner', async () => {
      await expect(
        skinContract.connect(user).setPassportIdThreshold(1),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('sets the passport id threshold', async () => {
      await skinContract.setPassportIdThreshold(21);

      expect(await skinContract.passportIdThreshold()).to.eq(21);
    });
  });

  describe('#setBaseURI', () => {
    it('reverts if called by non-owner', async () => {
      await expect(
        skinContract.connect(user).setBaseURI('test'),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('sets the base URL', async () => {
      await skinContract.setBaseURI('test');

      expect(await skinContract.baseURI()).to.equal('test');
    });
  });
});
