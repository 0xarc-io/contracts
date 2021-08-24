import { CreditScore } from '@arc-types/sapphireCore';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import {
  MockSapphireCreditScore,
  MockSapphireCreditScoreFactory,
} from '@src/typings';
import { getScoreProof } from '@src/utils/getScoreProof';
import {
  addSnapshotBeforeRestoreAfterEach,
  advanceEpoch,
} from '@test/helpers/testingUtils';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber, BigNumberish } from 'ethers';
import 'module-alias/register';
import { generateContext, ITestContext } from '../context';
import { deployMockSapphireCreditScore } from '../deployers';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

chai.use(solidity);

const MAX_CREDIT_SCORE = 1000;

const ONE_BYTES32 =
  '0x1111111111111111111111111111111111111111111111111111111111111111';
const TWO_BYTES32 =
  '0x2222222222222222222222222222222222222222222222222222222222222222';
const THREE_BYTES32 =
  '0x3333333333333333333333333333333333333333333333333333333333333333';

/**
 * This is the core credit score contract and is where a user's credit score will
 * be posted. The logic around this contract needs to be very sound since we anticipate
 * it to be a core DeFi primitive for other applications to build on.
 */
describe('SapphireCreditScore', () => {
  let creditScoreContract: MockSapphireCreditScore;
  let merkleRootUpdater: SignerWithAddress;
  let unauthorized: SignerWithAddress;
  let admin: SignerWithAddress;
  let pauseOperator: SignerWithAddress;
  let tree: CreditScoreTree;
  let creditScore1: CreditScore;
  let creditScore2: CreditScore;
  let ctx: ITestContext;

  async function createNewCreditScoreInstance(
    merkleRoot: string,
    merkleRootUpdater: string,
    pauseOperator: string,
    maxScore: BigNumberish,
  ) {
    const creditScoreInstance = await deployMockSapphireCreditScore(admin);

    await creditScoreInstance.init(
      merkleRoot,
      merkleRootUpdater,
      pauseOperator,
      maxScore,
    );

    return creditScoreInstance;
  }

  before(async () => {
    ctx = await generateContext(sapphireFixture, async (ctx) => {
      creditScore1 = {
        account: ctx.signers.admin.address,
        amount: BigNumber.from(12),
      };
      creditScore2 = {
        account: ctx.signers.unauthorized.address,
        amount: BigNumber.from(20),
      };
      tree = new CreditScoreTree([creditScore1, creditScore2]);
      return setupSapphire(ctx, {
        merkleRoot: tree.getHexRoot(),
      });
    });
    unauthorized = ctx.signers.unauthorized;
    admin = ctx.signers.admin;
    merkleRootUpdater = ctx.signers.interestSetter;
    creditScoreContract = ctx.contracts.sapphire.creditScore;
    pauseOperator = ctx.signers.pauseOperator;
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#setPause', () => {
    it('initially not active', async () => {
      const contract = await createNewCreditScoreInstance(
        ONE_BYTES32,
        merkleRootUpdater.address,
        pauseOperator.address,
        1000,
      );
      expect(await contract.isPaused()).to.be.true;
    });

    it('revert if trying to pause as an unauthorised user', async () => {
      expect(await creditScoreContract.merkleRootUpdater()).not.eq(
        unauthorized.address,
      );
      expect(await creditScoreContract.pauseOperator()).not.eq(
        unauthorized.address,
      );
      await expect(
        creditScoreContract.connect(unauthorized).setPause(false),
      ).to.be.revertedWith(
        'SapphireCreditScore: caller is not the pause operator',
      );
    });

    it('revert if set pause as merkle root updater', async () => {
      expect(await creditScoreContract.merkleRootUpdater()).eq(
        merkleRootUpdater.address,
      );
      await expect(
        creditScoreContract.connect(merkleRootUpdater).setPause(false),
      ).to.be.revertedWith(
        'SapphireCreditScore: caller is not the pause operator',
      );
    });

    it('set pause as pause operator', async () => {
      const initialIsPaused = await creditScoreContract.isPaused();
      const expectedIsPaused = !initialIsPaused;
      await expect(
        creditScoreContract.connect(pauseOperator).setPause(expectedIsPaused),
      )
        .emit(creditScoreContract, 'PauseStatusUpdated')
        .withArgs(expectedIsPaused);
      expect(await creditScoreContract.isPaused()).eq(expectedIsPaused);
    });
  });

  describe('#updateMerkleRoot', () => {
    it('should have merkle root updater not equal admin', async () => {
      const merkleRootUpdaterAddress = await creditScoreContract.merkleRootUpdater();
      expect(merkleRootUpdaterAddress).not.eq(admin.address);
      expect(merkleRootUpdaterAddress).eq(merkleRootUpdater.address);
    });

    it('should not be able to update the merkle root as an unauthorised user', async () => {
      await expect(
        creditScoreContract.connect(unauthorized).updateMerkleRoot(ONE_BYTES32),
      ).to.be.revertedWith(
        'SapphireCreditScore: caller is not authorized to update merkle root',
      );
    });

    it('should not be able to be called by the root updater before the delay duration', async () => {
      await advanceEpoch(creditScoreContract);
      await creditScoreContract
        .connect(merkleRootUpdater)
        .updateMerkleRoot(ONE_BYTES32);
      await expect(
        creditScoreContract
          .connect(merkleRootUpdater)
          .updateMerkleRoot(ONE_BYTES32),
      ).to.be.revertedWith(
        'SapphireCreditScore: cannot update merkle root before delay period',
      );
    });

    it('should not be able to post an empty root', async () => {
      await expect(
        creditScoreContract
          .connect(merkleRootUpdater)
          .updateMerkleRoot(
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ),
      ).to.be.revertedWith('SapphireCreditScore: root is empty');
    });

    it('should not be able to update as admin if the contract is not paused', async () => {
      await expect(
        creditScoreContract.updateMerkleRoot(ONE_BYTES32),
      ).to.be.revertedWith(
        'SapphireCreditScore: only admin can update merkle root if paused',
      );
    });

    it('instantly update merkle root as the admin', async () => {
      await creditScoreContract.connect(pauseOperator).setPause(true);
      const currentMerkleRoot = await creditScoreContract.currentMerkleRoot();
      const initialLastMerkleRootUpdate = await creditScoreContract.lastMerkleRootUpdate();

      const txn = creditScoreContract
        .connect(admin)
        .updateMerkleRoot(TWO_BYTES32);
      const txnBlockTimestamp = await creditScoreContract.currentTimestamp();

      await expect(txn)
        .to.emit(creditScoreContract, 'MerkleRootUpdated')
        .withArgs(admin.address, TWO_BYTES32, txnBlockTimestamp);
      expect(await creditScoreContract.upcomingMerkleRoot()).eq(TWO_BYTES32);
      expect(await creditScoreContract.currentMerkleRoot()).eq(
        currentMerkleRoot,
      );
      expect(await creditScoreContract.lastMerkleRootUpdate()).eq(
        initialLastMerkleRootUpdate,
      );
    });

    it('instantly update merkle root avoiding time delay as the admin', async () => {
      const initialLastMerkleRootUpdate = await creditScoreContract.lastMerkleRootUpdate();
      const initialCurrentMerkleRoot = await creditScoreContract.currentMerkleRoot();

      await creditScoreContract.setCurrentTimestamp(
        initialLastMerkleRootUpdate.add(1),
      );
      await creditScoreContract.connect(pauseOperator).setPause(true);
      await creditScoreContract.connect(admin).updateMerkleRoot(THREE_BYTES32);

      expect(await creditScoreContract.lastMerkleRootUpdate()).eq(
        initialLastMerkleRootUpdate,
      );
      expect(await creditScoreContract.currentMerkleRoot()).eq(
        initialCurrentMerkleRoot,
      );
      expect(await creditScoreContract.upcomingMerkleRoot()).eq(THREE_BYTES32);
    });

    it('should be able to update the merkle root as the root updater', async () => {
      const initialUpcomingMerkleRoot = await creditScoreContract.upcomingMerkleRoot();
      const timestamp = await advanceEpoch(creditScoreContract);
      const updateMerkleRootTxn = creditScoreContract
        .connect(merkleRootUpdater)
        .updateMerkleRoot(TWO_BYTES32);

      await expect(updateMerkleRootTxn)
        .to.emit(creditScoreContract, 'MerkleRootUpdated')
        .withArgs(merkleRootUpdater.address, TWO_BYTES32, timestamp);
      expect(await creditScoreContract.lastMerkleRootUpdate()).eq(timestamp);
      expect(await creditScoreContract.currentMerkleRoot()).eq(
        initialUpcomingMerkleRoot,
      );
      expect(await creditScoreContract.upcomingMerkleRoot()).eq(TWO_BYTES32);
    });

    it('should increment the current epoch when updating as the root updater', async () => {
      const initialEpoch = await creditScoreContract.currentEpoch();

      await advanceEpoch(creditScoreContract);

      await creditScoreContract
        .connect(merkleRootUpdater)
        .updateMerkleRoot(TWO_BYTES32);

      expect(await creditScoreContract.currentEpoch()).to.eq(
        initialEpoch.add(1),
      );
    });

    it('should ensure that malicious merkle root does not became a current one', async () => {
      // malicious update merkle root
      const maliciousRoot = TWO_BYTES32;
      const maliciousTxnTimestamp = await advanceEpoch(creditScoreContract);
      const maliciousUpdateTxn = creditScoreContract
        .connect(merkleRootUpdater)
        .updateMerkleRoot(maliciousRoot);

      await expect(maliciousUpdateTxn)
        .to.emit(creditScoreContract, 'MerkleRootUpdated')
        .withArgs(
          merkleRootUpdater.address,
          maliciousRoot,
          maliciousTxnTimestamp,
        );
      expect(await creditScoreContract.upcomingMerkleRoot()).eq(maliciousRoot);

      // admin prevent attack to not allow set malicious root as current one
      await creditScoreContract.connect(pauseOperator).setPause(true);
      const timestamp = await advanceEpoch(creditScoreContract);
      const updateMerkleRootTxn = creditScoreContract
        .connect(admin)
        .updateMerkleRoot(THREE_BYTES32);

      await expect(updateMerkleRootTxn)
        .to.emit(creditScoreContract, 'MerkleRootUpdated')
        .withArgs(admin.address, THREE_BYTES32, timestamp);
      expect(await creditScoreContract.upcomingMerkleRoot()).eq(THREE_BYTES32);
      expect(await creditScoreContract.currentMerkleRoot()).not.eq(
        maliciousRoot,
      );
    });

    it('should check if updater cannot update merklee root before thee delay duration passes', async () => {
      const mockCreditScoreContract = await createNewCreditScoreInstance(
        ONE_BYTES32,
        merkleRootUpdater.address,
        pauseOperator.address,
        MAX_CREDIT_SCORE,
      );

      await mockCreditScoreContract.connect(pauseOperator).setPause(false);
      await advanceEpoch(mockCreditScoreContract);
      await mockCreditScoreContract
        .connect(merkleRootUpdater)
        .updateMerkleRoot(TWO_BYTES32);
      const lastMerkleRootUpdate = await mockCreditScoreContract.lastMerkleRootUpdate();
      const delay = await mockCreditScoreContract.merkleRootDelayDuration();

      // update merkle root right after root was updated
      await expect(
        mockCreditScoreContract
          .connect(merkleRootUpdater)
          .updateMerkleRoot(THREE_BYTES32),
      ).to.be.revertedWith(
        'SapphireCreditScore: cannot update merkle root before delay period',
      );

      await mockCreditScoreContract.setCurrentTimestamp(
        lastMerkleRootUpdate.add(delay).sub(1),
      );

      // update merkle root 1 sec before delay passes
      await expect(
        mockCreditScoreContract
          .connect(merkleRootUpdater)
          .updateMerkleRoot(THREE_BYTES32),
      ).to.be.revertedWith(
        'SapphireCreditScore: cannot update merkle root before delay period',
      );
      await mockCreditScoreContract.setCurrentTimestamp(
        lastMerkleRootUpdate.add(delay),
      );

      // update merkle root right after delay has passed
      await mockCreditScoreContract
        .connect(merkleRootUpdater)
        .updateMerkleRoot(THREE_BYTES32);

      expect(await mockCreditScoreContract.currentMerkleRoot()).eq(TWO_BYTES32);
      expect(await mockCreditScoreContract.upcomingMerkleRoot()).eq(
        THREE_BYTES32,
      );
    });
  });

  describe('#verifyAndUpdate', async () => {
    it('should be able to verify and update a users score', async () => {
      expect(await creditScoreContract.currentMerkleRoot()).eq(
        tree.getHexRoot(),
      );
      const timestamp = await creditScoreContract.currentTimestamp();

      const verifyAndUpdateTxn = creditScoreContract
        .connect(unauthorized)
        .verifyAndUpdate(
          getVerifyRequest(creditScore1.account, creditScore1.amount, tree),
        );
      await expect(verifyAndUpdateTxn)
        .to.emit(creditScoreContract, 'CreditScoreUpdated')
        .withArgs(creditScore1.account, creditScore1.amount, timestamp);

      const {
        0: creditScore,
        1: maxCreditScore,
        2: lastUpdated,
      } = await creditScoreContract.getLastScore(creditScore1.account);
      expect(creditScore).eq(creditScore1.amount);
      expect(lastUpdated).eq(timestamp);
      expect(maxCreditScore).eq(await creditScoreContract.maxScore());
    });

    it('should not be able to verifyAndUpdate an invalid proof', async () => {
      const invalidTree = new CreditScoreTree([
        { ...creditScore1, amount: BigNumber.from(99) },
        creditScore2,
      ]);
      await expect(
        creditScoreContract
          .connect(unauthorized)
          .verifyAndUpdate(
            getVerifyRequest(
              creditScore1.account,
              BigNumber.from(99),
              invalidTree,
            ),
          ),
      ).to.be.revertedWith('SapphireCreditScore: invalid proof');
    });

    it('should reverify a score and change timestamp when score is the same', async () => {
      const creditScoreContract = await createNewCreditScoreInstance(
        tree.getHexRoot(),
        merkleRootUpdater.address,
        pauseOperator.address,
        MAX_CREDIT_SCORE,
      );

      await expect(
        creditScoreContract.verifyAndUpdate(
          getVerifyRequest(creditScore1.account, creditScore1.amount, tree),
        ),
      )
        .to.emit(creditScoreContract, 'CreditScoreUpdated')
        .withArgs(
          creditScore1.account,
          creditScore1.amount,
          await creditScoreContract.currentTimestamp(),
        );
      await creditScoreContract.setCurrentTimestamp(631000);
      await expect(
        creditScoreContract.verifyAndUpdate(
          getVerifyRequest(creditScore1.account, creditScore1.amount, tree),
        ),
      )
        .to.emit(creditScoreContract, 'CreditScoreUpdated')
        .withArgs(creditScore1.account, creditScore1.amount, 631000);
    });

    it('should reverify a score and change timestamp after merkle root was changed', async () => {
      const creditScoreContractNew = await createNewCreditScoreInstance(
        tree.getHexRoot(),
        merkleRootUpdater.address,
        pauseOperator.address,
        MAX_CREDIT_SCORE,
      );

      await creditScoreContractNew.connect(pauseOperator).setPause(false);
      const initTimestamp = await creditScoreContractNew.currentTimestamp();
      const merkleRootDelay = await creditScoreContractNew.merkleRootDelayDuration();

      // verify score with initial merkle root
      await expect(
        creditScoreContractNew.verifyAndUpdate(
          getScoreProof(creditScore1, tree),
        ),
      )
        .to.emit(creditScoreContractNew, 'CreditScoreUpdated')
        .withArgs(creditScore1.account, creditScore1.amount, initTimestamp);

      // intended root set as upcoming one
      const changedAmount = BigNumber.from(99);
      const newTree = new CreditScoreTree([
        { ...creditScore1, amount: changedAmount },
        creditScore2,
      ]);

      const lastTimestamp = initTimestamp.add(merkleRootDelay);
      await creditScoreContractNew.setCurrentTimestamp(lastTimestamp);
      await creditScoreContractNew
        .connect(merkleRootUpdater)
        .updateMerkleRoot(newTree.getHexRoot());

      // intended root set as current one
      const changedTimestamp = lastTimestamp.add(merkleRootDelay);
      await creditScoreContractNew.setCurrentTimestamp(changedTimestamp);
      await creditScoreContractNew
        .connect(merkleRootUpdater)
        .updateMerkleRoot(TWO_BYTES32);

      // verify account with intended root which contains new score for the account
      await expect(
        creditScoreContractNew.verifyAndUpdate(
          getVerifyRequest(creditScore1.account, changedAmount, newTree),
        ),
      )
        .to.emit(creditScoreContractNew, 'CreditScoreUpdated')
        .withArgs(creditScore1.account, changedAmount, changedTimestamp);

      const {
        0: creditScore,
        2: lastUpdated,
      } = await creditScoreContractNew.getLastScore(creditScore1.account);
      expect(creditScore).eq(changedAmount);
      expect(lastUpdated).eq(changedTimestamp);
    });
  });

  describe('#setMerkleRootUpdater', () => {
    it('should be able to update as the admin', async () => {
      await expect(
        creditScoreContract.setMerkleRootUpdater(unauthorized.address),
      )
        .to.emit(creditScoreContract, 'MerkleRootUpdaterUpdated')
        .withArgs(unauthorized.address);
      expect(await creditScoreContract.merkleRootUpdater()).eq(
        unauthorized.address,
      );
    });

    it('should not be able to update as non-admin', async () => {
      await expect(
        creditScoreContract
          .connect(merkleRootUpdater)
          .setMerkleRootUpdater(merkleRootUpdater.address),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });
  });

  describe('#setPauseOperator', () => {
    it('should be able to update as the admin', async () => {
      await expect(
        creditScoreContract
          .connect(admin)
          .setPauseOperator(unauthorized.address),
      )
        .to.emit(creditScoreContract, 'PauseOperatorUpdated')
        .withArgs(unauthorized.address);
      expect(await creditScoreContract.pauseOperator()).eq(
        unauthorized.address,
      );
    });

    it('should not be able to update as non-admin', async () => {
      await expect(
        creditScoreContract
          .connect(merkleRootUpdater)
          .setPauseOperator(merkleRootUpdater.address),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });
  });

  describe('#setMerkleRootDelay', () => {
    it('should be able to update as the admin', async () => {
      await expect(creditScoreContract.setMerkleRootDelay(5))
        .to.emit(creditScoreContract, 'DelayDurationUpdated')
        .withArgs(admin.address, 5);
      expect(await creditScoreContract.merkleRootDelayDuration()).eq(5);
    });

    it('should not be able to update as non-admin', async () => {
      await expect(
        creditScoreContract.connect(merkleRootUpdater).setMerkleRootDelay(5),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });
  });

  describe('#setDocumentId', () => {
    it('should be able to update as the admin', async () => {
      const documentId = 'test123';

      await expect(creditScoreContract.setDocumentId(documentId))
        .to.emit(creditScoreContract, 'DocumentIdUpdated')
        .withArgs(documentId);
    });

    it('should not be able to update as non-admin', async () => {
      await expect(
        creditScoreContract.connect(merkleRootUpdater).setDocumentId('test123'),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });
  });

  describe.only('#sanityCheck', () => {
    it('ensure upcoming root sanity', async () => {
      const currentTree = {
        '0xcd78358fb5fC823b9e789605B7b4fDc1dEf14A1E': 1,
        '0xf99d5Dd870E10e798c1D167872050A3B14AD03Ab': 1,
        '0xbb8eeB1b3494e123144Ce38E1aac8f7b96b5EfA5': 1,
        '0xE4FbF25Aa95363EFF2fF6459476763B34F7c190B': 1,
        '0x77DA151402d33cBF3E0123B123d7b57C28d95CfD': 1,
        '0xFEC18996C36D02902E4c55bcFB7A1c73AA1500Cd': 1,
        '0x9c767178528c8a205DF63305ebdA4BB6B147889b': 1,
        '0x1A3BecC3fA08cc6AEBd0f43cDc069Ba95713b856': 1,
        '0x2f5691bC4D8db66908BE10fad913fDc91c99Ce9F': 1,
        '0x3070f20f86fDa706Ac380F5060D256028a46eC29': 1,
        '0x8DF04D551E3f7F5B03a67DE79184BB919A97BbDE': 1,
        '0xD9907Cd11D99D21b431fc0A4Ef513f3823142B0d': 1,
        '0x2f45724d7E384b38D5C97206e78470544304887F': 1,
        '0x3d9bd4C167491700c38A638De3Ba12Dc94BE6e40': 1,
        '0x0CEF73882Fd3576fa0B591d4B0B1D585300789EF': 1,
        '0x605D50F68E737eBF7F6054D6f7860010FC80971F': 1,
        '0x91212de083d29342F670FB69Ffa68176369e3B20': 1,
        '0x7Db02006662F324fee4701A95AdC1f5A81aE784B': 1,
        '0x9CE6E6B60C894d1DF9BC3D9D6cC969b79FB176B7': 1,
        '0x3cdeE3CFE9ff085a70E64f1d45CCC948F71FfC7a': 1,
        '0x57Ef012861c4937A76B5D6061bE800199A2b9100': 1,
        '0x359bC33Da003F50Aca935F1482cc481d18250700': 1,
        '0x7cC789f9c8Ba2a61E1D40AEdB9506B95fEE1a393': 1,
        '0xfe32A37F15ee4a4b59715530E5817D1322B9df80': 1,
        '0xA9DA2e4b36D75d3aEE8630C6Acd09FD567091F10': 1,
        '0xdDfd07cBb255FA8FFfA6A7320DC70F7db4d96a29': 1,
        '0xcde3725B25D6d9bC78CF0941cC15Fd9710c764b9': 1,
        '0x81D98c8fdA0410ee3e9D7586cB949cD19FA4cf38': 1,
        '0xA2b16c27c0766A1Df18892F7b0413b4f5806ee4D': 1,
        '0x854F1269b659A727a2268AB86FF77CFB30BfB358': 1,
        '0xC2F607b2f12B0E67ea00A787ab6EcEa7D5Cce62b': 1,
        '0xE2d128323Cf7560a6E7a82726D7b425aEdc7a556': 1,
        '0x97eAAD7c28EA5D8a2A320c765Ec00bD789a52995': 1,
        '0xF814a8e1607Aa1d1a33F42a4c9B3b67eAdCE45bD': 1,
        '0x4bb4c1B0745ef7B4642fEECcd0740deC417ca0a0': 1,
        '0x87715066DAF3c2E0A05085A2F1B6087b90AEAf82': 1,
        '0x968a0e5603c5D4dbF24cbd7df562921d158aD19C': 1,
        '0x3A651F92308bB5C2248De5485514d2715dBe0Ff1': 1,
        '0x01C3dD0607e189d8ec94c740cf5926dB4f38Bf3f': 1,
        '0xe1690f5153aD0BBc683964aA81645C49b3cF6567': 1,
        '0x61B310827ef912d7056B21394951f2729228bC6c': 1,
        '0x07cBD4e4473140b6078Aa987907aafF5E500b9f1': 1,
        '0x1ECe8DD7CC65c7999B7890FB2719249609E94C56': 1,
        '0xB2043c543bb60Fb7AA7265CdcA359A35C4Bc09fa': 1,
        '0x8125FDbC90f5F5442215d149973e824fE4b641f6': 1,
        '0xa18669587490522d0e3c67464C8d4cad22405AFc': 1,
        '0x2e403B969a64BdD1CA18fE10BABA4546957bc31e': 1,
        '0xf67e69c363771abF7319c4995aCBC99F90e32D61': 1,
        '0xfc436651F2fD4885AD645035a63A7Cd22E6A868c': 1,
        '0x0be833cF3c2B9d692c7859f06da9ef0e151B8a33': 1,
        '0xC810b34977f6c348149128601A8239f3e9b32910': 1,
        '0xb75151327C3A4dB824C62fFd9B4896df76845c0c': 1,
        '0xD3474BD2f558B12e83810EC7d8aF14f2d1D08137': 1,
        '0x569d4C513673F8A611Cf4DDE30563498642a8579': 1,
        '0xbf0C6494ED2cc483cfc86255F45F9A947B5e5621': 1,
        '0xc22E7D56806ab04Be8d0B6ba6a670Bd0BcEeA9D4': 1,
        '0xee91A05924aB6D0a22918F23ECCc547431F3e3a7': 1,
        '0x1eA6A6085f2ce3E1F982684a28879761343ff4CE': 1,
        '0x214882C0631D9eb0FDa7337bE458e0e992E0279e': 1,
        '0xc990bD138fF23075d2e10F0a092959af2a3E91e0': 1,
        '0x59B2f9fCF70C128c02FF7825375abe1260BfC339': 1,
        '0x9e16025a87B5431AE1371dE2Da7DcA4047C64196': 1,
        '0xCfa73FaeB0aa5521A88665550933DCc76DfF353a': 1,
        '0x3cEDfE119cf0616637a7328C98AdAC7aEf6ba474': 1,
        '0x500cCbc28a59C11B1d03453DE21fA71F70471AA4': 1,
        '0x00C67d9D6D3D13b42a87424E145826c467CcCd84': 1,
        '0xd600Ee8c118B0617CAc8B0c297EAa54631857FB1': 1,
        '0x33eBB62DC9ddBf6B8F3C0efdF5BccC2e7AC60211': 1,
        '0x49084125E425eD84a81e97F866043Ba413E959b9': 1,
        '0x5f1b1922A4C322144644a9732e89cd32CdCe9073': 1,
        '0x59D6779Eca6c91eD7679E261b54299b5155EAdF0': 1,
        '0xd35Dc42C3812acE3d313f8303114B731D428a0fa': 1,
        '0x5084b46b389266B333a17a1cA9c43102F374157D': 1,
        '0x1DD2542ad6187024064B08Ed3fCb076021bD22c0': 1,
        '0xCC55AA8FA576A0217523f62083eC633b9a04af01': 1,
        '0x61A6007A980C8a8655071AE83930e8B2883e8407': 1,
        '0x000c9D05B64167cc59aD776c2032C736a4d6e8Ee': 1,
        '0x3E73b05658B95a2dB6496c8911Fc2a012003d463': 1,
        '0xD3802dcE7F7A54d59E7a64329d287624FF3F495a': 1,
        '0x1Faf5e8f78E71e75c7427c2EF733F15e735113eB': 1,
        '0xebe668347fD2DcD96221F5CFDB6645c97CABc27d': 1,
        '0xf389dD1F828525b449D63D14157f2d3A25eE0a41': 1,
        '0x0BdfF84093ecacc3fE9E01FDfBA575cd50040c3B': 1,
        '0xAb45160C38E9781347fAd728b7331E2601812198': 1,
        '0x270f7c71e6F56F481BAAEF9AD149FEb9d6624D51': 1,
        '0x35dcf2c2223F335266e17dacBE8777D7C5bF8A15': 1,
        '0x9A048A7BF38306c055C05606A6010C78CFc7C1E8': 1,
        '0x1035470A202EC3f9085E8D2a8b1E25C044F61dbb': 1,
        '0x6103A9e1ccB543E7488283C11B220943c7F85CF5': 1,
        '0x1Ec2C4e7Fff656f76c5A4992bd5efA7e7fF1A460': 1,
        '0xF0F32C3c8DEf7b43caA14fEd5752AbC5381C8374': 1,
        '0x25125E438b7Ae0f9AE8511D83aBB0F4574217C7a': 1,
        '0xAe22A659B0b58F4C61a6Aaf7fC0fe7b1f7Fa59fC': 1,
        '0xc8E5c09a577fe77d988E5f41f57fE87673A32e9f': 1,
        '0x68057266b9e20A60C55D7b50Eb6f22117b1Eb842': 1,
        '0x7c3C30F9B22e79227312855d1E710e5F2b75C6dB': 1,
        '0xaAaC34d30d6938787c653AAfB922bc20bFa9C512': 1,
        '0x7D02c2B3361ddf8dce39AecB8cb7264373fdaD32': 1,
        '0xa1C6bf9a94E603c0C7e0559A9BBe6329137239f7': 1,
        '0x6e4d6119916573e681C174E99Ea72338ABf0e6f6': 1,
        '0x16174273B883ec5b2AD3bD9AEea08E67A2711D0D': 1,
        '0xf424Da7E5cd837e63ed5eF993611CC70a68dBa28': 1,
        '0x97C6f53B75D8243a7CBC1c3bc491c993842db3b3': 1,
        '0x1dF4c04D9C4247bEdF051E73730C46A03C3d3050': 1,
        '0x9c22d83FB0315263566740d018f08e8c075FC927': 1,
        '0x54689fd2D989C0c0498c87794B93309bC3872C80': 1,
        '0x60e7605350945df18eF1c15933cC993E7526C46A': 1,
        '0x1dA158559F54d81B13dda7b9602cB5E09468aC09': 1,
        '0x2d1bdC590Cb736097Bc5577c8974e28dc48F5ECc': 1,
        '0x1245052F46424BCD159E8cF3eC64E8B7C687819D': 1,
        '0x5B4D62700e038a162Ad33C4C97d0db445ddaB32f': 1,
        '0x3b96f28e3B45a19FA3e89232D0680E54872D3d58': 1,
        '0xA89f778740c6562dAaC0fa1e09F48e0283A39611': 1,
        '0x344651A2445484bd2928eB46D2610DaaC1B42A66': 1,
        '0x432DcBdA06e8B296CA29705572D7cb6315Ed8Bed': 1,
        '0xd61daEBC28274d1feaAf51F11179cd264e4105fB': 1,
        '0xE8fbb34B4a430b4d47c9d9BFC76740850A448361': 1,
        '0x9AbbEd91faC6e71977258Fa8aa949c9bD874F4DE': 1,
        '0x2447A7a7F03327B5410F2067413E5b208B4e8B26': 1,
        '0x94E84E65B1D9Da074dc6Bc94052BA9d7B8635615': 1,
        '0xABfd811636fBbC9BFac9ee6D3BCb85EC88979a86': 1,
        '0x613Fd0EDaaFd5B638b408a471E4AA12b0Fc2D091': 1,
        '0x2b0D69e10874bE8D5a79CE6aaF88B2e5C551B6db': 1,
        '0x859a8E0aE06b4912Da619938C5469c01d2A2B7DA': 1,
        '0x007A8C406c3E15884295636B0d69E52887534c2e': 1,
        '0x38dAEa6f17E4308b0Da9647dB9ca6D84a3A7E195': 1,
        '0x725A6F89646aA6F4343c7271d66c4EA8Bad6fc2e': 1,
        '0x3cB60cD92582637a540893Af9556898DCD77bFDA': 1,
        '0x857F58B6Afde4bcBe9B86409242C146F0d0dE31C': 1,
        '0xCBF0F1EF9D8F07779f1AdD94ceeF855e6D42009f': 1,
        '0x3Ed23D80c7B9e3a159316b3F47bbDaB738Ba893E': 1,
        '0x7701832B38C4AF966b4b171b3E15Cf8208042A4d': 1,
        '0xb6aF7C04f67B5eb61F0DC7aC4a760888EC3E3887': 1,
        '0x2ce1A66F22A2Dc6E410D9021D57aEB8D13D6bFEF': 1,
        '0xEb4Db23c27253077Fb3080adda6C5C127b0dACAe': 1,
        '0xF26E5B93453a69a0297Dc66e7bbD750d2B28160B': 1,
        '0x334Bc680d521d64F48bD09b10bD24E598dC0DA0d': 1,
        '0x40D175ca198474Bbdf8258dd9f512eC40D083772': 1,
        '0xaB912f5E8FD03E5d0DA7f3f1bc8F3fD3b027B0F8': 1,
        '0x4497714FB2df95B104d568877B994e10153F8F14': 1,
        '0x39d9418F9AaffeD08E9Cd1F30161cA7dd52b15eD': 1,
        '0xb24156B92244C1541F916511E879e60710e30b84': 1,
        '0xe84e6DAAf71AE0a8eaB1d31B1d2d787361E55261': 1,
        '0xF5379574419476C7409ab911e2815C534d6E98eb': 1,
        '0x3b9B19b833928767F8eF0cB1C9F07C47268679bD': 1,
        '0x7Dd3A770eE63Be630F117B783b254a046E389310': 1,
        '0xA4Db6e848f1C4aF89D2d4D4cC350Acbc1F5F93E3': 1,
        '0x11a084dC24BC52022B71b47d17868d1f72072dFc': 1,
        '0xF5eC36a06475AeC69FA289053963FA6473802AB4': 1,
        '0x1793CD5916cC6f5b20593e001A1cC3B66268da1f': 1,
        '0xD4867061A4FeFb0B7cc82aeB5D78E931E69515bC': 1,
        '0x5b82D74307d75Fde3A5Da2cdfEB60ED60430f2A8': 1,
        '0xB5fC9EEf8f391051ECfC1c7d71D617181A56539B': 1,
        '0x1A4Ea017BbCdA7c0E79Cd9e1Ee8637b083088ae2': 1,
        '0xF1984DD40cde6227Df2F0A503C8Bc9aa8380d87F': 1,
        '0xac4c8f2D099dF7A6DbF9F2c41707a4b0ccCf403F': 1,
        '0xA0efD27acC781549D5b78e89E561AA0903932d56': 1,
        '0x1Cb86Ee06CD27d7045D2849BF342FcF5ef2a7D12': 1,
        '0x97b90FBc8904F861F76CB06BFa0A465b72C5E662': 1,
        '0x1da75Fb0DA32653Fdab9DdecDb42F2ed61F8A28b': 1,
        '0x9a1e8645DEDec6d45E2058D031B1CA97F815bd2E': 1,
        '0xCDc7ba99391F3BE7E5Dc0e49cC8361B537cfC29b': 1,
        '0x00B591BC2b682a0B30dd72Bac9406BfA13e5d3cd': 1,
        '0x015Ccbf3D21e00d6F4598900F4A2A62F82D94e8E': 1,
        '0xbBa741EC6EbA0a65EBB36cc426c410fe856b299f': 1,
        '0xC8D46eb7881975F9aE15216FeEBa2ff58E55803c': 1,
        '0x957cf512E2Dc8934Ba8313A68518df73b330ac58': 1,
        '0xb7d49ADB031d6DBDF3E8e28F21C6Dd3b6f231cD5': 1,
        '0xcfD2c955ED9eb221d275A9432226858CA5c802C9': 1,
        '0x24ebeC718bE12E92bEdEF2d82Bcd3C26c00B2C97': 1,
        '0xd70464A147925dDE45821d92E07a49082107B862': 1,
        '0xbD75bE714d2E3160974C8efA63007DB2BCF91c23': 1,
        '0xcE968c0fC101C4FB8e08EB5dB73E7E169A2A3562': 1,
        '0x1fb36B64649E6D55E100B31D8113cc0F7DD82592': 1,
        '0x33d20F06b0021E9013F39D8F0dca1ff8BAe0A15c': 1,
        '0x51A7aC913D75D4423223Ee28bf954D3306a7b011': 1,
        '0x1DF70766FD4f025597713F2863e34D7D75777967': 1,
        '0xf5dCb2a47f738d8bA39F9Fa2DdC7592f268a262A': 1,
        '0xf49d2bcC52F0b46a98204721f98Ce9d4e6730BEd': 1,
        '0xeC89639d883A9Ff2086c6DEb0d766064B5BbEa03': 1,
        '0xE175A11F7Af6CeD6930d74244CFD4CF7B443A855': 1,
        '0x6F1B12a415E035eEbDc8559130eA8bdb96ADd48c': 1,
        '0x238926025E84475e3182774df480021470f8F978': 1,
        '0xe2f6659e0209C3f79132AbDEB95abEBa0f1f672F': 1,
        '0x03A49b5cc9921a068bFe8605A73aBCd24762fb0A': 1,
        '0xc1B0fA49C46Ebfa755935184f65BC0E3A2DA4584': 1,
        '0x022Ce4715b44EF6F0eAd8561B29dA676928D16f3': 1,
        '0x277A2b64a218cbccE882A40689E74624D698Fa15': 1,
        '0xD5a41BFe8e373C94434eaB2fC81034eC00572b09': 1,
        '0x35064d69608ea91a65d8479a29F901e08268302F': 1,
        '0x0167e90419E88af293CD479537568D63F4CCf2B0': 1,
        '0xaea5B623cE1B17C7d871A2747850432c89ba7fF6': 1,
        '0xcf192e832Af50A8F92094927Cc822A3A896654C9': 1,
        '0xB413A48088Cfb0074F75349C790062920434e321': 1,
        '0x4254AcE855E28CF4bC8D1A0F516b7b2DE4628f2f': 1,
        '0x1121F4ca9fb820C6B6731cb15Efc8f0b77b1C5f9': 1,
        '0xE269F15f201caFB61769B944C566Bb6c70597050': 1,
        '0x42B9E5A8355f948595275919eFD80423a3E51803': 1,
        '0xA9Cdf0542a1128C5cAca1E81521A09aEc8abe1a7': 1,
        '0x5624Dda77a7B12f9Da10E52D97Ecd678b0Dc6AA9': 1,
        '0x16eC8a7F9d21ea94Be12d4765aD2E5597f82c9Fe': 1,
        '0xe085327c5AD2F77147F10973Fed45Fb19d734F7e': 1,
        '0xeF8e26bCc5f0d49eabad131974Bd2D4Ed3782835': 1,
        '0x0206Bc8FC7C1e8635D14F73c0fdb035493F2FD84': 1,
        '0xFB2f080bcfB10eD3117A3B23653BF23fc3CAEc71': 1,
        '0xcAc59F91E4536Bc0E79aB816a5cD54e89f10433C': 1,
        '0xE5C306c10edC4558D9882D8c8ED6f026A3b33120': 1,
        '0xb42cD7ca17420a2289765A5c05a5C272fa9a5a4A': 1,
        '0x12E7bD1eE32e82Dccc1b780a8BF9D941702883Dd': 1,
        '0x91a9B4DA163a1F248C92DBd262aD3e95e042C87E': 1,
        '0xfD16B0f85124D711937b35eC608a1b47Bd093D9a': 1,
        '0xb39Fbb76E7677fF97397a1683D01F04df4cFeD82': 1,
        '0x75571C525C3E904F7B1Dd1a19B34f5393428Ee51': 1,
        '0x4F979A1f5C4AD2B583244D33F310cF3Ea0d65164': 1,
        '0xaB96637e45281A4c734407165eA49eE3Fcac7020': 1,
        '0x5C239132825898bC0047Ed8A6b347A8a4Ee621eB': 1,
        '0xdE42DDB51678d999AED372B7DD34942C3b2C1442': 1,
        '0xd58919830Be1833052B8321021218F10d80d088d': 1,
        '0x2158991E962776b2771584ecc9096a420050DF73': 1,
        '0x750c31d2290c456FcCA1c659b6AdD80e7A88f881': 1,
        '0x2BA56A2415DEdAaeF2a54a1A6CC90d4555e0000d': 1,
        '0xa8162e67B831a06Df36943FF0221B4DC52dDBCA0': 1,
        '0xC3db09cd17f9C442AFdD164c11608650362b21C4': 1,
        '0x881607303587A0C08887cf27E09B12519fD35028': 1,
        '0x90560B4eE0633F7d39D4426B7d5Ab276a5b2eF9B': 1,
        '0x9f1879112fE0b202012f977729Be2666E1bb2cD7': 1,
        '0xd87EcC6C74F486B044824a222326A96F696fCfA2': 1,
        '0xedC90F1Ac0e0eeDd7D700570a50A6F6Cf494A4AF': 1,
        '0xe3908316Da01ef1C3FD6787E28768074C60c475F': 1,
        '0x5bb96c35a68Cba037D0F261C67477416db137F03': 1,
        '0xA3C55527455be03632F9a10614fb2A06E00c9B80': 1,
        '0xf69f7faf5fdc1268d0911C08A1e51cC8738A642a': 1,
        '0xBbAAF7095E5f4e74b11534532C5D43a3c364bAd4': 1,
        '0x744Aa8938FCAc6eE2E2c4376d2fC203815980A70': 1,
        '0xf0562d00FB1e89CD77E96b726ec5fc565B285a35': 1,
        '0x214Cf0F729157b92874d9811E6c63a61Fe908Baf': 1,
        '0xEc1625f0Be12B31d8edfdd165f7750eE4630a475': 1,
        '0xA9D89A5CAf6480496ACC8F4096fE254F24329ef0': 1,
        '0xBF99e2439E072CE8f6bb8e119E6C6149AeaBFCBC': 1,
        '0xD6E6A9d952f56E48462092bBaDaB346e95E987A4': 1,
        '0xB17aD2100087192Ef8d5Ba7b5E0905A614a7058B': 1,
        '0xFFfe1F5D42DC16AF7c05D0Aa24D2C649A869B367': 1,
        '0xC8F73fbC5a8f832aE4c106191269B2A1Be93e83a': 1,
        '0x12c604e03B9d89B8e5f6B1c65a35752E6c791B64': 1,
        '0xa946174c101C8631AA1967d2Db1477558f174649': 1,
        '0x71a15Ac12ee91BF7c83D08506f3a3588143898B5': 1,
        '0x6395cc6E900B1A29195BE284979131e02f831683': 1,
        '0xed17C898b94f1551809481F07D7241f42ece42Ef': 1,
        '0xD71C552a4954673a30893BF1Db0A77f1aFA1accD': 1,
        '0x64E5ABD6d7291d9B1d2C2eC72B823E85771f5334': 1,
        '0x314Ae9291C2e1b43a6f8B68Ba7224c0b77A55dE5': 1,
        '0x9907A0C2b010F54A08f16628aE5E5745D332913c': 1,
        '0xA8695c67368356Db076e8Dd2b36B4595a34e91EC': 1,
        '0x8Cbf7A00DE4327f173C2a83Ff8A6ff63dDaDbcF2': 1,
        '0x14b889B25e70f60D8Dc0aa5F10c83680add61351': 1,
        '0x7721F140C2968D5C639A9B40a1e6CA48a9b7c41D': 1,
        '0x7949eD1B419126E201aBE404A65A226e2d5dc6d4': 1,
        '0x2E69476D174E9caC1C9c1529c67c5ae66FE933FF': 1,
        '0xDfb9bc53b37b3bd28836917eF6AbFab01F974421': 1,
        '0x6e3674ab23fea3968e0e859Ff89c2667c9C4cC74': 1,
        '0x67BC76E8Fd78CC59594C9F43C643eA7CAfA48669': 1,
        '0xb271769c54B07E33e7F9f337faC2988C404e1da9': 1,
        '0xeD2C2CdEc695be3A4Dc421c1A8a6756dc5A927b6': 1,
        '0xEf191aeb45A0d6f393D4a592f94152836d5758f8': 1,
        '0x6618244141c824210dbc8ec9a95C9221c576470f': 1,
        '0xc70C99C1485eCcc693e434433edBF5C27f937499': 1,
        '0xdd13eB27AF410eA094C2Ac357f1B79b62F738062': 1,
        '0x31287CFd583CB46f7A995eEE642A1947EAb7f8A3': 1,
        '0x4225881EFe0E02368c7CC9EF00783880b6c27134': 1,
        '0x9E7943cEAc1f02B00E5f9d6E182F257efaA4653e': 1,
        '0x135113608F56374bEBF50323d410f682D1cCA4ba': 1,
        '0x19B570af5DDdb8F0f5a15C83d07A1C5153865188': 1,
        '0xb03384cA294C06E8d04B08412E8467ff2363E5E3': 1,
        '0x161B55D207EdaF288cB1Eb22b09e3614E16f2A78': 1,
        '0xbdAD8d6ea11b590DC0a5ae002227CDBDF1c4DDD6': 1,
        '0x5a81AEA48E5679179052F12551aE0297E0315aE9': 1,
        '0xCB4CFeC0a49Cd229909C54003930DD989806F176': 1,
        '0x67770b782Cfab1dA42A0079C35Ee47e49D89c584': 1,
        '0x71338F15943632Ee9eB07d0bc72dFfcDb1B62401': 1,
        '0x116a45D9CD43c16D3835d09C735a69BeFD447866': 1,
        '0xd16FDA96CB572DA89e4E39B04b99d99A8E3071fB': 1,
        '0x4900174B4111660100B36F8B42c2a9Faf5222181': 1,
        '0xaFB1317A99cD22175Fb08e7473245e1D1ec716a6': 1,
        '0xfBdD5C349D1686d7B15B27f47217c55fE93D2bfc': 1,
        '0x740922622811A8Fc1A5AF687aeFe6D5BBC460Be1': 1,
        '0x67C14DBceA6b4e203639466f29cE804CF6325eC7': 1,
        '0x6512264566bF91eFcA43cAd4e4495148511C9EDC': 1,
        '0x36F22F65a3476F42f6Ae813DA097Dd471FcADEb1': 1,
        '0x276f6E63a60A794866f13fd86C748972F83A2E2f': 1,
        '0x9a89aA7b67ebAbA68141fb92eD5253cC3F197F1C': 1,
        '0xb3ABc96cB9a61576c03C955d75B703a890A14aA0': 1,
        '0x6E53Bde1652E4f535D49efb996Af3F713cf111bc': 1,
        '0x2cEF4BfF1faa6D6935f581b0D19CfbE6cd622ee5': 1,
        '0x458129C4C58ec38D45b4274b2De2991B197f9d13': 1,
        '0x2BB7Ce5f7750E6e21445243Effd48200cBb63E49': 1,
        '0xB1C6dc864459E37Cb997457556363083158D3bF2': 1,
        '0xBa7e5fbA171995C80dAb3a76601Ad5A8d298d86B': 1,
        '0xE340b00B6B622C136fFA5CFf130eC8edCdDCb39D': 1,
        '0x9E42f20Ad23FeDa0cCa899abe688bcee67cc4D5A': 1,
        '0xb5fB1a63da629C39687d917f4A9bbB49A4e283Af': 1,
        '0x2e8c6fa5C53324Ea9B2bf78f6b4997dc8C166B11': 1,
        '0xcC22F7F6A8296ED44f0F0E758374675120909177': 1,
        '0x483a44E5Ed038f23518F7222a97F8f3E8AcD138e': 1,
        '0xCa9ba74eE20917211ef646AC51ACcc287F27538b': 1,
        '0x0B3427E890d456bfd618172d8ECa2eA3F3376BC1': 1,
        '0x6C70e5FC4e4926CD836A6F8B0645Aa1A077fa605': 1,
        '0x3e3672B23eB22946A31263d2D178bF0fB1f4BBFD': 1,
        '0xB82AdF9206FFA17B5BE784D94A8AC76606691C56': 1,
        '0x0040DAAC32D83c78546ae36dA42A496B28ab09E1': 1,
        '0x90E1F595Abc8D731cf82031c974aDD334B84b29E': 1,
        '0xca768c37ba6EC3d67bE7B47bbE1F1C94CA216f46': 1,
        '0x2EDF1B3374234D8bf7e95a01c95B47121B75e17f': 1,
        '0x07e78AEf434503dee48Ef154A02b8A7Bf43050D6': 1,
        '0x7E8e66E8834F762077dEeC97F792d83092EBE431': 1,
        '0x358De7BAE44025257EAE6dd2d9774E7CbDbeEeb2': 1,
        '0xE64Ae0Ece666594f65953B10658Bf0f7B3013Dfa': 1,
        '0x8cFf7de2E63c2799F74B5efCd93571462D9fbD3d': 1,
        '0x174Cab72ff9BF6ba3733EBc819fADB4DF2903235': 1,
        '0x4B933cD9E9965bE2388aa2b0e26F4104deCd9e27': 1,
        '0x81aA6141923Ea42fCAa763d9857418224d9b025a': 1,
        '0xA4af691741a249187F7aCAc788e3Fe8c8A0C28CF': 1,
        '0xbF15754dC61f5e552a5C5a51E6b571D567798650': 1,
        '0xB90e06d0E812d9AC7aEAb8706C2eB45030b66Ccf': 1,
        '0xf7A8f04C7fE7C8A6ED692Bdf5EE1658559cbE7Dc': 1,
        '0xe5782fa93187334169052b61cAEa7d9bF9d508b1': 1,
        '0x9064ABE13d219fF7482f1a434eaC8A8c8C9bcF30': 1,
        '0x8dD55c6A35411D46F345D5977f00e4687aE1Ae82': 1,
        '0x5BFA69517E17411bEDA54ea2d3672709F4867254': 1,
        '0xa9f078B3b6DD6C04308f19DEF394b6D5a1B8b732': 1,
        '0x5b655EDa7D101f98934392Cc3610BcB25b633789': 1,
        '0x7E0099ed7A5ED2BB9D046C2c95f24565cb204A72': 1,
        '0xd343c92012019B77AcA6290Ac5A85F55C98C94AF': 1,
        '0x8d92Ca432FC474C9CF5E56203a7E5fb752326D35': 1,
        '0xD2F91edD7DD5388737552d18d99555313dCD78E0': 1,
        '0x14B802407E24fEfFc77B75eaa45c1213e5C0E0D9': 1,
        '0x8CbCFa0D642C9FEB55b3fF6A025Fa6327B03E8eF': 1,
        '0xEeA82a8F223BB4905Ff4519CBD0560961D23AD97': 1,
        '0x5F071f2CE06084811be5B2EF2e9D2773f53d32CB': 1,
        '0x0000CE08fa224696A819877070BF378e8B131ACF': 1,
        '0xA0Bd213eBA4A6117d2ad12D86Dee6876eB5f034c': 1,
        '0xC9420C9349120CA88D6C349CDF4Af038e2Ca5027': 1,
        '0xD9b2F5dc0336e20cd82D3033480a035dc5356635': 1,
        '0xe69A49F8F9C1d66fefA66Dfb61155c06606986D1': 1,
        '0xbE93d14C5dEFb8F41aF8FB092F58e3C71C712b85': 1,
        '0x5C31Ad35da16B347f2c3B8E28A4EeD81bD4538Ac': 1,
        '0x1147ccFB4AEFc6e587a23b78724Ef20Ec6e474D4': 1,
        '0xE42C80520511533FAa23A576397D7a917609d5Cc': 1,
        '0xa33c7f924399b59A8Ee627388A108beAb5E12EaF': 1,
        '0xa50Ec178Bd0B184A890AB6d2e7a757a01Db3a702': 1,
        '0xC18D03a8Be67cb08c01434861Dc561a70c4b3aA8': 1,
        '0x42Ca45B785d87b8375DFf176555C745b27D69DA5': 1,
        '0xFA7513021002F7181333B773BF801DFD7fd91ce7': 1,
        '0x942cBEa64876Ff0b2e23c0712B37Dc0091804e9c': 1,
        '0x0b13f13c0E99F24b96A835B787D1347B33d87776': 1,
        '0x271Cd6b80862dD51bAb7c84B7A562c81cD7d9F3b': 1,
        '0xEB829e2fa607Da8DC656C31AFb2784C8589fE2CA': 1,
        '0x6AAd4B495FC142fb725253C60f13d7A27401532d': 1,
        '0x49C233D25768E462F0474390F653BAF40DD592b2': 1,
        '0xBA14D1386d75F6305f78e75355f8A49069BBf755': 1,
        '0xD30F2888E7928b52EA5bF4cb1D323e0531aFe272': 1,
        '0xb1497D55d3b7ff609080535624E1A5fAf5A14eD1': 1,
        '0x58d4F668F37CA6D3667d0A4EbbAcC3f29D4B3beF': 1,
        '0x0866f8D156DDdeC441a333117156A4fd23aFEE62': 1,
        '0x9395820a6726349525904545d0C2971DCB3D2e1e': 1,
        '0xF3F49Dd68586335EE3b01A86368043508c962C2a': 1,
        '0x42c1905bbE243cc125Cc7426381309748091F250': 1,
        '0xb8fe77EE30ac42aeb913aD6bE67243fa9B241AE0': 1,
        '0x72f254633d6B709BAbfF5428D0e22Ca8B2771bc3': 1,
        '0xa5b5E8754e87E9e407F548128855468db9747126': 1,
        '0x681F284C82Eb81054D6696aCEa2020fDC68f7Ca3': 1,
        '0xa622af849a6e5D8C5755307E5FDE49aC02E4f28E': 1,
        '0x5A3C1249D03488f53bbC30b5a833A390372095ae': 1,
        '0x5e5332599DE4963D42D3CD9140fd86f51a1e3304': 1,
        '0x648AD6f58367B42Ba3EfAb45B220528E4F180437': 1,
        '0xDDe3e2024e270d6022d1bb4E8745e9DC6d82e0bc': 1,
        '0xAE26E52d785fcd3a7DAB7237c00Dcc69D1ff759C': 1,
        '0xB89039A9E26388967b7B1A87b872318F102CbDD3': 1,
        '0xA3f76c31f57dA65B0ce84c64c25E61BF38c86BEd': 1,
        '0xe7F9D2D4B6D3d8535Da330041aE7Ce814C35622B': 1,
        '0x0B83d0C0976b71724054E9F74A471F7d1c7AbDc4': 1,
        '0xB8C30017B375bf675c2836c4c6B6ed5BE214739d': 1,
        '0x85CB3e8473Ed79B27AE1Aecf18BA9db51B87FB33': 1,
        '0x368C4E8933cf3577CcC394b4e05b4E03691493f1': 1,
        '0x0Bc721B2301b61534f14e0035910bca83E11Ea56': 1,
        '0x2Bf1477B70c565BD9D6bdb707f99042359D4BBAC': 1,
        '0xCdA1a0ECd7D25B49Ecbf0EeC1f45f0B7fb59961b': 1,
        '0xf6B5FD8e2CAC43987DE603ce7942E09e2DC8A2C9': 1,
        '0x8796a5Df0fab45a7726CB8cD8dDF3D0122185dF9': 1,
        '0xbd094BcD41A7385281698ea83a24224749DE07bE': 1,
        '0xA6B49397ce21bb62200e914F41BF371E5940Bb41': 1,
        '0x0F9548165C4960624DEbb7e38b504E9Fd524d6Af': 1,
        '0xDDfbAf93eD5056fF616f6b56c56f901EDA4B8BEd': 1,
        '0x6C99C45b39D1cddb61b272798ea1dA2cDAc9bCc8': 1,
        '0xF8cd371Ae43e1A6a9bafBB4FD48707607D24aE43': 1,
        '0x923383F8218D66207EAb697B2a417512DE0B320B': 1,
        '0x2b0A297590b2af143c5a6bE58Fd2034690e502b5': 1,
        '0xBFa43bf6E9FB6d5CC253Ff23c31F2b86a739bB98': 1,
        '0x4E6Db77e079F7c2232F07dBb6375274C60602b2E': 1,
        '0xC42008F4AaDc0b487F214d738fCdCea1D0488e9D': 1,
        '0x9e114e8753824494B7A4e388c0E4Cc3093345325': 1,
        '0x5Fe30b7c0ed489493A42A8Bc43b8A73Ca72F6735': 1,
        '0xb5110d442091098CFA560a7C0B80F83Af90c14bF': 1,
        '0x954F1D97aE9c4a27d012e70cCaAfde29822B3F2B': 1,
        '0x0eEF1558C2514B96A13bDb3FA47ac8d37f7a65be': 1,
        '0xF0c9450C5F22E188A27168C17c3a178c0b3363Ea': 1,
        '0x1dfc4B48987Db1b970FA96AA1AB07dc895D89a70': 1,
        '0x60df958EF7ECF51F3bc2D7c0d78eFFb9cB8c33E7': 1,
        '0x0EB4ADD4bA497357546DA7F5D12D39587cA24606': 1,
        '0xc78163f8C600eA7568c146ec29d5232A341584F3': 1,
        '0xe4989e7B39a21089B128908E1603fdC9939DBB78': 1,
        '0x315E1A5C796B734585c27E615b774441372Fbd08': 1,
        '0xee439Ee079AC05D9d33a6926A16e0c820fB2713A': 1,
        '0x00326E37CEf76788F6b0cF643c94481D60BD3D58': 1,
        '0x67BF31f6f31a3bc22B9F22a13D782365D9F25Ea7': 1,
        '0xE1dD24c0189CfB54B74371A4B35a01EeEd8Af7A6': 1,
        '0xFdD3636CAEB29b76fCb9472A93B73D36C7c3F5bF': 1,
        '0x076837813bC7f53e4BCd21B0bcc92E988AF3A2c3': 1,
        '0x0D81A04416Df8A335aB4856d55D238373458910A': 1,
        '0xAa3D5aB57060e32546E45E7FDDdBF482879A3609': 1,
        '0xB84E634c4A8DD427Ba34286F76261d6EDc135F56': 1,
        '0xa37C1839c76F9A9be53C6766D613C278Aa383CA0': 1,
        '0x9b4a72c67215bDaEb6e14F101871824131787d20': 1,
        '0x330eb75dBF4379653cD5794DA93f6a9b6Dc20627': 1,
        '0x70aD81d18F2838b8650D88740d8E337032c9BaAC': 1,
        '0xf6b25A5dCB117E524C8C7355af90886286E9f33d': 1,
        '0xDf57dB2b87463fF7592fe418D445e3a9BDC61476': 1,
        '0x8A5A6595eB410131e70De61B5f6e8737d70Ff42D': 1,
        '0x07c2af75788814BA7e5225b2F5c951eD161cB589': 1,
        '0x87cD5161b1b942DC2F99D9A0bd52F73321021519': 1,
        '0xe60F89EfE6A22f8953879161aa0423B103552762': 1,
        '0x14Ce500a86F1e3aCE039571e657783E069643617': 1,
        '0x7263198C709A456CfDB9d968c9EC56dfb111E5B2': 1,
        '0x2f193b7e2a44CaeDa1AB1CcfB88840A685492F2F': 1,
        '0x38430336153468dcf36Af5cea7D6bc472425633A': 1,
        '0xA5fec37d68171781fB3f93702A30905Ef75Dd22E': 1,
        '0x5cb1D4B99F972cCdecCEFcfeC638d72f9629B5d0': 1,
        '0x289922fBBfBd38472D7e2A1652B33b834f7c0E49': 1,
        '0x7b1800B20e87e607b2791282dfF9e069Bb18493c': 1,
        '0x3DD5579e96eE5eb96D1271A3E6E4EDA747131444': 1,
        '0xDb8Eb119800a162017E669Ccc5910cd65d6Ff96A': 1,
        '0x00Cd9Fad11d5B2118a3dd32d5d43FDb33BDe9e85': 1,
        '0x00000003Cd3AA7E760877F03275621d2692f5841': 1,
        '0x7eEF74aDEB88AeAde2257c2394211bc01308A9e4': 1,
        '0x0103a4966daba5a947df52b0B892d8b3fdEF5A4F': 1,
        '0xB81a0e6c38c3Fec8A171cFE9631F60127a0C5bfD': 1,
        '0x758c32D2F0B32D3e0EA1e8D0D24696fe9B69D148': 1,
        '0xDF51a1e4808d1442d761813dc4D4D2BA05A9Fd09': 1,
        '0x896b94f4f27f12369698C302e2049cAe86936BbB': 1,
        '0x1B12a86b6747772eB526b88f57B319b48279726d': 1,
        '0x1aCC962454C4ECeaf216Dc1f13D7949B4cFAA065': 1,
        '0xb270Dd05f41A7Fd0FfCB3DC26f3F982998A7CfD1': 1,
        '0x726CDC837384a7Deb8bbea64beba2E7b4d7346c0': 1,
        '0xa8eBe1eeD676d5BfEB7F7B5933625281489aF8A3': 1,
        '0x53722De78b31aD733171Ae8cA002f9170f8659D1': 1,
        '0x8f1eeeB81A11338674DBBD6722FC6038f556d8f5': 1,
        '0x71232EAd3BeC1AC03eCfE2556acd6c7D0bD349C7': 1,
        '0xb46660091553d40433e939eb94fABF26420BF2D5': 1,
        '0x8DC4310F20d59BA458b76A62141697717f93FA41': 1,
        '0xEce8d27ae1dfB604979fB6934e947B287e02eB63': 1,
        '0x13faf5475DE4BecFa376F4d540C0F7831b88B903': 1,
        '0x98671aC3CCfb3144161708D6D181aC78ce5acc59': 1,
        '0x7FbD935c9972b6A4c0b6F7c6f650996677bF6e0A': 1,
        '0x82b2c62017aBE2E32d688085Ae32a6B506F66F33': 1,
        '0x5e78dbC9c8B90dAAb0541CC9A433970A8569f4dC': 1,
        '0x4127b2d364a8B1a10afdA5d63c95253Ce336c09B': 1,
        '0x7E0797381e6Ba0575A7c2aEB7f00356bEfb0FFC8': 1,
        '0xf286E07ED6889658A3285C05C4f736963cF41456': 1,
        '0xB5E95ee834C72F8FaF8eC9FF18eBee593D0b295D': 1,
        '0x7cB9ed2a2BeD605Dd5B53A86291111862553f2cb': 1,
        '0xFE69FB531698B534a2Bc895940C5d37876b04Db3': 1,
        '0xF99cCF26AaD027bBd11f1ebF8392BA729a454015': 1,
        '0x5ba5FcF1D81d4CE036BbA16b36Ba71577aa6ef89': 1,
        '0x949b82Dfc04558bC4D3CA033A1B194915a3A3bEE': 1,
        '0x9a11d1D90AfB58a22C566EC63f5b3A7554970aC1': 1,
        '0x7F957B7Fe99dd0D515A2283420b6D8702Be2ff18': 1,
        '0x374C8AFB8e7D75C71D880862DEc75Ec2dC5Ea380': 1,
        '0x139A7F3E0B4D4Bb9a8c5eb5cCb047dBC2847885A': 1,
        '0xf2c908735d350a7057Dba61540f5F8e80D1BecB3': 1,
        '0x9a22A348CB3d4Be207Aec0d45267671cd68Ae2f9': 1,
        '0x4b37eeE3d80E8717CA81556c131732f74fA2280c': 1,
        '0x88E41Cc6fD8239bF3D74Df6D4e97C3bCE773CAFF': 1,
        '0x54B7f8fe8D3AAEeB115D2Ae1AC9Ea5d6B824e2dc': 1,
        '0xd59Ea76102b0f12D9a6F756Acd7A029d7E92DE01': 1,
        '0xE913c0f42fB60F85Bd43bDdDAf4e004135eF318c': 1,
        '0x746c7757501193aF295797d4F338121Cf22A4aCd': 1,
        '0x39480bd4566496ea4F283AF164f8c3eEC563d70B': 1,
        '0x8c902B8839010BB1761201d42f788e7eD9FCFD77': 1,
        '0x67857AF40F0474A310dc05A3Cf882F0f7dec2b33': 1,
        '0x4af3bEE5863498f1F137193F475967808d39fa36': 1,
        '0x1Dca1f25E29Ff5C35BFb4a6E39ff872bf717945B': 1,
        '0x9c1E38Fb29E4269292aE640b6e0f107dcc69535D': 1,
        '0x27A3deb48Be91537E19fe85497f92C9c8c21d87f': 1,
        '0x43D9C66ae6D757951D21A27576490161e1438756': 1,
        '0xE6fFd0fe4aCcE47d26887f474cDe7bBF3A84d1Fc': 1,
        '0x978260921F7A56A98011E752E3B6847387dD9e13': 1,
        '0xe5E3530db8b5D8CD8576Cee23e8a8d9e330616Ec': 1,
        '0x069Ba44bFe4584ECF7E5C2346e2cBdC916bf30aC': 1,
        '0xe6487d7Bfa9243916C8658eDF99Cb0eDb25B2Ca5': 1,
        '0xee2826453A4Fd5AfeB7ceffeEF3fFA2320081268': 1,
        '0x63f5782417C6bf1444A547b23A2859392d3c2F32': 1,
        '0x632900d0C55d486B4714b093333D6094e6CC33Ac': 1,
        '0x2A7051d7CBbEF7B6889f8e14774020b1653b94C1': 1,
        '0x3E8f0bcbCc283296fD831Cc5312714335F19B340': 1,
        '0xA3F16A441B33fAc19408eA0e5761C07C0196e825': 1,
        '0x22Ab2a19d330b1fb4BFA8cd3794Bee2bB83d5eC7': 1,
        '0xC8d4a8970035f9F3fd01dbd238C97b5348Aa3199': 1,
        '0xea7AB83C200e7EA53d00079d1f2e526dEc4C611C': 1,
        '0x066377be46FC309c3f04D66FCdf98ee868C5F53f': 1,
        '0x34665577f1D363D839B88d24105833efEd0C592A': 1,
        '0x86aF94E5E8d3D583575bBafDD2DcB6b898A555e4': 1,
        '0xfCD7A92b419E963E444E1f840FD7eD51aa2DE121': 1,
        '0x7290F9e192ED9Dc846E07c8DE8D03195fb7078F6': 1,
        '0x9A9bADF8b5d14F8f2340180EEaC1c80082f26289': 1,
        '0x8BDF54f426f482D8af137587065F105f4B284cAC': 1,
        '0xfA9f0c8bBF98950e8FaC468289cb1a6F2BF2fDDf': 1,
        '0xc0086B553313bB99f7376c10f2D39e480966Be00': 1,
        '0x0d307D9C8B6D4aaD162A662E4bbFbA9Ea96A5F81': 1,
        '0x731097Ac3088B7f23142490A8Dd6f50C6a90ab12': 1,
        '0x25d9d6f36Fb3773B98284624E2A58c0CB3C98Cd4': 1,
        '0xD7E630AFCf128feb8b9071A8412914478c00C22a': 1,
        '0xCf7841FD47bF33004B07eDE874e7aFC714616231': 1,
        '0xCa549E2700672c95AEF8B93b4C36CeBf429f73C6': 1,
        '0xD98e44D09660A89022515d6d41662d05A14253e7': 1,
        '0x67a4Fa7b9a44615FC08d06f63827d896c44220c1': 1,
        '0xD7b2879C8922cd704E41E8CC1f18f6994D6B7C36': 1,
        '0x29Bdb1B1d9c6Ef658724Ac9F4d8C1a7645F5787B': 1,
        '0x351D408A89C5a9F721e5c4A484508ba48D973b41': 1,
        '0x5614c3f40dab746Fe0Ed13fe9F3d00B6578e2dAc': 1,
        '0x96Ad44C2c9F6746b85FEc00e48146357daf450FE': 1,
        '0x6Bb84ACDA075cf8aDb3628d57CD8811aFCBD189e': 1,
        '0xaB02cA6151925a94fc24683694A812bc7bc8593B': 1,
        '0x4D168Ae4409f7b4Dcb62525EA00e311500873844': 1,
        '0x56b6aE8609Ef719478e84c7605ae9604816d699E': 1,
        '0x3Cf08D6a9436A1798C18D24a70f5ad0Bea31775E': 1,
        '0x4fB685826A37c4d607059c53caC1B9142F295F01': 1,
        '0x994560Fc97DF48d88F40b3A242D652cB2999d763': 1,
        '0x3DF10334531A3c86590245e12Be0104Dd3459159': 1,
        '0xBee558b39985eaFc9c0E531DE748968F38dd3421': 1,
        '0xce2d06B799ff861E6c19E73Cb5aAac243D50aE93': 1,
        '0x035221cF1bDcCd8100531B6B6dCC06fA806A88bA': 1,
        '0xa0c34BBAA764B2d5E40fbBbcBDb91475167CEC82': 1,
        '0xb514e1fb5DFFaF8F1d8721E50DA703863F68008c': 1,
        '0x9Fbd924960f91cDf4473747eCb91667Ad8925f63': 1,
        '0xe2aBE2706a8Bd68FE8Ff82dDA198E34C84Ee5d76': 1,
        '0x2Babe76345D7Eb15f6a1C0CDDba04d8ee44491d5': 1,
        '0x8ef690D43e73cbA7aD551288173dd02Ff0B1aA06': 1,
        '0x084E93a9EE840216992ACD2Df0BB7259b9995860': 1,
        '0x6f9f3bc055C5f86972E45588a610349824f69eE1': 1,
        '0xae510148eed96ca181E50Ce3656e8cDf95B0D665': 1,
        '0xEAFb1a7bb2DA730911e246ba071A59551D581a40': 1,
        '0x2d48c6432CC4000A55de200341a8E65a1cAfa400': 1,
        '0xEeD8403B6513c80Bfcedeb8b616796e4b91D1a0b': 1,
        '0xE76c5C62468C55a4Ca1A6794C3fdF03aC317B71C': 1,
        '0x8474c43970481015019819936793DDc210a0050e': 1,
        '0xB8153Ae427265daa3d1C8704698b2Cf66F59c4C5': 1,
        '0xBA08763250974b97A50E312D7dE484Ad2CEea4Fd': 1,
        '0xcA46F486A36594DAbBA36e6E71A07db87dD53171': 1,
        '0x6acd5B62343c957A064C9F9064A5bbe45d5A9A0d': 1,
        '0xe44799Ef334Df157e0F8e2855E5EbeBdBc02b299': 1,
        '0x70448fa6Dd61fb3f94B806d5dEF4E5E8DBeF7ADA': 1,
        '0x376955C79B654e1F80733D127394d8008e953882': 1,
        '0x13f3e5DDa188F2D16cEe5C02d612c0019C07b638': 1,
        '0x5886549e442724EE1D82E724Da2666A27EC7E269': 1,
        '0x7141367B576cBB7bBDE451a09490256391FeBB11': 1,
        '0x23E6F61F5472c8afa34bc4FADCfAA7181EfAdF76': 1,
        '0x35EeD523F7DecF63039e16D5eD762b581E5cF950': 1,
        '0x5A41D48673dA40f5343bc1e871EB360AD8B9bdFF': 1,
        '0x26977d50e71d02eCEc4c50F94A1b39C068932312': 1,
        '0xf68F5D6e5D9B9D172BC4Ceb29cE1974a483C0e33': 1,
        '0x68575571E75D2CfA4222e0F8E7053F056EB91d6C': 1,
        '0x97B04C20cA1Cf1E89249B7b7B7462eb382E943e7': 1,
        '0x53107E0Cf5bB0bbCD5139bBde4fA75F1E8f61F25': 1,
        '0xF7f20Ccc773ff7fe7f1865e37393D0f55eAf72bb': 1,
        '0x4118D9aBec90C0dE615f1d1012d055a0B84A40B9': 1,
        '0x9e1D9BCCd7bF9cA99A8E40d51f64c3F2e1cCe200': 1,
        '0x81A4baf692DEcC4e07F5c03F16bd1e7c3fF59f82': 1,
        '0xe81d4A39AbA7AD01863886A020302e21dDc9f7C5': 1,
        '0x751893105B1eCe3b7fEda367B92Cd1Bcf2Abd673': 1,
        '0x6495BFC3C0f9A01b24582790Cf2aC67b31edB9DD': 1,
        '0x09be9ab0Eb61327D26904baE69eFdc6633D5eEc8': 1,
        '0x5cb7529B4E05E9C51Ffd3d2046504a86BD1F32D3': 1,
        '0x9aC41e441131d8BAD5f165c2a8dd71e5F7BfaEA8': 1,
        '0x5df52E6B70F25919Ad29add390EFE2614f91b2C6': 1,
        '0x2836545d6E07E9E96A9B622a2E5f4787eC9Cc2Ae': 1,
        '0x572D0085B8894135223eB8B8EDab2Fd39c7010d8': 1,
        '0x6f454FA5C8c9dC56209f6f5D4c7dF32c735C4946': 1,
        '0x30C7f027253dA5CE32179294f6986e3A7b3cf7a0': 1,
        '0x65956436A2a548353ED6649E95ff000CC67E5D24': 1,
        '0x23Ad8FC2C503759B2e46Cc1002DAd07220B4bc83': 1,
        '0x880bcbAaDB5780d8E5cfdB866089586202Ec0827': 1,
        '0x4B4a367C6f5018529b3bbe0BeE27C7dae043331A': 1,
        '0x87DABb37C158A2c8Bc41bbF49d8D343accA05669': 1,
        '0x88c69e649630B7587FbD87E6d03BcB81ce65C8cd': 1,
        '0xf726F0995abb80d4be8dEcB0006993C81B05751d': 1,
        '0x6E7Ae8DEE2F39Eb521CcA1762e0dAdFCCd2E88B2': 1,
        '0x4e7CFfFeb9D2A15d79109C41851A84edADDDEDBf': 1,
        '0xa3f4159B1E1f67420961f9d4F2849E36b0ec6B57': 1,
        '0xFdc3E8eDd74A90fe971EF7d56a0C66c870b10F5D': 1,
        '0x9F9F1A9C106CaDb1f776CC582D3c78da4043dD51': 1,
        '0x14C6DA1c07aDe0B5ab00947B4C23dC83e5E4706D': 1,
        '0xBC6D28a2e0a29423f3a0Bc6CC6e656e1e58762d9': 1,
        '0x2605ea167567559931B82a53d8d0A3dc68d873aE': 1,
        '0x58b36d48b75eC7a50AFE3baC532D6336681A8F3D': 1,
        '0x803c2F7754c802f21A85520c43550F9755F43717': 1,
        '0x2413b4A49ea814bd7D7Ed0bdeB3943800C0b9353': 1,
        '0xC3918CAae97AE8513c60e68bAE2368d4BA6f2B7e': 1,
        '0x1f1AD7B21Ddb1aFAF388acEAe5848fF1Fe7B1664': 1,
        '0xF786b7677120Eff98522796fce0d0A19EeC96bbe': 1,
        '0xAd578990c446aea243D9E05f6A02d1462F283D0A': 1,
        '0x807832994Ba40Fd9E5a6179396b8EC1e766a6b43': 1,
        '0x81C951548530eCcFa0B3Bc519F3fD81fb437E512': 1,
        '0x39FeDA1Dc1CA4Bc732c849c13E45956763790d90': 1,
        '0xDCd9Ba7fc0b8324817a13Deb3c268f80976056b4': 1,
        '0xa10753468D7EaF706a91a7Ae5c021aAea2aaD7d8': 1,
        '0xB089425c9C078b70cF96CC6051850f37f86B1426': 1,
        '0xaD291a7984462d7937727e3d3ac6bAf9cA767C99': 1,
        '0xa4d6a64007538509742C76a96b2a1f50A7d94DEE': 1,
        '0x0919EAC627cA24d909A777B69Db9B21e5A511664': 1,
        '0x7D4Ead368f0f206274931ca91069a890bEa0893a': 1,
        '0x3587B15f7865D4F3F5cA15D29d197bB2f1E6309d': 1,
        '0xE4580938d81F89a22fFD58B2145952D33A67d066': 1,
        '0x34f7a9D8aBcfc0118D00666c2b77152f2c315ab1': 1,
        '0xe930726f7C6aaB3D02457f037e7193835fDa0b0F': 1,
        '0xEF8aD98bf43063EBe669576B08e1A05519e302f7': 1,
        '0x703a767FB6A56dB0888D6A3e56FEdB169B39F3Ec': 1,
        '0x9f6854366Ce89306286Be56853d14b44BF4634fF': 1,
        '0xecA43946DbEEeCF791cb8Ff330F2d0c415934184': 1,
        '0xEdD69A5427576556904D791b18163559cbf77bFb': 1,
        '0x640E8C6c58986c7c1070F4C4031aD15394405f66': 1,
        '0x31eb068f6Af31282F57DeCaAD88726A6bCA65981': 1,
        '0x278BA1Da4e4ff2541234F19487fd94A12061CA55': 1,
        '0x7F688E99EE7dbAE3d07B1b5F46E8fF3430FE5835': 1,
        '0x8D7d7751b908e33E8B362E8Fa7e61b13ad1a68A4': 1,
        '0x036a6BA1fCaD423064D09806479B5fFBf5F22fbe': 1,
        '0xD78f252577fa919620D4D3df8C78608F6F787373': 1,
        '0x2a59f7D6ac28e31715a76e949a805b7c1AE3AcE5': 1,
        '0x34ac4b90c0b891Dab4f88cdE1c243cB54345B09c': 1,
        '0x6139B7c8c6C45AB685BEE7C3764f7d3E7391069F': 1,
        '0xA513022e3963DaED3fB83561ecfCf3Dd591F83F8': 1,
        '0xafabc4dafDF690D69bB02A55678D2E1B8B3feEdF': 1,
        '0x244D1A181B6FA17b807d5aecA1053c4b26e8fECD': 1,
        '0x3d09FaCB91EbF3CE40675d684374Bcb7056fcaD8': 1,
        '0x17a5a3518492863b63e46f83E0Aef1f708fF037F': 1,
        '0xA3B0d8a6227fD2A493cc8306ce3E1E1335342433': 1,
        '0x1c7ECD6EB506248727E5B6500f14106DEB2F2257': 1,
        '0x4B0943930e1FF67E4D4A56E9e912B1D2E47924d4': 1,
        '0xB9ef22FC4f0D30b5777f1eD663CD097Abf9F732C': 1,
        '0x130FFD7485A0459fB34B9adbeCf1a6dDa4A497d5': 1,
        '0xd6cC8DEb414CecbBA781817D7978c7ABbD280d6C': 1,
        '0x51eC880e5bB7bC1c46A4b643b42CDBA9eFCA29bc': 1,
        '0xA54FcbCE3d2bb93CC5a6Bf7c70569308600ea564': 1,
        '0xe6463A048c89d2Cd0da5bD8Ae17580fCca451506': 1,
        '0x40e234f653Ac53e94B1F097a6f67756A164Cdb2D': 1,
        '0x333a7f83092e68f334D7d0be15761849C6820bEa': 1,
        '0xf1c219204810edea94406c69a06Bfc91d695D1DD': 1,
        '0xBCb881AA8d0b3e786D00d0aE83c52E0ed078dCC3': 1,
        '0x5F40b4E234Ce4771f70ABe5cb0a2c5253d7BD9D6': 1,
        '0xc138aE7bCD1fDe0606a4eD6c8B7413e80c796915': 1,
        '0x8A473EFb809B1C9eA7A4DD5cDD498e1fAC54Da14': 1,
        '0x3bBcd58f7BF2EfdbF0e4d21133340E440aC23199': 1,
        '0xA7880BD30C4806a35187C4cad316d11ad260f893': 1,
        '0xE748a5BfBBf0c83A48a2d1140Ad4A814a664A7Fd': 1,
        '0xf4e779fE86687b9E7a83402aB0e3088310Ae072D': 1,
        '0x4d698E0380d63D146A43001E9e0B52556925718B': 1,
        '0x1668c9725e27Bf5943bBD43886E1Fb5AFe75c46C': 1,
        '0x78cb5192d3178bbcC8BA7704c99048D94e1F8Bb9': 1,
        '0x13f1913693e3e48ADA424898327997D2326f9d6B': 1,
        '0x0056BcFe33f5c6DfA62B6d3d3CF5A957429828BB': 1,
        '0xCf16c4331cB84899370A43681Fc3B9b18238B072': 1,
        '0x85dAe618f69Cf79dfc36Adb20145f575a01db94a': 1,
        '0xffee03B5b06713406842fF3bd89369BF9F85e958': 1,
        '0x635B230C3fdf6A466bb6dc3b9B51a8cEB0659b67': 1,
        '0x0bd091e299f30366eaEe17dc57D89A85466BBC33': 1,
        '0xDB8CDC1298270bEe0DA974F551A0fbee78734196': 1,
        '0x449833c57904F9d88cD3c26932060A329B93FE94': 1,
        '0x07a1f6fc89223c5ebD4e4ddaE89Ac97629856A0f': 1,
        '0x682668912CB71471b87733E95A6D51af2D3B1DA8': 1,
        '0x5Fc4F4D399eC495d96eF45592629aE809874F1B2': 1,
        '0x5b8970a3cF1136f09957C7CCd9b42edD3c0153ab': 1,
        '0xF2c06f90FB58844C09220e01E3116A2293Df6960': 1,
        '0x2cEcA46c2f487E328277046cc615FB4aFdF39511': 1,
        '0x71CC578465Ec48A868df231ef3C489c6C42f78e0': 1,
        '0x6340448BBBB845249A17cC1d690d6082604ee9b5': 1,
        '0xf7bf70A361f3b1D8Dfce01c0313abF8240210E66': 1,
        '0xdB339999c2d1c17f57990741E4df9d897210041D': 1,
        '0xcFE52E85EA56d75E60794C08e9F530bA5622cd16': 1,
        '0x8E987CBfd0b8aF69C93ea544db8b8eFdD4aba0DE': 1,
        '0x6EF65cf02C2FDCd4d629C13bb68099B8cAF6A7b8': 1,
        '0xF45DB938bDc83a3060e1bd629767Eb0e96E3884B': 1,
        '0x7B65eeCC74cA90A579846e01040d7fBC9D2E65D2': 1,
        '0x7e611a1dfBAc3E3985C747A4e5a68df9A0BF75B5': 1,
        '0x7013338fB56e16395437CC708a87993be3E86d0a': 1,
        '0xDb055D38958Cf7278d3d2BA91A60b754C3Bdae4B': 1,
        '0x923D99E83E0a492FDa01095885bb75a14479b68F': 1,
        '0xE3939654Deae5f54fD3e6B84b3A7F75f245062d8': 1,
        '0xFc220fB83314B4b1E00421777CB579a68f17c439': 1,
        '0x3A1271284bA4A1c01Ed016128738005131314B4a': 1,
        '0x4Bb4b34F4Ded329010FdFAaE5d7Bd491C4F6F2AD': 1,
        '0x4d236C5a7FAeC8F760CF0BaeEE6Be10a19ED54EA': 1,
        '0xfbc42b6d570e9E9f14A1Bf0A39C85Ad2B8f03bA5': 1,
        '0xDf016fa0fce703b1394cFE5Eca1fd2370C875e06': 1,
        '0x7fba88d457ea4B888f10CBecc101f86e36281810': 1,
        '0x77E64560Bd6C323c075F206a5AB9dD6850F31609': 1,
        '0xA8BC90aeC1c948ea9A4D551E74474D8cb827E112': 1,
        '0xD011234F584d278C716dc306015d6Dc7ffA4C539': 1,
        '0x2e1D374Fc187A4049E848918d800347827f350a7': 1,
        '0x16EC94A8473188387E30eA5d010032b528e5Bc01': 1,
        '0xfabD1779b9889e2629cb757E394501B98C3Cf4E0': 1,
        '0x6A449E6FB2704CeA144d088a9989175f9Ed24fea': 1,
        '0xD88d5B3DBE8790369799012310c31Eb210EeeC81': 1,
        '0x21EEA35755B04b31f462Fa180ac67F7Dc524DD67': 1,
        '0x5BFd83C76641bEA157D670e8E0D42a46aC144298': 1,
        '0x1Fb2490C031583b20Bdb48ACfd3F0F2C42FD1b56': 1,
        '0xAeC8D1d4B83d173DBCB5E3478E514f0321565B7E': 1,
        '0x2422D5d8eE568903f42F2a8a887565970569c1cC': 1,
        '0x1BD112494C757d872737E0068Fd1070b48548891': 1,
        '0x000f4432a40560bBFf1b581a8b7AdEd8dab80026': 1,
        '0x050493D0188C3bdF21a7A8CFee5Ed7ACa7f3c928': 1,
        '0xb22E5Cadb0E487Aa335ab99818f5E1B5C0B96260': 1,
        '0x651e2D287352285f0BE29405d611b105C0bce868': 1,
        '0x7E07597eac9511FF8D2E1490C2eb2a1d24FF1479': 1,
        '0x3A6E39253b01BdB1242766d71e4c5e9d7d36CD40': 1,
        '0x290B19D524c6013eD04e68E729071072c0ca367f': 1,
        '0xcb02c5065946D127d701E9b93802db4B8bE1C52F': 1,
        '0xDFF4e623cCA25E674edb0A1f263fCF5aa458ACF8': 1,
        '0x99C515BC95E43697B38f419d5359A3876B68E538': 1,
        '0x865437fd0e361e6482876A5b46A0128F36962706': 1,
        '0x987f05B5eEB8B30b02329D3888bebc3a7424e999': 1,
        '0x78Ebe56BC138069557C89af35EB29023fF31Ae2c': 1,
        '0xf994b0748195D347A16E84D261B17a22d8D96135': 1,
        '0x98a692316057e74B9297D53a61b4916d253c9ea6': 1,
        '0x02E4F367fc7cb77d9b6818440648fC4dD5d21891': 1,
        '0x6c708DbAd5C0383d34334c6c6EeEBc6732B1a4F0': 1,
        '0x4EBF6462734c074aBacD997aB6FAfF97874b1736': 1,
        '0xb2f6129b4B2fa2061BBf6d136BEE016A66D821Fb': 1,
        '0x9C5b0eB419e52d5d229D01898190a05c357cAD08': 1,
        '0x9bcB2C81867665C5230E27025f88C78961c375c7': 1,
        '0x2fcC020F72E5d2EdD2a24D04f3Dc90D7fDFbD1DD': 1,
        '0x60573aF6a5DaEB77697FC48EcF8804A1FC0B5307': 1,
        '0x7Eaac28c9781D60eDE187E51A5DeC27716AA6478': 1,
        '0x16cFDc13ed1173bDa92aC0542e092852b4a055e7': 1,
        '0xbd4FBf5538BD85243d278739FfB0eFcC65De761E': 1,
        '0x3D0eB55100cF5E2A70cD8773275dFA50E679270e': 1,
        '0x4F99AEE4cBB8874249A9a422C31226d9C33B726f': 1,
        '0xF9107317B0fF77eD5b7ADea15e50514A3564002B': 1,
        '0x149b2A1e359A04b94Db27c8b90Ae1e7c5596774a': 1,
        '0xc1129C95D9f16a17F80EFcBDe4F1B536c484C1D6': 1,
        '0x3347fEE5910775B1C4B164d411Dc517D7499A68A': 1,
        '0xF713611aF21c7Ce5FeB85c8083389Bb8E3240B72': 1,
        '0x68E98b046056c7b293320Ae684d5442f08Ae0158': 1,
        '0x025430a7D45D98E812cf12DD59790b9981d4Ff54': 1,
        '0x0FA699182DFa78f1A22f8aBd4c93923dce5d653a': 1,
        '0x3238B53A910B69f5dBDb31786613cE944536BA19': 1,
        '0x4366d72a3E347734DF93633FA301A8b5CdBCC445': 1,
        '0xd49362862D988bB546Bc9cf692D6490456dC5672': 1,
        '0x9Bb0eCb5C8CDD16FDd73b4f1B53BCA38fF81b486': 1,
        '0xDaB558F089dc6CBD96eae358bB12Cb4aD6043647': 1,
        '0x29E93c9648386283012a5444E1bF63613e789332': 1,
        '0x2269DE95c5AdB3b5ddEf6c196522A7a860d8831e': 1,
        '0x2aE9d705e96212dB96470752d32dBBE4787526dD': 1,
        '0x0e969F847F8f2dff9F6892fE834BE92a1cc96F7a': 1,
        '0x3e66e568931F0F32057F516E5187c6FD62D645C1': 1,
        '0xA069F2204CAB4862c861925AD40b113D158A5E2F': 1,
        '0x5ef5a01b069dDf4B71d1fe8C1b23064Ffc3Cda92': 1,
        '0x24697FCDeCa4C9a99a377309569556DF4fb1D301': 1,
        '0x8F4dBd030b2cf0C146690649801c7843Cf01dE9e': 1,
        '0x2d5Fc789579C907Adf1346fcdF02E923C5eB3563': 1,
        '0xc0ffe267a0d7E8e78Dfe441DFBaF3B873552563c': 1,
        '0xE0982E0d39eeE312017c58DBa76c99Ca59b8A958': 1,
        '0x10dec9f6B18754a0EFB694b93E12320Cb27F2C5b': 1,
        '0xd92b8841178d8A314C845da46276097C37C6c76B': 1,
        '0x18DAB61784283FB0E52c94da097E7d0BeF92a222': 1,
        '0xb90781Ceb500f80A9c101225eD5451449a3Aa5bc': 1,
        '0x857EebB5b2ea99aa86fEdf20E905d544a4B7E91d': 1,
        '0x95823011a97Ba73b4d34Fffa4560694B51a259eE': 1,
        '0x3622a7A9e8980036F04e823eF372E2f30C76F978': 1,
        '0xACAc397509cB506aFe8112F586Dcd5353BA7213A': 1,
        '0xf6CE5012CDA535fFFc151e6C4EE5a0Dfb851bbC8': 1,
        '0x2C8b2CAA1185ee7d170ac056B8648703801a38F5': 1,
        '0xBeB2E0f1E14d5c315797A1BbAA81EC39c4C9C729': 1,
        '0x02bC605108408AD9300dF1ebD216Fb8Ec9A3fB15': 1,
        '0xc90f4fB05116eF4325E992C83E96266Eb574edc2': 1,
        '0x8E33AF5104BE73BD501b64F38Dc3Dd8F7Ac49A70': 1,
        '0x5111babbDC79cc6FAd67CAc01581EfD1BCE92011': 1,
        '0x0BE0f09aDc19334286027Ed281B612A49893Cd9A': 1,
        '0x9ADeE2C84807088B922F89eCd49330F58405b47E': 1,
        '0x8358e0F54179eC00736411244489c60c0C14436b': 1,
        '0xE4D70Fc7af37db7c5144AB005056B8b493dFae24': 1,
        '0xE81e90222E0BD7D114cce6495B57C307Df342373': 1,
        '0x9Df1F7584Fa84CfDFCBf5081Ad511710b21C1742': 1,
        '0x02Af5E91525E8f0d47cd8C676209eC0033294a95': 1,
        '0xb57Faa15dBb087c7de5b7bd7C5B7049Ad76e7135': 1,
        '0x2b72C6B14de6C551d7fE16424b4e88b4a562D6B5': 1,
        '0xf8A9Ec4d9223b420AAb0B7de3f2dDeFF16fF9b6d': 1,
        '0x31622b790391137a1c43d217BB8b5E1BbeE56423': 1,
        '0x4EdE4498462462e303E3b4D22267e8eA04bed138': 1,
        '0xB78A290b75709AaF66EeA479263Eb7E9c238e536': 1,
        '0x5113dfb3606DF0FC221FC1742A1bbA4842393263': 1,
        '0x8bD225a9BB9bDe402fb308D9F5051978a5C103c0': 1,
        '0x2F23C81827fFdAe92B52e03233aD9Da9B1A55008': 1,
        '0x11111ECAB79526a489F5Dc7E71510237cCB02Ac8': 1,
        '0xD7F397Edc40588dD856d33D6A50017F3451E9353': 1,
        '0x5445c0719DC90F70B22EC8c2E225F9e6B4774940': 1,
        '0x3cEfb7C50fb12c4c4B42bAE9632Dc29B9Ea660dc': 1,
        '0xcaE70dBbbC938931C46DAe8C2D6A7eCeb52A22C5': 1,
        '0x19cb1866a1E0E07e69dDe53E4eE892bf8b554A33': 1,
        '0x0B2875E418eF072410f3bdB5f014cC9708F9A7D6': 1,
        '0xbceAa1b2E31e7f5307b2D1f546A51B3e84065584': 1,
        '0xD8de315eB7A00f4155d1Ea9eb4eb6888Ae715631': 1,
        '0x33976e703aDdEA9849a3446A5BF6F7dfC28f98dE': 1,
        '0x842702F9EdaeFAFBCF5C134F84492428d97D720B': 1,
        '0xB7DC1C26f1b893D4183d8014e341d1c6FeB0B257': 1,
        '0x962A82B1f6ce57C7ec62B0F17F7cAF3638406C40': 1,
        '0x34d46cBc2Cc4df873B9b11e20414e19d73Ce50fD': 1,
        '0xA3E8d8f8f078ebC630ecd117191f104A63Aa9E98': 1,
        '0xc8113770CFa584Cc7Ed838484681e9612F931347': 1,
        '0x9868DA98C80DaD1E040AbCeEB9A9EED5963264d2': 1,
        '0x9Fb0929Ec123c875680A725D557A48B4291da1c1': 1,
        '0x0Cdf2af757173DcCeBdd2583968A1143e4bDeB56': 1,
        '0xA78dbe53b71c2f213B12d52c7d55a5868fC709C5': 1,
        '0x494D035d1AD677b3FA5cC537a8cEbD0bf2480971': 1,
        '0xc9542dF458639735646125bEd236b7BaED3A9038': 1,
        '0xf6974c763613333B5fA31a98b396e935B239b72C': 1,
        '0x8f3d7C5Cf34d33dF17627091cA16F129e91395f5': 1,
        '0xF1f359CbAa4991AEE74c6c9A9b8C9188418382BA': 1,
        '0xe8300fBFE3F0E6182cb797A1f9B4e6BB65961aA8': 1,
        '0xA72F42c37E371dE1385ce8E32DE8D986c7073B41': 1,
        '0xd743d6bf977184ea4FC93cBb6203A98860B44b6E': 1,
        '0x41B1EEa20Ea156cA66B8A9F96B8Da48B91F21B1E': 1,
        '0x06Af80f72f22Ecd2B7F7b1A39280C2FDf85f8aEC': 1,
        '0xbcc061b11c975F2798Ac8327Ec590c51B9E06e78': 1,
        '0x432Ef0E8134538dacA14f758F07f29fb438d1a9E': 1,
        '0x9701927B7317b27D2420B1c8d8fe95ea26588121': 1,
        '0x6bB875c3E579806a0B3286F9BFc61e96DdB36242': 1,
        '0x3c54AB6741514c7b11D13c22555C7D7a5C94EC3c': 1,
        '0x38D3c2331b02aeF9D549DC45904Ec40E277E2A11': 1,
        '0x1d0f6A5F3C1D50Ef16D03aB1C00352274cba8481': 1,
        '0xAe14b8C49961130C8eD05D80C3d1DB407Afa40D4': 1,
        '0x200b6591326Cca7DAF74D4b6a5789824040d5660': 1,
        '0xfEaA2EB47d46d971D7C97d647377678EeA9D294a': 1,
        '0x2542501b6c17546183c7066C53fc7aB1E9aB6183': 1,
        '0x0d76C6577dFaF57AcA33848C40E646A7288cE183': 1,
        '0x3b03481B0dF665612256a82016ecc014a4d741CA': 1,
        '0xf062B3ab33A518Ef57e0039379A128CaF2e01AD8': 1,
        '0x6013460C79748c14A60a4aC82E950B7512531693': 1,
        '0x765dc1c6F388D20FA880FEcFCbe6aaBe1485f8ba': 1,
        '0x3dA9D70305B83Db1f545A5d50B19208b93cD0C21': 1,
        '0xAa4B6B4c7417248dF49dc484d5Eb9a4377A4C7e1': 1,
        '0xD5A4c5A3aB15f6edF8B27Fcc2DC10C8Ac085fc62': 1,
        '0xaeC6400601fc71A05808330f4818e5453B90f81c': 1,
        '0xd6CEe4F5F5EE3C3d81d629D5bd6d525883114A31': 1,
        '0x1436DbFfBDde71d16A2c4d23f9116c3158c4d984': 1,
        '0x6033F3eCA41a97C2BA8aEaca36ED9dAdf1ef3a80': 1,
        '0x6d45c334B90569577269Be9f1BE3eeDEFA1c037C': 1,
        '0x7F00196624db1E24C747D37CbcC0cE7eA4dEA64f': 1,
        '0xca8B1B7d35F5859EcE9138b753b801996A75Fa48': 1,
        '0x764172F0823089Aa35739d7C837b6EFb7EFfbc44': 1,
        '0x87d7F82B73DF9A2115B1fE8d6b966E4912375af7': 1,
        '0xDcbE18CB497D00B9341ac806Ac4F5A1290066D45': 1,
        '0xa5389ABC8c937C875304497573cB75576B8fC5F6': 1,
        '0x908cA7c002a9A0E86AA501bfD65344D083a7BD39': 1,
        '0x77171b9a373C417c1843BF9f6577E9A42E473C85': 1,
        '0xE635F8A0B167c6d9CB2Ef057fa7b42c63de5Fa1c': 1,
        '0x45AEe0c2D6cF993D532c55a60a5cF2833E7Cd97A': 1,
        '0x29b9D8b112F97b637C134579b9D10a4F4fCac7ec': 1,
        '0x364A9Ec91951995d6E54e7351121BD4D4CdACc7A': 1,
        '0xdD27eF02C889230Ee98465e570fd4a3a2724abd5': 1,
        '0xa71Bb5E1A9621f4278BF2bE0796C9E9C4F6594E1': 1,
        '0xcA8A8247102785Eb6d6a59bdc790a1fFDDBD16c5': 1,
        '0x1DC6e179B0aEc8a3Eb50027B871eF3473702bc2c': 1,
        '0x04b6eA5a19b8945eDdC4A141408ec34C2A55a34e': 1,
        '0xd5B7c328Eeb244bFfA6FB194F6CC760bDf534501': 1,
        '0x00c62fb0Ed991C19EdFFeDF58136F42D188c3cF2': 1,
        '0x7e3321cD5754Bf4bee08cEA50caEE75FA2bEeA62': 1,
        '0xC55d35AF6A5ff6299EF3fb8632BBaC6cce17DC8b': 1,
        '0x8E6804337f8d774cE3eB4D4c12bAd9DfAB2f56AD': 1,
        '0x980a8252da5614B3e03176C2Fb169c76511DDDd4': 1,
        '0x9A7ae0a4d2058e68E0b3Fade61F4cBc702369687': 1,
        '0xbe3E65a15C50cE5C24C206173EE6Afb0C37237A3': 1,
        '0x40eB1A4d5ABDd052CFAFFA648356D55E002F57d4': 1,
        '0xBd446A8aD16Ee2B19fe15aceb424277653C8f6e6': 1,
        '0x4D3E2C6d502bde0446d7F851f5a9a984A691Ec9D': 1,
        '0x6d650fdE8173EefB8006964E8c1D81043Ad2f088': 1,
        '0xefD0883A05dfF6E106d84cB1baEB68E3365695e1': 1,
        '0x369378f65BEa146234Fd290fC1ac59d0ecF921Ed': 1,
        '0x26B5D634b6dbaac62Fffb7170Ef284d28Af6C291': 1,
        '0xfF1bEC79C1C897cFaEb01F0037bd88E7EAC79AeC': 1,
        '0xbEEc68687f36adaA945b1E52e54acc2220A5204E': 1,
        '0xe379A76e8D1c8F4741bd9F8B4C50D192aDF8a027': 1,
        '0xe7b426fC3b36CD138bf6434329105d09dFa186D2': 1,
        '0xD79d3B70FC762CE97FcC874cd0d93FaBE3377Fcd': 1,
        '0x2759321Df4C0f0475c41BBf9d17891bd42E32C3c': 1,
        '0x86f6941748BeD21a8449C05a6c62208dC4C363b4': 1,
        '0xdBE3cd66A47B0E4390c387890Dc6De4f0B4E6001': 1,
        '0xEFa33B23A1310370ceBD1269489F6D7ac856FB7a': 1,
        '0xb4CaA764e2bf087f1a7a0ceC43250892022787d9': 1,
        '0x89ddad6277Deff03F2666B66cFe66abD48197867': 1,
        '0xb75C0D2E012C2B0D0533958A5f24Ffc6b653cef2': 1,
        '0x5a6639b0401efd880dB0862bcBCfA964B39141A1': 1,
        '0x86D43A2698BF69f39f5921e54C4052A2Da86d879': 1,
        '0xc76F211DA977B4eC540C121A74EB811822FcB473': 1,
        '0x345E30ED279Cd1Bccb7103273c0Ead8EDBCf8619': 1,
        '0x750e0CBae6e9E06Dd7f4592DB49bA4cdb462f7f0': 1,
        '0xD8aE1493597CEcB7700c24FBd728CE86160E425c': 1,
        '0x7928218f0FB4b127ea7c2f9AF4191b02e5a6e935': 1,
        '0x4DA53983a7606AcB5F436BcEA50Ae650EDbD88A1': 1,
        '0xFfFdF4127eF6F86d18283e9917d726B30d8c7935': 1,
        '0xa2F1356191cA07DCc50C03465bcEc0ec25089501': 1,
        '0x7749Dd53928b2ec1ad7550A9De8df0Aba9838E24': 1,
        '0x9fd75fD0baB769c5c01559fb19ddaee30b1581aF': 1,
        '0x1e1E412ccF77Ce9f736Dde3194629FFfd649e8a2': 1,
        '0x57b07f71766233Ff17dBb0283eC873660cDBaf81': 1,
        '0x86ce032489383Ec0564BAD2Ed868048f0b1030f2': 1,
        '0xae9a30FdC0caA2eb8624756f1725f75283Aaa343': 1,
        '0x3dAd5288D0F9Ca63acB48940f349e0cF3832D311': 1,
        '0xF99Dc961499811B2d830edCfD9C9CD98ebD04A29': 1,
        '0x82D9AAdda882A89FA15A6B0966a668bC054Ac28d': 1,
        '0xbE75F08b0ee73623E0Aef60d56d2917607505285': 1,
        '0xbFdBb8cB22Cd856f07cf4D2ae043bF8934762ddB': 1,
        '0xC02cAe8F6217648Fa2bFBd08C2be94028969A65D': 1,
        '0x8d8890235639AA0715aFb141fd2943f19E101e78': 1,
        '0x163eE09DeEEA9DAB68df0Ae49F48c8E07AD54aa2': 1,
        '0xc65Aaec5cAf4aeB0aFdbc2ec95A38f1E1CdeEd13': 1,
        '0xa9c5DB8ED51Fb19d1bf790a1E2Af6f077d85AA53': 1,
        '0x405512912c51c81CC663921a5733e6D19d0e5cC5': 1,
        '0x9b045b6589FF0044f97901B742609eB34eE96949': 1,
        '0x4271dbe0e17685dD6f20B4bE6DfF432f2F45fFa4': 1,
        '0x5FaA627d123d2990c605f0934E008f53CE193534': 1,
        '0x268297741FD37B581917B16BD1107230E5563342': 1,
        '0x4d0b5e5b2c78a8B348454E9851FdD0C692c1a37F': 1,
        '0x47A5e0070Eba6eD3140FC54ec79D9Bb9c8C430C0': 1,
        '0xE89eeb80C94479a04F5A86c113E987b90d5B22C8': 1,
        '0xE180d3C447e5ff7c9a349e4aCb6a979526631aEE': 1,
        '0x62FA31f385F3210e0177935e04BF866e6C948791': 1,
        '0xCfefC55b9eE82af2deB7d79c44ae5151013Ea254': 1,
        '0xa670f0C4F1bdbc1089Cb75774ac7230037b6DBB9': 1,
        '0x4607714A5bF825BAecae374892715B6f8a7B04c2': 1,
        '0x17df29082891Ead3B60507e8fA30491c44452F12': 1,
        '0x67ABC54bbAfE4791B5C6f6c2886e9d76f6E9e05B': 1,
        '0x5F8e696889c74bC6342ebd529e8b3bB9A6B98888': 1,
        '0x00dF99E12315Cac90f49527b07D753b7FE9fAcCd': 1,
        '0x640f34a6300C52e0dCAE21821e8c73fa9a4a3D91': 1,
        '0xBf2aD8A41e083d7fA7894d199C93734b5C55790F': 1,
        '0x031947c116Eb2B954742A5a9E03667B97A2977D0': 1,
        '0xF81988e89CCEea221A1D3943A8fDed647dD72599': 1,
        '0x032A62B2FcccC90795c0920C56d92606C7a6a808': 1,
        '0xd48C3bC569358672B2319A5b3FEaB5343c1e9868': 1,
        '0x67E97eAf29eFff2f3e96f8Dad36C05BC741cd412': 1,
        '0x8c18C81a3f57a69039598fe2D134B47BD4f10E77': 1,
        '0x9657B94D5d0a7C58CD2c59Ac17969e754C29eC29': 1,
        '0xe19e26beCff917f057Ebb35217fdF4ab3252DFFe': 1,
        '0x4DE67D3e4dbE226F216022C2F1C2ff80311a1D96': 1,
        '0x86E4dea1b51f72E36429dD0eAED7533d2618de2f': 1,
        '0x0952ecc0080Ed9A0cBD5839a3CC6758b85C3a835': 1,
        '0x14a3046b333Eadc66226ff8720F98c1C20f6b431': 1,
        '0x2C17c733CeFC0e618850B546d9df53cdbFa29725': 1,
        '0x5241aa99a776866296D1d695C02bB2E31B3Ff998': 1,
        '0xB7CA8dB84717c98dcF59Be2B3a612e75EF5D54b0': 1,
        '0xA2EaE2a749103C5631D5525D136EC7B956Dd7c85': 1,
        '0x1E7B7A42E22cA86f4314538d513a44407Ca5a57B': 1,
        '0x6ea24f3cDDDF5B88F90B73A2d7df7ad9C0f9BEC4': 1,
        '0xBd01eEF9219caf67c9a0F661daa8C9d7E2f31Cb9': 1,
        '0xf6a6A404FBF3EB7D21E4A78651A5C373F10097a6': 1,
        '0x8a17ee3FA5107df11Bc569482f112B8461C5fEF6': 1,
        '0x6B3A61F38FBdcb9daBA9b24c634793d7B5c218cc': 1,
        '0xf5Fe364D18F4a5A53BADCe9a046ba74cfC97f6Fb': 1,
        '0x0631581C7824DdEeBC8D288E38eBDEd3c0aC1226': 1,
        '0x2B2E1fe06d4c23CdF5EE381e59399ca6E6Ce156B': 1,
        '0xB9cD2DAaC4E0Ebcf2Da51705a0f02EEe13072C3c': 1,
        '0xE04903eA0dA52680520903DAdC84f5adbef35E9f': 1,
        '0x430Ad7e178D3e00145F35c041c7F486D7E8a4C7e': 1,
        '0xa6d95462d4b872D5141e701f3Ea9Ba67d268A357': 1,
        '0x4fc5b6B2FaC072CD52fC8ffcfA7184dcdD5A5BEC': 1,
        '0x88040444bc5F834Fcc209CF7C17E8B67E3F1C3f3': 1,
        '0xBB3020aEf6AB758B9049ea649DF62fD9037ECc6c': 1,
        '0x6CDB0A4902C81E9C63De8c486F31e8d5DDc0A9f7': 1,
        '0x74ACF5190e62E702Ab1beaC99A30ca95AFCA461E': 1,
        '0x53D8adae895d92c4e5a190356A2eae74A75ef774': 1,
        '0xbBE56B2979a08ff1aA4C2EfD12412ECdb57A12ea': 1,
        '0x4D9354558Cb3c72e1BE4e8Ff68573660c85495ff': 1,
        '0xdc6F534c766D1643377498dC3939874Ea8169163': 1,
        '0x3FBe2fd902D278e3f05575149505F998445Ea4b0': 1,
        '0x6779508Dc68163AC610C40bA5adaDeD498cc5209': 1,
        '0xAf08b6aA48C6057979a30C53aD83409B77d95572': 1,
        '0xa387b58c270B4920522fFBf74fbFF32dF7cbe736': 1,
        '0x4DD3F821db780d5F48f76569A686CB19b18e180B': 1,
        '0x631ab8EB40588543dF900263F864b6376d56A587': 1,
        '0x2f5EAcC0855B4970e4C57bD04a8Bb8d985a5213f': 1,
        '0xF734289E19e17d208865D25407fB9C8bF87CB72E': 1,
        '0xC6eA338E1aC13FD159662A977d85ca64d861aFa4': 1,
        '0xC8b27b0e1c4d7ECd61B6C98C30a0f29E6807f650': 1,
        '0x440DE612484a70b07Fa68F56a992D00305E08960': 1,
        '0x63a41C843E663FA949E0b722627dEa2ed2C36F63': 1,
        '0xFf8D58f85a4f7199c4b9461F787cD456Ad30e594': 1,
        '0xf14C5c02758dC98ac86b36060F2124F3BeB72ad3': 1,
        '0x81d3eBF5c2EC0F69AeD1Cf72a6B2C92BAa788423': 1,
        '0xAE763cBa0CB8A233b40659D75b192Ff7aD828efE': 1,
        '0x44BaF602a19CFa446C209146dAa290346D970937': 1,
        '0xC065F5D649cdbe291f67d282B31e49eEfA17EF11': 1,
        '0x2Ae75dE89703B7FF2Ef45f8E298d59b2f33EFca3': 1,
      };

      const creditScores = Object.keys(currentTree).map<CreditScore>(
        (addy) => ({
          account: addy,
          amount: BigNumber.from(currentTree[addy]),
        }),
      );
      const tree = new CreditScoreTree(creditScores);

      expect(tree.getHexRoot()).to.eq(
        '0xcd8cb98e3d1fa7e7781dd794c95cbf41af289bc216cc5d5f640b4ffc66a9b42f',
      );
    });
  });
});

function getVerifyRequest(
  account: string,
  amount: BigNumber,
  tree: CreditScoreTree,
) {
  return {
    account: account,
    score: amount,
    merkleProof: tree.getProof(account, amount),
  };
}
