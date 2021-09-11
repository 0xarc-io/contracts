import { PassportScore } from '@arc-types/sapphireCore';
import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { PassportScoreTree } from '@src/MerkleTree';
import {
  ArcProxyFactory,
  DefaultPassportSkin,
  DefiPassport,
  DefiPassportFactory,
  MintableNFT,
  MintableNFTFactory,
  MockSapphirePassportScores,
  SapphirePassportScores,
  SapphirePassportScoresFactory,
} from '@src/typings';
import { DefaultPassportSkinFactory } from '@src/typings/DefaultPassportSkinFactory';
import { getEmptyScoreProof, getScoreProof } from '@src/utils';
import { DEFAULT_PROOF_PROTOCOL } from '@test/helpers/sapphireDefaults';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { MockProvider } from 'ethereum-waffle';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import {
  deployDefiPassport,
  deployMockSapphirePassportScores,
} from '../deployers';

type TokenIdStatus = {
  tokenId: BigNumber;
  status: boolean;
};

type SkinAndTokenIdStatusRecord = {
  skin: string;
  skinTokenIdStatuses: TokenIdStatus[];
};

const OTHER_PROTOCOL = 'defi.other';

describe('DefiPassport', () => {
  let defiPassport: DefiPassport;

  let creditScoreContract: SapphirePassportScores;
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

  let creditScoreTree: PassportScoreTree;
  let ownerCreditScore: PassportScore;
  let userCreditScore: PassportScore;

  async function _setupCreditScoreContract() {
    creditScoreContract = await deployMockSapphirePassportScores(owner);

    ownerCreditScore = {
      account: owner.address,
      protocol: OTHER_PROTOCOL,
      score: BigNumber.from(500),
    };
    userCreditScore = {
      account: user.address,
      protocol: DEFAULT_PROOF_PROTOCOL,
      score: BigNumber.from(500),
    };
    creditScoreTree = new PassportScoreTree([
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
    otherSkinTokenId = BigNumber.from(1);
    await otherSkinContract.mint(owner.address, otherSkinTokenId);
  }

  async function validateApprovedSkins(
    skinsToApprove: SkinAndTokenIdStatusRecord[],
  ) {
    for (let i = 0; i < skinsToApprove.length; i++) {
      const record = skinsToApprove[i];

      for (let j = 0; j < record.skinTokenIdStatuses.length; j++) {
        const approvedStatus = await defiPassport.approvedSkins(
          record.skin,
          record.skinTokenIdStatuses[j].tokenId,
        );

        if (approvedStatus !== record.skinTokenIdStatuses[j].status) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Helper function that mints a passport to the `user`
   */
  async function mintUserPassport() {
    await defiPassport
      .connect(skinManager)
      .setApprovedSkin(skinAddress, skinTokenId, true);
    await skinsContract.transferFrom(owner.address, user.address, skinTokenId);

    await defiPassport.mint(
      user.address,
      skinAddress,
      skinTokenId,
      getScoreProof(userCreditScore, creditScoreTree),
    );

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

    await defiPassport.setProofProtocol(DEFAULT_PROOF_PROTOCOL);
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
    it(`reverts if proof is not the receiver's`, async () => {
      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultSkinAddress, true);

      await expect(
        defiPassport.mint(
          userNoCreditScore.address,
          defaultSkinAddress,
          defaultSkinTokenId,
          getScoreProof(userCreditScore, creditScoreTree),
        ),
      ).to.be.revertedWith(
        'DefiPassport: the proof must correspond to the receiver',
      );
    });

    it('reverts if the score proof does not correspond to the proof protocol', async () => {
      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultSkinAddress, true);

      await expect(
        defiPassport.mint(
          ownerCreditScore.account,
          defaultSkinAddress,
          defaultSkinTokenId,
          getScoreProof(ownerCreditScore, creditScoreTree),
        ),
      ).to.be.revertedWith('DefiPassport: invalid proof protocol');
    });

    it('reverts if the receiver has no credit score', async () => {
      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultSkinAddress, true);

      await expect(
        defiPassport.mint(
          userNoCreditScore.address,
          defaultSkinAddress,
          defaultSkinTokenId,
          getEmptyScoreProof(userNoCreditScore.address, DEFAULT_PROOF_PROTOCOL),
        ),
      ).to.be.revertedWith('SapphirePassportScores: invalid proof');
    });

    it('reverts if the skin is not approved', async () => {
      await expect(
        defiPassport.mint(
          user.address,
          skinAddress,
          skinTokenId,
          getScoreProof(userCreditScore, creditScoreTree),
        ),
      ).to.be.revertedWith('DefiPassport: invalid skin');
    });

    it('reverts if the receiver is not the skin owner', async () => {
      await defiPassport
        .connect(skinManager)
        .setApprovedSkin(skinAddress, skinTokenId, true);

      await expect(
        defiPassport.mint(
          user.address,
          skinAddress,
          skinTokenId,
          getScoreProof(userCreditScore, creditScoreTree),
        ),
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
          getScoreProof(userCreditScore, creditScoreTree),
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
        getScoreProof(userCreditScore, creditScoreTree),
      );

      const tokenId = await defiPassport.tokenOfOwnerByIndex(user.address, 0);

      expect(await defiPassport.balanceOf(user.address)).to.eq(1);
      expect(await defiPassport.tokenURI(tokenId)).to.eq(
        user.address.toLowerCase(),
      );
    });

    it('mints the passport to the receiver with an owned skin', async () => {
      await defiPassport
        .connect(skinManager)
        .setApprovedSkin(skinAddress, skinTokenId, true);
      await skinsContract.transferFrom(
        owner.address,
        user.address,
        skinTokenId,
      );

      await defiPassport.mint(
        user.address,
        skinAddress,
        skinTokenId,
        getScoreProof(userCreditScore, creditScoreTree),
      );

      const tokenId = await defiPassport.tokenOfOwnerByIndex(user.address, 0);

      expect(await defiPassport.balanceOf(user.address)).to.eq(1);
      expect(await defiPassport.tokenURI(tokenId)).to.eq(
        user.address.toLowerCase(),
      );

      const activeSkinRes = await defiPassport.getActiveSkin(tokenId);
      const activeSkin = {
        owner: activeSkinRes[0],
        skin: activeSkinRes[1],
        skinTokenId: activeSkinRes[2],
      };
      expect(activeSkin).to.deep.eq({
        owner: user.address,
        skin: skinAddress,
        skinTokenId,
      });
    });

    it('reverts if the receiver already has a passport', async () => {
      await defiPassport
        .connect(skinManager)
        .setApprovedSkin(skinAddress, skinTokenId, true);
      await skinsContract.transferFrom(
        owner.address,
        user.address,
        skinTokenId,
      );

      await defiPassport.mint(
        user.address,
        skinAddress,
        skinTokenId,
        getScoreProof(userCreditScore, creditScoreTree),
      );

      await expect(
        defiPassport.mint(
          user.address,
          skinAddress,
          skinTokenId,
          getScoreProof(userCreditScore, creditScoreTree),
        ),
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

    it('it is included in the token URI', async () => {
      const uri = 'https://test.com/defipassport/';

      await defiPassport.setBaseURI(uri);

      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultSkinAddress, true);

      await defiPassport.mint(
        user.address,
        defaultSkinAddress,
        defaultSkinTokenId,
        getScoreProof(userCreditScore, creditScoreTree),
      );

      const tokenId = await defiPassport.tokenOfOwnerByIndex(user.address, 0);

      expect(await defiPassport.tokenURI(tokenId)).to.eq(
        uri + user.address.toLowerCase(),
      );
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
      const activeSkinRecord = await defiPassport.getActiveSkin(passportId);
      expect(activeSkinRecord.skin).to.eq(skinAddress);
      expect(activeSkinRecord.skinTokenId).to.eq(skinTokenId);

      await skinsContract.mint(user.address, skinTokenId.add(1));

      await expect(
        defiPassport
          .connect(user)
          .setActiveSkin(skinsContract.address, skinTokenId.add(1)),
      ).to.be.revertedWith('DefiPassport: invalid skin');
    });

    it('reverts if the skin contract is whitelisted but the caller is not the owner of the token id', async () => {
      await defiPassport
        .connect(skinManager)
        .setWhitelistedSkin(otherSkinContract.address, true);
      expect(await defiPassport.whitelistedSkins(otherSkinContract.address)).to
        .be.true;

      await expect(
        defiPassport
          .connect(user)
          .setActiveSkin(otherSkinContract.address, otherSkinTokenId),
      ).to.be.revertedWith('DefiPassport: invalid skin');
    });

    it('sets the skin if it is owned and approved', async () => {
      let activeSkinRecord = await defiPassport.getActiveSkin(passportId);
      expect(activeSkinRecord.skin).to.eq(skinAddress);
      expect(activeSkinRecord.skinTokenId).to.eq(skinTokenId);

      await defiPassport
        .connect(skinManager)
        .setApprovedSkin(otherSkinContract.address, otherSkinTokenId, true);

      expect(
        await defiPassport.approvedSkins(
          otherSkinContract.address,
          otherSkinTokenId,
        ),
      ).to.be.true;

      await otherSkinContract.transferFrom(
        owner.address,
        user.address,
        otherSkinTokenId,
      );

      await defiPassport
        .connect(user)
        .setActiveSkin(otherSkinContract.address, otherSkinTokenId);

      activeSkinRecord = await defiPassport.getActiveSkin(passportId);
      expect(activeSkinRecord.skin).to.eq(otherSkinContract.address);
      expect(activeSkinRecord.skinTokenId).to.eq(otherSkinTokenId);
    });

    it('sets the skin and transfer it afterwards', async () => {
      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultPassportSkinContract.address, true);

      let activeSkinRecord = await defiPassport.getActiveSkin(passportId);
      expect(activeSkinRecord.skin).to.eq(skinAddress);
      expect(activeSkinRecord.skinTokenId).to.eq(skinTokenId);

      await defiPassport
        .connect(skinManager)
        .setApprovedSkin(otherSkinContract.address, otherSkinTokenId, true);

      expect(
        await defiPassport.approvedSkins(
          otherSkinContract.address,
          otherSkinTokenId,
        ),
      ).to.be.true;

      await otherSkinContract.transferFrom(
        owner.address,
        user.address,
        otherSkinTokenId,
      );

      await defiPassport
        .connect(user)
        .setActiveSkin(otherSkinContract.address, otherSkinTokenId);

      activeSkinRecord = await defiPassport.getActiveSkin(passportId);
      expect(activeSkinRecord.skin).to.eq(otherSkinContract.address);
      expect(activeSkinRecord.skinTokenId).to.eq(otherSkinTokenId);

      await otherSkinContract
        .connect(user)
        .transferFrom(user.address, owner.address, otherSkinTokenId);

      activeSkinRecord = await defiPassport.getActiveSkin(passportId);
      expect(activeSkinRecord.skin).to.eq(defaultSkinAddress);
      expect(activeSkinRecord.skinTokenId).to.eq(defaultSkinTokenId);
    });

    it('sets the same skin but different skin token ID', async () => {
      let activeSkinRecord = await defiPassport.getActiveSkin(passportId);
      expect(activeSkinRecord.skin).to.eq(skinAddress);
      expect(activeSkinRecord.skinTokenId).to.eq(skinTokenId);

      await skinsContract.mint(user.address, 2);

      await defiPassport
        .connect(skinManager)
        .setApprovedSkin(skinsContract.address, 2, true);
      await defiPassport.connect(user).setActiveSkin(skinsContract.address, 2);

      activeSkinRecord = await defiPassport.getActiveSkin(passportId);
      expect(activeSkinRecord.skin).to.eq(skinsContract.address);
      expect(activeSkinRecord.skinTokenId).to.eq(2);
    });

    it('sets a default skin even if it is not owned by the user', async () => {
      let activeSkinRecord = await defiPassport.getActiveSkin(passportId);
      expect(activeSkinRecord.skin).to.eq(skinAddress);
      expect(activeSkinRecord.skinTokenId).to.eq(skinTokenId);

      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultPassportSkinContract.address, true);
      await defiPassport
        .connect(user)
        .setActiveSkin(defaultPassportSkinContract.address, defaultSkinTokenId);

      activeSkinRecord = await defiPassport.getActiveSkin(passportId);
      expect(activeSkinRecord.skin).to.eq(defaultPassportSkinContract.address);
      expect(activeSkinRecord.skinTokenId).to.eq(defaultSkinTokenId);
    });

    it('sets the skin if it is whitelisted and owned even if it was not approved', async () => {
      await defiPassport
        .connect(skinManager)
        .setWhitelistedSkin(otherSkinContract.address, true);

      await otherSkinContract.transferFrom(
        owner.address,
        user.address,
        otherSkinTokenId,
      );

      let activeSkinRecord = await defiPassport.getActiveSkin(passportId);
      expect(activeSkinRecord.skin).to.eq(skinAddress);
      expect(activeSkinRecord.skinTokenId).to.eq(skinTokenId);

      await defiPassport
        .connect(user)
        .setActiveSkin(otherSkinContract.address, otherSkinTokenId);

      activeSkinRecord = await defiPassport.getActiveSkin(passportId);
      expect(activeSkinRecord.skin).to.eq(otherSkinContract.address);
      expect(activeSkinRecord.skinTokenId).to.eq(otherSkinTokenId);
    });
  });

  describe('#isSkinAvailable', () => {
    it('returns false if skin does not exist', async () => {
      expect(await defiPassport.isSkinAvailable(user.address, skinAddress, 21))
        .to.be.false;
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
        .setApprovedSkin(skinAddress, skinTokenId, true);

      expect(await defiPassport.isSkinAvailable(user.address, skinAddress, 1))
        .to.be.false;
    });

    it('returns true if the skin is approved and owned by the user', async () => {
      await defiPassport.connect(skinManager).setDefaultSkin(skinAddress, true);

      expect(await defiPassport.isSkinAvailable(owner.address, skinAddress, 1))
        .to.be.true;
    });

    it('returns true if a skin is an ERC1155', async () => {
      const provider = new MockProvider({
        ganacheOptions: {
          fork: process.env.GANACHE_FORK_URL,
          fork_block_number: 13089257,
        },
      });

      const signer = provider.getSigner();
      const cs = await new SapphirePassportScoresFactory(signer).deploy();
      const impl = await new DefiPassportFactory(signer).deploy();

      const proxy = await new ArcProxyFactory(signer).deploy(
        impl.address,
        await signer.getAddress(),
        [],
      );
      const dp = DefiPassportFactory.connect(proxy.address, signer);
      await dp.init('DFP', 'DFP', cs.address, await signer.getAddress());

      const skinContract = '0x495f947276749Ce646f68AC8c248420045cb7b5e';
      const skinTokenId =
        '75685692659921132146541619680153300115128635339872877657167321720357472174081';
      const expectedOwner = '0x2f45724d7e384b38d5c97206e78470544304887f';

      expect(
        await dp.isSkinAvailable(expectedOwner, skinContract, skinTokenId),
        'skin not yet approved',
      ).to.be.false;

      await dp.setApprovedSkin(
        '0x495f947276749Ce646f68AC8c248420045cb7b5e',
        BigNumber.from(
          '75685692659921132146541619680153300115128635339872877657167321720357472174081',
        ),
        true,
      );

      expect(
        await dp.approvedSkins(skinContract, skinTokenId),
        'approved skin',
      );

      expect(
        await dp.isSkinAvailable(expectedOwner, skinContract, skinTokenId),
        'skin available for user',
      ).to.be.true;
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

  describe('#setWhitelistedSkin', () => {
    it('reverts if called by non-skin-manager', async () => {
      await expect(
        defiPassport
          .connect(user)
          .setWhitelistedSkin(otherSkinContract.address, true),
      ).to.be.revertedWith('DefiPassport: caller is not skin manager');
    });

    it('reverts if address is not a contract', async () => {
      await expect(
        defiPassport
          .connect(skinManager)
          .setWhitelistedSkin(user.address, true),
      ).to.be.revertedWith('DefiPassport: address is not a contract');
    });

    it('adds/removes the skin to the mapping of whitelisted skins', async () => {
      const smDefiPassport = defiPassport.connect(skinManager);

      expect(await defiPassport.whitelistedSkins(otherSkinContract.address)).to
        .be.false;
      expect(await defiPassport.whitelistedSkins(skinsContract.address)).to.be
        .false;

      await smDefiPassport.setWhitelistedSkin(otherSkinContract.address, true);
      expect(await defiPassport.whitelistedSkins(otherSkinContract.address)).to
        .be.true;
      expect(await defiPassport.whitelistedSkins(skinsContract.address)).to.be
        .false;

      await smDefiPassport.setWhitelistedSkin(skinsContract.address, true);
      expect(await defiPassport.whitelistedSkins(skinsContract.address)).to.be
        .true;

      await smDefiPassport.setWhitelistedSkin(skinsContract.address, false);
      expect(await defiPassport.whitelistedSkins(skinsContract.address)).to.be
        .false;
    });
  });

  describe('#setApprovedSkin', () => {
    it('reverts if called by non-skin-manager', async () => {
      await expect(
        defiPassport.setApprovedSkin(skinAddress, skinTokenId, false),
      ).to.be.revertedWith('DefiPassport: caller is not skin manager');
    });

    it('approves the skin', async () => {
      expect(await defiPassport.approvedSkins(skinAddress, skinTokenId)).to.be
        .false;

      await defiPassport
        .connect(skinManager)
        .setApprovedSkin(skinAddress, skinTokenId, true);

      expect(await defiPassport.approvedSkins(skinAddress, skinTokenId)).to.be
        .true;
      expect(await defiPassport.approvedSkins(skinAddress, skinTokenId.add(1)))
        .to.be.false;
    });
  });

  describe('#setApprovedSkins', () => {
    it('reverts if called by non-skin-manager', async () => {
      const skinsToApprove: SkinAndTokenIdStatusRecord[] = [
        {
          skin: otherSkinContract.address,
          skinTokenIdStatuses: [{ tokenId: otherSkinTokenId, status: true }],
        },
      ];

      await expect(
        defiPassport.connect(user).setApprovedSkins(skinsToApprove),
      ).to.be.revertedWith('DefiPassport: caller is not skin manager');
    });

    it('sets the approved status correctly to multiple skins', async () => {
      const skinsToApprove: SkinAndTokenIdStatusRecord[] = [];

      // Mint many NFT contracts and tokens
      for (let i = BigNumber.from(0); i.lt(4); i = i.add(1)) {
        const contract = await new MintableNFTFactory(owner).deploy(
          `Skin ${i.toString()}`,
          i.toString(),
        );

        const record: SkinAndTokenIdStatusRecord = {
          skin: contract.address,
          skinTokenIdStatuses: [],
        };

        for (let j = BigNumber.from(0); j.lt(4); j = j.add(1)) {
          await contract.mint(owner.address, j);
          record.skinTokenIdStatuses.push({ tokenId: j, status: true });
        }

        skinsToApprove.push(record);
      }

      // Ensure all skins are indeed not approved
      expect(await validateApprovedSkins(skinsToApprove)).to.be.false;

      // Approve them all at once
      await defiPassport.connect(skinManager).setApprovedSkins(skinsToApprove);

      // Confirm they are all approved
      expect(await validateApprovedSkins(skinsToApprove)).to.be.true;

      // Change the status of half the tokenIDs
      for (let i = 0; i < skinsToApprove.length; i++) {
        const record = skinsToApprove[i];

        for (let j = 0; j < record.skinTokenIdStatuses.length; j++) {
          record.skinTokenIdStatuses[j].status = j % 2 == 0;
        }
      }

      await defiPassport.connect(skinManager).setApprovedSkins(skinsToApprove);

      // Validate again
      expect(await validateApprovedSkins(skinsToApprove)).to.be.true;
    });
  });

  describe('#setDefaultSkin', () => {
    it('reverts if called by non-skin-manager', async () => {
      await expect(
        defiPassport.setDefaultSkin(defaultSkinAddress, true),
      ).to.be.revertedWith('DefiPassport: caller is not skin manager');
    });

    it('reverts if default token does not have token id eq 1', async () => {
      const otherNFT = await new MintableNFTFactory(owner).deploy(
        'Some Default token',
        'PS',
      );
      await otherNFT.mint(owner.address, 2);

      await expect(
        defiPassport
          .connect(skinManager)
          .setDefaultSkin(otherNFT.address, true),
      ).to.be.revertedWith('ERC721: owner query for nonexistent token');
    });

    it('reverts if default skin is repeated', async () => {
      expect(await defiPassport.defaultSkins(defaultSkinAddress)).to.be.false;

      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultSkinAddress, true);

      await expect(
        defiPassport
          .connect(skinManager)
          .setDefaultSkin(defaultSkinAddress, true),
      ).to.be.revertedWith('DefiPassport: skin already has the same status');
    });

    it('toggles skins as default', async () => {
      expect(await defiPassport.defaultSkins(defaultSkinAddress)).to.be.false;

      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultSkinAddress, true);

      const defaultActiveSkin = await defiPassport.defaultActiveSkin();
      expect(defaultActiveSkin.skin).eq(defaultSkinAddress);
      expect(defaultActiveSkin.skinTokenId).eq(1);
      expect(defaultActiveSkin.owner).eq(constants.AddressZero);

      expect(await defiPassport.defaultSkins(defaultSkinAddress)).to.be.true;

      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(otherSkinContract.address, true);

      await defiPassport
        .connect(skinManager)
        .setDefaultActiveSkin(otherSkinContract.address, otherSkinTokenId);

      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultSkinAddress, false);

      expect(await defiPassport.defaultSkins(defaultSkinAddress)).to.be.false;
    });

    it('cannot toggle if active default skin was not updated', async () => {
      expect(await defiPassport.defaultSkins(defaultSkinAddress)).to.be.false;

      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultSkinAddress, true);

      const activeDefaultSkin = await defiPassport.defaultActiveSkin();
      expect(activeDefaultSkin.skin).eq(defaultSkinAddress);
      expect(await defiPassport.defaultSkins(defaultSkinAddress)).to.be.true;

      await expect(
        defiPassport
          .connect(skinManager)
          .setDefaultSkin(defaultSkinAddress, false),
      ).revertedWith(
        'Defi Passport: cannot unregister the default active skin',
      );
    });
  });

  describe('#setActiveDefaultSkin', () => {
    it('reverts if called by non-skin-manager', async () => {
      await expect(
        defiPassport.setDefaultActiveSkin(
          defaultSkinAddress,
          defaultSkinTokenId,
        ),
      ).revertedWith('DefiPassport: caller is not skin manager');
    });

    it('reverts if setting a skin that is not registered as a default skin', async () => {
      await expect(
        defiPassport
          .connect(skinManager)
          .setDefaultActiveSkin(defaultSkinAddress, defaultSkinTokenId),
      ).revertedWith(
        'DefiPassport: the given skin is not registered as a default',
      );
    });

    it('reverts if setting the same skin twice', async () => {
      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultSkinAddress, true);

      await expect(
        defiPassport
          .connect(skinManager)
          .setDefaultActiveSkin(defaultSkinAddress, defaultSkinTokenId),
      ).revertedWith('DefiPassport: the skin is already set as default active');
    });

    it('sets the default active skin as the skin manager', async () => {
      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultSkinAddress, true);

      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(otherSkinContract.address, true);

      let defaultActiveSkin = await defiPassport.defaultActiveSkin();
      expect(defaultActiveSkin.skin).eq(defaultSkinAddress);
      expect(defaultActiveSkin.skinTokenId).eq(defaultSkinTokenId);

      await defiPassport
        .connect(skinManager)
        .setDefaultActiveSkin(otherSkinContract.address, otherSkinTokenId);

      defaultActiveSkin = await defiPassport.defaultActiveSkin();
      expect(defaultActiveSkin.skin).eq(otherSkinContract.address);
      expect(defaultActiveSkin.skinTokenId).eq(otherSkinTokenId);
    });

    it('changes the default active skin id', async () => {
      await skinsContract.mint(owner.address, skinTokenId.add(1));
      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(defaultSkinAddress, true);

      await defiPassport
        .connect(skinManager)
        .setDefaultSkin(otherSkinContract.address, true);

      let defaultActiveSkin = await defiPassport.defaultActiveSkin();
      expect(defaultActiveSkin.skin).eq(defaultSkinAddress);
      expect(defaultActiveSkin.skinTokenId).eq(defaultSkinTokenId);

      await defiPassport
        .connect(skinManager)
        .setDefaultActiveSkin(defaultSkinAddress, skinTokenId.add(1));

      defaultActiveSkin = await defiPassport.defaultActiveSkin();
      expect(defaultActiveSkin.skin).eq(defaultSkinAddress);
      expect(defaultActiveSkin.skinTokenId).eq(skinTokenId.add(1));
    });
  });

  describe('#setCreditScoreContract', () => {
    let otherCreditScoreContract: MockSapphirePassportScores;

    beforeEach(async () => {
      otherCreditScoreContract = await deployMockSapphirePassportScores(owner);
    });

    it('reverts if called by non-admin', async () => {
      await expect(
        defiPassport
          .connect(user)
          .setCreditScoreContract(otherCreditScoreContract.address),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('sets the credit score contract if called by admin', async () => {
      expect(await defiPassport.passportScoresContract()).to.eq(
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
        defiPassport.connect(user)[
          // eslint-disable-next-line no-unexpected-multiline
          'safeTransferFrom(address,address,uint256)'
        ](user.address, owner.address, tokenId),
      ).to.be.revertedWith(
        'DefiPassport: defi passports are not transferrable',
      );
    });
  });

  describe('#safeTransferFrom(from, to, tokenId, _data)', () => {
    it('reverts - defi passports are not transferrable', async () => {
      const tokenId = await mintUserPassport();

      await expect(
        defiPassport.connect(user)[
          // eslint-disable-next-line no-unexpected-multiline
          'safeTransferFrom(address,address,uint256,bytes)'
        ](user.address, owner.address, tokenId, []),
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

  describe('#setProofProtocol', () => {
    it('reverts if called by non-admin', async () => {
      await expect(
        defiPassport.connect(user).setProofProtocol('test'),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('sets the proof protocol', async () => {
      expect(await defiPassport.proofProtocol()).to.eq(DEFAULT_PROOF_PROTOCOL);

      await defiPassport.setProofProtocol('test');

      expect(await defiPassport.proofProtocol()).to.eq('test');
    });
  });
});
