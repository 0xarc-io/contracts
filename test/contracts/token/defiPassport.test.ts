import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { CreditScoreTree } from '@src/MerkleTree';
import { SapphireCreditScore } from '@src/typings';
import { MockDefiPassport } from '@src/typings/MockDefiPassport';
import { getScoreProof } from '@src/utils';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  deployMockDefiPassport,
  deployMockSapphireCreditScore,
} from '../deployers';

describe('DefiPassport', () => {
  let defiPassport: MockDefiPassport;

  let creditScoreContract: SapphireCreditScore;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let userNoCreditScore: SignerWithAddress;
  let skinManager: SignerWithAddress;
  let skinAddress: string;
  const skinTokenId = BigNumber.from(21);

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

  before(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
    user = signers[1];
    userNoCreditScore = signers[2];
    skinManager = signers[3];
    skinAddress = await ethers.Wallet.createRandom().getAddress();

    await _setupCreditScoreContract();

    defiPassport = await deployMockDefiPassport(owner);
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

      const _defiPassport = await deployMockDefiPassport(owner);

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

  // mint(address to, address skin)
  describe('#mint', () => {
    it('reverts if the receiver has no credit score', async () => {
      await defiPassport.connect(skinManager).approveSkin(skinAddress);

      await expect(
        defiPassport.mint(userNoCreditScore.address, skinAddress, skinTokenId),
      ).to.be.revertedWith('DefiPassport: the user has no credit score');
    });

    it('reverts if the skin is not approved', async () => {
      await expect(
        defiPassport.mint(user.address, skinAddress, skinTokenId),
      ).to.be.revertedWith('DefiPassport: the skin is not approved');
    });

    it('reverts if the receiver is not the skin owner', async () => {
      await defiPassport.connect(skinManager).approveSkin(skinAddress);

      await expect(
        defiPassport.mint(user.address, skinAddress, skinTokenId),
      ).to.be.revertedWith('DefiPassport: the receiver does not own the skin');
    });

    it('mints the passport to the receiver', async () => {
      await defiPassport.connect(skinManager).approveSkin(skinAddress);
      await defiPassport.setSkinOwner(skinAddress, skinTokenId, user.address);

      await defiPassport.mint(user.address, skinAddress, skinTokenId);

      // The token ID will be 1 since it's the first one minted
      const tokenId = 1;

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
      await defiPassport.connect(skinManager).approveSkin(skinAddress);
      await defiPassport.setSkinOwner(skinAddress, skinTokenId, user.address);

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
    it('reverts if called by non-skin-manager', async () => {
      await expect(defiPassport.approveSkin(skinAddress)).to.be.revertedWith(
        'DefiPassport: caller is not skin manager',
      );
    });

    it('adds the skin to the list of approved skins', async () => {
      expect(await defiPassport.approvedSkins(skinAddress)).to.be.false;

      await defiPassport.connect(skinManager).approveSkin(skinAddress);

      expect(await defiPassport.approvedSkins(skinAddress)).to.be.true;
    });
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
