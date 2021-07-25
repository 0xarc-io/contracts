import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { CreditScoreTree } from '@src/MerkleTree';
import {
  DefaultPassportSkin,
  DefiPassport,
  MintableNFT,
  MintableNFTFactory,
  MockSapphireCreditScore,
  SapphireCreditScore,
} from '@src/typings';
import { DefaultPassportSkinFactory } from '@src/typings/DefaultPassportSkinFactory';
import { getScoreProof } from '@src/utils';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  deployDefiPassport,
  deployMockSapphireCreditScore,
} from '../deployers';

describe('DefiPassport', () => {
  let defiPassport: DefiPassport;

  let creditScoreContract: SapphireCreditScore;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let userNoCreditScore: SignerWithAddress;
  let skinManager: SignerWithAddress;
  let defaultPassportSkinContract: DefaultPassportSkin;
  let defaultSkinAddress: string;
  let defaultSkinTokenId: BigNumber;
  let skinsContract: MintableNFT;
  let skinAddress: string;
  let skinTokenId: BigNumber;
  let otherSkinContract: MintableNFT;
  let otherSkinTokenId: BigNumber;

  let creditScoreTree: CreditScoreTree;

  async function _setupCreditScoreContract() {
    creditScoreContract = await deployMockSapphireCreditScore(owner);

    const ownerCreditScore = {
      account: owner.address,
      amount: BigNumber.from(500),
    };
    const userCreditScore = {
      account: user.address,
      amount: BigNumber.from(500),
    };
    creditScoreTree = new CreditScoreTree([ownerCreditScore, userCreditScore]);

    await creditScoreContract.init(
      creditScoreTree.getHexRoot(),
      owner.address,
      owner.address,
      1000,
    );
    await creditScoreContract.setPause(false);

    await creditScoreContract.verifyAndUpdate(
      getScoreProof(userCreditScore, creditScoreTree),
    );
  }

  async function _setupSkins() {
    skinsContract = await new MintableNFTFactory(owner).deploy(
      'Passport Skins',
      'PS',
    );
    skinAddress = skinsContract.address;

    skinTokenId = BigNumber.from(1);
    await skinsContract.mint(owner.address, skinTokenId);

    defaultPassportSkinContract = await new DefaultPassportSkinFactory(
      owner,
    ).deploy('Default passport skin nft', 'DPS');
    defaultSkinAddress = defaultPassportSkinContract.address;

    await defaultPassportSkinContract.mint(owner.address, '');
    defaultSkinTokenId = await defaultPassportSkinContract.tokenOfOwnerByIndex(
      owner.address,
      0,
    );
    otherSkinContract = await new MintableNFTFactory(owner).deploy(
      'Other Passport Skins',
      'OPS',
    );

    otherSkinTokenId = skinTokenId.add(1);
    await otherSkinContract.mint(owner.address, otherSkinTokenId);
  }

  /**
   * Helper function that mints a passport to the `user`
   */
  async function mintUserPassport() {
    await defiPassport.connect(skinManager).setApprovedSkin(skinAddress, skinTokenId, true);
    await skinsContract.transferFrom(owner.address, user.address, skinTokenId);

    await defiPassport.mint(user.address, skinAddress, skinTokenId);

    return defiPassport.tokenOfOwnerByIndex(user.address, 0);
  }

  before(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
    user = signers[1];
    userNoCreditScore = signers[2];
    skinManager = signers[3];

    await _setupSkins();

    await _setupCreditScoreContract();

    defiPassport = await deployDefiPassport(owner);
    await defiPassport.init(
      'Defi Passport',
      'DefiPassport',
      creditScoreContract.address,
      skinManager.address,
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#init', () => {
    it('reverts if called by non-admin', async () => {
      await expect(
        defiPassport
          .connect(user)
          .init('a', 'b', creditScoreContract.address, skinManager.address),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('sets the name and symbol of the NFT', async () => {
      const name = 'DeFi Passport';
      const symbol = 'DefiPassport';

      const _defiPassport = await deployDefiPassport(owner);

      await _defiPassport.init(
        name,
        symbol,
        creditScoreContract.address,
        skinManager.address,
      );

      expect(await _defiPassport.name()).to.eq(name);
      expect(await _defiPassport.symbol()).to.eq(symbol);
    });

    it('reverts if called a second time', async () => {
      await expect(
        defiPassport.init(
          'a',
          'b',
          creditScoreContract.address,
          skinManager.address,
        ),
      ).to.be.revertedWith('Initializable: contract is already initialized');
    });
  });

  describe('#mint', () => {
    it('reverts if the receiver has no credit score', async () => {
      await defiPassport
        .connect(skinManager)
        .setApprovedSkin(skinAddress,skinTokenId,  true);

      await expect(
        defiPassport.mint(userNoCreditScore.address, skinAddress, skinTokenId),
      ).to.be.revertedWith('DefiPassport: the user has no credit score');
    });

    it('reverts if the skin is not approved', async () => {
      await expect(
        defiPassport.mint(user.address, skinAddress, skinTokenId),
      ).to.be.revertedWith('DefiPassport: invalid skin');
    });

    it('reverts if the receiver is not the skin owner', async () => {
      await defiPassport
        .connect(skinManager)
        .setApprovedSkin(skinAddress,skinTokenId,  true);

      await expect(
        defiPassport.mint(user.address, skinAddress, skinTokenId),
      ).to.be.revertedWith('DefiPassport: invalid skin');
    });

    // skin addy is valid but token id is not
    it('reverts if minting with a default skin that does not exist', async () => {
      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultSkinAddress, true);

      await expect(
        defiPassport.mint(
          user.address,
          defaultSkinAddress,
          BigNumber.from(420),
        ),
      ).to.be.revertedWith('ERC721: owner query for nonexistent token');
    });

    it('mints the passport to the receiver with a default skin', async () => {
      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultSkinAddress, true);

      await defiPassport.mint(
        user.address,
        defaultSkinAddress,
        defaultSkinTokenId,
      );

      const tokenId = await defiPassport.tokenOfOwnerByIndex(user.address, 0);

      expect(await defiPassport.balanceOf(user.address)).to.eq(1);
      expect(await defiPassport.tokenURI(tokenId)).to.eq(
        user.address.slice(2).toLowerCase(),
      );
    });

    it('mints the passport to the receiver with an owned skin', async () => {
      await defiPassport
        .connect(skinManager)
        .setApprovedSkin(skinAddress,skinTokenId,  true);
      await skinsContract.transferFrom(
        owner.address,
        user.address,
        skinTokenId,
      );

      await defiPassport.mint(user.address, skinAddress, skinTokenId);

      const tokenId = await defiPassport.tokenOfOwnerByIndex(user.address, 0);

      expect(await defiPassport.balanceOf(user.address)).to.eq(1);
      expect(await defiPassport.tokenURI(tokenId)).to.eq(
        user.address.slice(2).toLowerCase(),
      );

      const activeSkinRes = await defiPassport.activeSkins(tokenId);
      const activeSkin = {
        skin: activeSkinRes[0],
        skinTokenId: activeSkinRes[1],
      };
      expect(activeSkin).to.deep.eq({
        skin: skinAddress,
        skinTokenId,
      });
    });

    it('reverts if the receiver already has a passport', async () => {
      await defiPassport
        .connect(skinManager)
        .setApprovedSkin(skinAddress,skinTokenId,  true);
      await skinsContract.transferFrom(
        owner.address,
        user.address,
        skinTokenId,
      );

      await defiPassport.mint(user.address, skinAddress, skinTokenId);

      await expect(
        defiPassport.mint(user.address, skinAddress, skinTokenId),
      ).to.be.revertedWith('DefiPassport: user already has a defi passport');
    });
  });

  describe('#setBaseURI', () => {
    it('reverts if called by non-admin', async () => {
      await expect(
        defiPassport.connect(user).setBaseURI('test'),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('sets the base URI of tokens', async () => {
      const uri = 'https://test.com/defipassport';

      await defiPassport.setBaseURI(uri);

      expect(await defiPassport.baseURI()).to.eq(uri);
    });
  });

  describe('#setActiveSkin', () => {
    let passportId: BigNumber;

    beforeEach(async () => {
      passportId = await mintUserPassport();

    });

    it('reverts if caller has no passport', async () => {
      await expect(
        defiPassport.setActiveSkin(skinAddress, skinTokenId),
      ).to.be.revertedWith('DefiPassport: caller has no passport');
    });

    it('reverts if caller does not own the specified skin', async () => {
      await expect(
        defiPassport
          .connect(user)
          .setActiveSkin(otherSkinContract.address, otherSkinTokenId),
      ).to.be.revertedWith('DefiPassport: invalid skin');
    });

    it('reverts if the skin is not approved nor default', async () => {
      await otherSkinContract.transferFrom(
        owner.address,
        user.address,
        otherSkinTokenId,
      );

      await expect(
        defiPassport
          .connect(user)
          .setActiveSkin(otherSkinContract.address, otherSkinTokenId),
      ).to.be.revertedWith('DefiPassport: invalid skin');
    });

    it('reverts if the skin address is approved but has different id', async () => {
      const activeSkinRecord = await defiPassport.activeSkins(passportId);
      expect(activeSkinRecord.skin).to.eq(skinAddress);
      expect(activeSkinRecord.skinTokenId).to.eq(skinTokenId);

      await skinsContract.mint(user.address, skinTokenId.add(1));

      await expect(
        defiPassport
          .connect(user)
          .setActiveSkin(skinsContract.address, skinTokenId.add(1)),
      ).to.be.revertedWith('DefiPassport: invalid skin');
    });

    it('sets the skin if it is owned and approved', async () => {
      let activeSkinRecord = await defiPassport.activeSkins(passportId);
      expect(activeSkinRecord.skin).to.eq(skinAddress);
      expect(activeSkinRecord.skinTokenId).to.eq(skinTokenId);

      await defiPassport
        .connect(skinManager)
        .setApprovedSkin(otherSkinContract.address, otherSkinTokenId, true);

      expect(await defiPassport.approvedSkins(otherSkinContract.address, otherSkinTokenId)).to.be
        .true;

      await otherSkinContract.transferFrom(
        owner.address,
        user.address,
        otherSkinTokenId,
      );

      await defiPassport
        .connect(user)
        .setActiveSkin(otherSkinContract.address, otherSkinTokenId);

      activeSkinRecord = await defiPassport.activeSkins(passportId);
      expect(activeSkinRecord.skin).to.eq(otherSkinContract.address);
      expect(activeSkinRecord.skinTokenId).to.eq(otherSkinTokenId);
    });

    it('sets the same skin but different skin token ID', async () => {
      let activeSkinRecord = await defiPassport.activeSkins(passportId);
      expect(activeSkinRecord.skin).to.eq(skinAddress);
      expect(activeSkinRecord.skinTokenId).to.eq(skinTokenId);

      await skinsContract.mint(user.address, 2);

      
      await defiPassport
        .connect(skinManager)
        .setApprovedSkin(skinsContract.address, 2, true);
      await defiPassport.connect(user).setActiveSkin(skinsContract.address, 2);

      activeSkinRecord = await defiPassport.activeSkins(passportId);
      expect(activeSkinRecord.skin).to.eq(skinsContract.address);
      expect(activeSkinRecord.skinTokenId).to.eq(2);
    });

    it('sets a default skin even if it is not owned by the user', async () => {
      let activeSkinRecord = await defiPassport.activeSkins(passportId);
      expect(activeSkinRecord.skin).to.eq(skinAddress);
      expect(activeSkinRecord.skinTokenId).to.eq(skinTokenId);

      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultPassportSkinContract.address, true);
      await defiPassport
        .connect(user)
        .setActiveSkin(defaultPassportSkinContract.address, defaultSkinTokenId);

      activeSkinRecord = await defiPassport.activeSkins(passportId);
      expect(activeSkinRecord.skin).to.eq(defaultPassportSkinContract.address);
      expect(activeSkinRecord.skinTokenId).to.eq(defaultSkinTokenId);
    });
  });

  describe('#isSkinAvailable', () => {
    it('reverts if the skin does not exist', async () => {
      await expect(
        defiPassport.isSkinAvailable(user.address, skinAddress, 21),
      ).to.be.revertedWith('ERC721: owner query for nonexistent token');
    });

    it('returns false if the skin is not a default skin', async () => {
      expect(await defiPassport.isSkinAvailable(owner.address, skinAddress, 1))
        .to.be.false;
    });

    it('returns true if the skin is registered as a default skin', async () => {
      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultSkinAddress, true);

      expect(
        await defiPassport.isSkinAvailable(
          owner.address,
          defaultSkinAddress,
          1,
        ),
      ).to.be.true;
    });

    it('returns false if the skin is approved but not owned by the user', async () => {
      await defiPassport
        .connect(skinManager)
        .setApprovedSkin(skinAddress,skinTokenId,  true);

      expect(await defiPassport.isSkinAvailable(user.address, skinAddress, 1))
        .to.be.false;
    });

    it('returns true if the skin is approved and owned by the user', async () => {
      await defiPassport.connect(skinManager).setDefaultSkin(skinAddress, true);

      expect(await defiPassport.isSkinAvailable(owner.address, skinAddress, 1))
        .to.be.true;
    });
  });

  describe('#setSkinManager', () => {
    it('reverts if called by non-admin', async () => {
      await expect(
        defiPassport.connect(user).setSkinManager(user.address),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('reverts if sets the same skin manager', async () => {
      await expect(
        defiPassport.setSkinManager(skinManager.address),
      ).to.be.revertedWith(
        'DefiPassport: the same skin manager is already set',
      );
    });

    it('sets the skin manager if called by admin', async () => {
      expect(await defiPassport.skinManager()).to.eq(skinManager.address);

      await defiPassport.setSkinManager(owner.address);

      expect(await defiPassport.skinManager()).to.eq(owner.address);
    });
  });

  describe('#setApprovedSkin', () => {
    it('reverts if called by non-skin-manager', async () => {
      await expect(
        defiPassport.setApprovedSkin(skinAddress, skinTokenId, false),
      ).to.be.revertedWith('DefiPassport: caller is not skin manager');
    });

    it('approves the skin', async () => {
      expect(await defiPassport.approvedSkins(skinAddress, skinTokenId)).to.be.false;

      await defiPassport
        .connect(skinManager)
        .setApprovedSkin(skinAddress,skinTokenId,  true);

      expect(await defiPassport.approvedSkins(skinAddress, skinTokenId)).to.be.true;
      expect(await defiPassport.approvedSkins(skinAddress, otherSkinTokenId)).to.be.false;
    });
  });

  describe('#setDefaultSkin', () => {
    it('reverts if called by non-skin-manager', async () => {
      await expect(
        defiPassport.setDefaultSkin(defaultSkinAddress, true),
      ).to.be.revertedWith('DefiPassport: caller is not skin manager');
    });

    it('toggles skins as default', async () => {
      expect(await defiPassport.defaultSkins(defaultSkinAddress)).to.be.false;

      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultSkinAddress, true);

      expect(await defiPassport.defaultSkins(defaultSkinAddress)).to.be.true;

      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultSkinAddress, false);

      expect(await defiPassport.defaultSkins(defaultSkinAddress)).to.be.false;
    });
  });

  describe('#setCreditScoreContract', () => {
    let otherCreditScoreContract: MockSapphireCreditScore;

    beforeEach(async () => {
      otherCreditScoreContract = await deployMockSapphireCreditScore(owner);
    });

    it('reverts if called by non-admin', async () => {
      await expect(
        defiPassport
          .connect(user)
          .setCreditScoreContract(otherCreditScoreContract.address),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('sets the credit score contract if called by admin', async () => {
      expect(await defiPassport.creditScoreContract()).to.eq(
        creditScoreContract.address,
      );

      await defiPassport.setCreditScoreContract(
        otherCreditScoreContract.address,
      );
    });
  });

  describe('#approve', () => {
    it('reverts - defi passports are not transferrable', async () => {
      const tokenId = await mintUserPassport();

      await expect(
        defiPassport.connect(user).approve(owner.address, tokenId),
      ).to.be.revertedWith(
        'DefiPassport: defi passports are not transferrable',
      );
    });
  });

  describe('#transferFrom', () => {
    it('reverts - defi passports are not transferrable', async () => {
      const tokenId = await mintUserPassport();

      await expect(
        defiPassport
          .connect(user)
          .transferFrom(user.address, owner.address, tokenId),
      ).to.be.revertedWith(
        'DefiPassport: defi passports are not transferrable',
      );
    });
  });

  describe('#safeTransferFrom(from, to, tokenId)', () => {
    it('reverts - defi passports are not transferrable', async () => {
      const tokenId = await mintUserPassport();

      await expect(
        defiPassport
          .connect(user)
          ['safeTransferFrom(address,address,uint256)'](
            user.address,
            owner.address,
            tokenId,
          ),
      ).to.be.revertedWith(
        'DefiPassport: defi passports are not transferrable',
      );
    });
  });

  describe('#safeTransferFrom(from, to, tokenId, _data)', () => {
    it('reverts - defi passports are not transferrable', async () => {
      const tokenId = await mintUserPassport();

      await expect(
        defiPassport
          .connect(user)
          ['safeTransferFrom(address,address,uint256,bytes)'](
            user.address,
            owner.address,
            tokenId,
            [],
          ),
      ).to.be.revertedWith(
        'DefiPassport: defi passports are not transferrable',
      );
    });
  });

  describe('#setApprovalForAll', () => {
    it('reverts - defi passports are not transferrable', async () => {
      await expect(
        defiPassport.connect(user).setApprovalForAll(owner.address, true),
      ).to.be.revertedWith(
        'DefiPassport: defi passports are not transferrable',
      );
    });
  });
});
