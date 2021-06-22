import { CreditScore } from '@arc-types/sapphireCore';
import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { CreditScoreTree } from '@src/MerkleTree';
import {
  DefaultPassportSkinFactory,
  DefiPassport,
  DefiPassportClaimer,
  DefiPassportClaimerFactory,
  MintableNFTFactory,
  MockSapphireCreditScore,
  SapphireCreditScore,
} from '@src/typings';
import { getEmptyScoreProof, getScoreProof } from '@src/utils';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  deployDefiPassport,
  deployMockSapphireCreditScore,
} from '../deployers';

describe('DefiPassportClaimer', () => {
  let dpClaimer: DefiPassportClaimer;
  let creditScoreContract: MockSapphireCreditScore;
  let defiPassport: DefiPassport;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let userCreditScore: CreditScore;
  let creditScoreTree: CreditScoreTree;
  let defaultSkinAddress: string;
  let defaultSkinTokenId: BigNumber;

  async function _setupCreditScoreContract(): Promise<
    [MockSapphireCreditScore, CreditScore, CreditScoreTree]
  > {
    const creditScoreContract = await deployMockSapphireCreditScore(owner);

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

    return [creditScoreContract, userCreditScore, creditScoreTree];
  }

  async function _setupSkins() {
    const defaultPassportSkinContract = await new DefaultPassportSkinFactory(
      owner,
    ).deploy('Default Passport Skin NFT', 'DPS');
    defaultSkinAddress = defaultPassportSkinContract.address;

    await defaultPassportSkinContract.mint(owner.address, '');
    defaultSkinTokenId = await defaultPassportSkinContract.tokenOfOwnerByIndex(
      owner.address,
      0,
    );

    await defiPassport.setDefaultSkin(defaultSkinAddress, true);
  }

  before(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
    user = signers[1];

    [
      creditScoreContract,
      userCreditScore,
      creditScoreTree,
    ] = await _setupCreditScoreContract();

    defiPassport = await deployDefiPassport(owner);
    await defiPassport.init(
      'Defi Passport',
      'DefiPassport',
      creditScoreContract.address,
      owner.address,
    );

    dpClaimer = await new DefiPassportClaimerFactory(owner).deploy(
      creditScoreContract.address,
      defiPassport.address,
    );

    await _setupSkins();
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#constructor', () => {
    it('sets the credit score & defi passport contracts', async () => {
      // The DefiPassportClaimer contract has already been deployed in before()
      expect(await dpClaimer.creditScoreContract()).to.eq(
        creditScoreContract.address,
      );
      expect(await dpClaimer.defiPassport()).to.eq(defiPassport.address);
    });
  });

  describe('#setCreditScoreContract', () => {
    it('reverts if called by non-owner', async () => {
      const [newCreditScoreContract] = await _setupCreditScoreContract();

      await expect(
        dpClaimer
          .connect(user)
          .setCreditScoreContract(newCreditScoreContract.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('sets the credit score contract if called by owner', async () => {
      expect(await dpClaimer.creditScoreContract()).to.eq(
        creditScoreContract.address,
      );

      const [newCreditScoreContract] = await _setupCreditScoreContract();
      await dpClaimer.setCreditScoreContract(newCreditScoreContract.address);

      expect(await dpClaimer.creditScoreContract()).to.eq(
        newCreditScoreContract.address,
      );
    });
  });

  describe('#claimPassport', () => {
    it('reverts if a no score proof is provided', async () => {
      await expect(
        dpClaimer.claimPassport(
          getEmptyScoreProof(),
          defaultSkinAddress,
          defaultSkinTokenId,
        ),
      ).to.be.revertedWith('SapphireCreditScore: account cannot be address 0');
    });

    it('reverts if a bad proof is provided', async () => {
      await expect(
        dpClaimer.claimPassport(
          {
            ...getScoreProof(userCreditScore, creditScoreTree),
            account: owner.address, // Replacing the user address by the owner's
          },
          defaultSkinAddress,
          defaultSkinTokenId,
        ),
      ).to.be.revertedWith('SapphireCreditScore: invalid proof');
    });

    /**
     * - ensure the credit score is updated
     * - ensure the passport is minted with the correct skin and skin ID
     */
    it('mints a defi passport to the user of the score proof', async () => {
      expect(await defiPassport.balanceOf(user.address)).to.eq(0);
      expect(await creditScoreContract.getLastScore(user.address)).to.deep.eq([
        BigNumber.from(0),
        1000,
        BigNumber.from(0),
      ]);

      const currentTimestamp = BigNumber.from(21);
      await creditScoreContract.setCurrentTimestamp(currentTimestamp);

      await dpClaimer.claimPassport(
        getScoreProof(userCreditScore, creditScoreTree),
        defaultSkinAddress,
        defaultSkinTokenId,
      );

      expect(await defiPassport.balanceOf(user.address)).to.eq(1);
      expect(await creditScoreContract.getLastScore(user.address)).to.deep.eq([
        userCreditScore.amount,
        1000,
        currentTimestamp,
      ]);
    });

    it('reverts if trying to mint a second passport to the same user', async () => {
      await dpClaimer.claimPassport(
        getScoreProof(userCreditScore, creditScoreTree),
        defaultSkinAddress,
        defaultSkinTokenId,
      );

      await expect(
        dpClaimer.claimPassport(
          getScoreProof(userCreditScore, creditScoreTree),
          defaultSkinAddress,
          defaultSkinTokenId,
        ),
      ).to.be.revertedWith('DefiPassport: user already has a defi passport');
    });
  });
});
