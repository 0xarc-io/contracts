import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { CreditScoreTree } from '@src/MerkleTree';
import {
  MockSapphireCreditScoreFactory,
  SapphireCreditScore,
} from '@src/typings';
import { DefiPassport } from '@src/typings/DefiPassport';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  deployDefiPassport,
  deployArcProxy,
  deployMockSapphireCreditScore,
} from '../deployers';

describe('DefiPassport', () => {
  let defiPassport: DefiPassport;

  let creditScoreContract: SapphireCreditScore;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let userNoCreditScore: SignerWithAddress;
  let skinAddress: string;

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
    const creditScoreTree = new CreditScoreTree([
      ownerCreditScore,
      userCreditScore,
    ]);

    await creditScoreContract.init(
      creditScoreTree.getHexRoot(),
      owner.address,
      owner.address,
      1000,
    );
    await creditScoreContract.setPause(false);
  }

  before(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
    user = signers[1];
    userNoCreditScore = signers[2];
    skinAddress = await ethers.Wallet.createRandom().getAddress();

    _setupCreditScoreContract();

    defiPassport = await deployDefiPassport(owner);
    await defiPassport.init(
      'Defi Passport',
      'DefiPassport',
      creditScoreContract.address,
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#init', () => {
    it('reverts if called by non-admin', async () => {
      await expect(
        defiPassport.connect(user).init('a', 'b', creditScoreContract.address),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('sets the name and symbol of the NFT', async () => {
      const name = 'DeFi Passport';
      const symbol = 'DefiPassport';

      const _defiPassport = await deployDefiPassport(owner);

      await _defiPassport.init(name, symbol, creditScoreContract.address);

      expect(await _defiPassport.name()).to.eq(name);
      expect(await _defiPassport.symbol()).to.eq(symbol);
    });

    it('reverts if called a second time', async () => {
      await expect(
        defiPassport.init('a', 'b', creditScoreContract.address),
      ).to.be.revertedWith('Initializable: contract is already initialized');
    });
  });

  // mint(address to, address skin)
  describe('#mint', () => {
    it('reverts if the receiver has no credit score', async () => {
      await defiPassport.approveSkin(skinAddress);

      await expect(
        defiPassport.mint(userNoCreditScore.address, skinAddress),
      ).to.be.revertedWith('DefiPassport: the user has no credit score');
    });

    it('reverts if the skin is not approved', async () => {
      await expect(
        defiPassport.mint(user.address, skinAddress),
      ).to.be.revertedWith('DefiPassport: the skin is not approved');
    });

    it('mints the passport to the receiver', async () => {
      await defiPassport.approveSkin(skinAddress);

      await defiPassport.mint(user.address, skinAddress);

      expect(await defiPassport.balanceOf(user.address)).to.eq(1);
      expect(await defiPassport.tokenURI(1)).to.eq(skinAddress);
    });

    it('reverts if the receiver already has a passport', async () => {
      await defiPassport.approveSkin(skinAddress);

      await defiPassport.mint(user.address, skinAddress);

      await expect(
        defiPassport.mint(user.address, skinAddress),
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
