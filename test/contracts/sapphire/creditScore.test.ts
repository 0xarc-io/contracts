import { CreditScore } from '@arc-types/sapphireCore';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import CreditScoreTree from '@src/MerkleTree/PassportScoreTree';
import { MockSapphireCreditScore } from '@src/typings';
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
    merkleRootUpdater = ctx.signers.merkleRootUpdater;
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
