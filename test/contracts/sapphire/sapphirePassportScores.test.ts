import { PassportScore } from '@arc-types/sapphireCore';
import { utils } from '@ethereum-waffle/provider/node_modules/ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { PassportScoreTree } from '@src/MerkleTree';
import {
  ArcProxyFactory,
  MockSapphirePassportScores,
  MockSapphirePassportScoresFactory,
  SapphirePassportScoresFactory,
} from '@src/typings';
import { getScoreProof } from '@src/utils';
import { DEFAULT_PROOF_PROTOCOL } from '@test/helpers/sapphireDefaults';
import {
  addSnapshotBeforeRestoreAfterEach,
  advanceEpoch,
} from '@test/helpers/testingUtils';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber } from 'ethers';
import 'module-alias/register';
import { generateContext, ITestContext } from '../context';
import { deployMockSapphirePassportScores } from '../deployers';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

chai.use(solidity);

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
  let passportScores: MockSapphirePassportScores;
  let merkleRootUpdater: SignerWithAddress;
  let unauthorized: SignerWithAddress;
  let admin: SignerWithAddress;
  let pauseOperator: SignerWithAddress;
  let tree: PassportScoreTree;
  let passportScore1: PassportScore;
  let passportScore2: PassportScore;
  let ctx: ITestContext;

  async function createNewCreditScoreInstance(
    merkleRoot: string,
    merkleRootUpdater: string,
    pauseOperator: string,
  ) {
    const creditScoreInstance = await deployMockSapphirePassportScores(admin);

    await creditScoreInstance.init(
      merkleRoot,
      merkleRootUpdater,
      pauseOperator,
    );

    return creditScoreInstance;
  }

  before(async () => {
    ctx = await generateContext(sapphireFixture, async (ctx) => {
      passportScore1 = {
        account: ctx.signers.admin.address,
        protocol: utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
        score: BigNumber.from(12),
      };
      passportScore2 = {
        account: ctx.signers.unauthorized.address,
        protocol: utils.formatBytes32String('defi.other'),
        score: BigNumber.from(20),
      };
      tree = new PassportScoreTree([passportScore1, passportScore2]);
      return setupSapphire(ctx, {
        merkleRoot: tree.getHexRoot(),
      });
    });
    unauthorized = ctx.signers.unauthorized;
    admin = ctx.signers.admin;
    merkleRootUpdater = ctx.signers.merkleRootUpdater;
    passportScores = ctx.contracts.sapphire.passportScores;
    pauseOperator = ctx.signers.pauseOperator;
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#init', () => {
    it('sets the initial values', async () => {
      const impl = await new MockSapphirePassportScoresFactory(admin).deploy();
      const proxy = await new ArcProxyFactory(admin).deploy(
        impl.address,
        admin.address,
        [],
      );
      const contract = SapphirePassportScoresFactory.connect(
        proxy.address,
        admin,
      );

      await contract.init(
        tree.getHexRoot(),
        merkleRootUpdater.address,
        pauseOperator.address,
      );

      // sets the merkle root
      expect(await contract.currentMerkleRoot()).to.eq(tree.getHexRoot());
      // root updater
      expect(await contract.merkleRootUpdater()).to.eq(
        merkleRootUpdater.address,
      );
      // pause operator
      expect(await contract.pauseOperator()).to.eq(pauseOperator.address);
      // max score
    });
  });

  describe('#setPause', () => {
    it('initially not active', async () => {
      const contract = await createNewCreditScoreInstance(
        ONE_BYTES32,
        merkleRootUpdater.address,
        pauseOperator.address,
      );
      expect(await contract.isPaused()).to.be.true;
    });

    it('revert if trying to pause as an unauthorised user', async () => {
      expect(await passportScores.merkleRootUpdater()).not.eq(
        unauthorized.address,
      );
      expect(await passportScores.pauseOperator()).not.eq(unauthorized.address);
      await expect(
        passportScores.connect(unauthorized).setPause(false),
      ).to.be.revertedWith(
        'SapphirePassportScores: caller is not the pause operator',
      );
    });

    it('revert if set pause as merkle root updater', async () => {
      expect(await passportScores.merkleRootUpdater()).eq(
        merkleRootUpdater.address,
      );
      await expect(
        passportScores.connect(merkleRootUpdater).setPause(false),
      ).to.be.revertedWith(
        'SapphirePassportScores: caller is not the pause operator',
      );
    });

    it('set pause as pause operator', async () => {
      const initialIsPaused = await passportScores.isPaused();
      const expectedIsPaused = !initialIsPaused;
      await expect(
        passportScores.connect(pauseOperator).setPause(expectedIsPaused),
      )
        .emit(passportScores, 'PauseStatusUpdated')
        .withArgs(expectedIsPaused);
      expect(await passportScores.isPaused()).eq(expectedIsPaused);
    });
  });

  describe('#updateMerkleRoot', () => {
    it('should have merkle root updater not equal admin', async () => {
      const merkleRootUpdaterAddress = await passportScores.merkleRootUpdater();
      expect(merkleRootUpdaterAddress).not.eq(admin.address);
      expect(merkleRootUpdaterAddress).eq(merkleRootUpdater.address);
    });

    it('should not be able to update the merkle root as an unauthorised user', async () => {
      await expect(
        passportScores.connect(unauthorized).updateMerkleRoot(ONE_BYTES32),
      ).to.be.revertedWith(
        'SapphirePassportScores: caller is not authorized to update merkle root',
      );
    });

    it('should not be able to be called by the root updater before the delay duration', async () => {
      await advanceEpoch(passportScores);
      await passportScores
        .connect(merkleRootUpdater)
        .updateMerkleRoot(ONE_BYTES32);
      await expect(
        passportScores.connect(merkleRootUpdater).updateMerkleRoot(ONE_BYTES32),
      ).to.be.revertedWith(
        'SapphirePassportScores: cannot update merkle root before delay period',
      );
    });

    it('should not be able to post an empty root', async () => {
      await expect(
        passportScores
          .connect(merkleRootUpdater)
          .updateMerkleRoot(
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ),
      ).to.be.revertedWith('SapphirePassportScores: root is empty');
    });

    it('should not be able to update as admin if the contract is not paused', async () => {
      await expect(
        passportScores.updateMerkleRoot(ONE_BYTES32),
      ).to.be.revertedWith(
        'SapphirePassportScores: only admin can update merkle root if paused',
      );
    });

    it('instantly update merkle root as the admin', async () => {
      await passportScores.connect(pauseOperator).setPause(true);
      const currentMerkleRoot = await passportScores.currentMerkleRoot();
      const initialLastMerkleRootUpdate = await passportScores.lastMerkleRootUpdate();

      const txn = passportScores.connect(admin).updateMerkleRoot(TWO_BYTES32);
      const txnBlockTimestamp = await passportScores.currentTimestamp();

      await expect(txn)
        .to.emit(passportScores, 'MerkleRootUpdated')
        .withArgs(admin.address, TWO_BYTES32, txnBlockTimestamp);
      expect(await passportScores.upcomingMerkleRoot()).eq(TWO_BYTES32);
      expect(await passportScores.currentMerkleRoot()).eq(currentMerkleRoot);
      expect(await passportScores.lastMerkleRootUpdate()).eq(
        initialLastMerkleRootUpdate,
      );
    });

    it('instantly update merkle root avoiding time delay as the admin', async () => {
      const initialLastMerkleRootUpdate = await passportScores.lastMerkleRootUpdate();
      const initialCurrentMerkleRoot = await passportScores.currentMerkleRoot();

      await passportScores.setCurrentTimestamp(
        initialLastMerkleRootUpdate.add(1),
      );
      await passportScores.connect(pauseOperator).setPause(true);
      await passportScores.connect(admin).updateMerkleRoot(THREE_BYTES32);

      expect(await passportScores.lastMerkleRootUpdate()).eq(
        initialLastMerkleRootUpdate,
      );
      expect(await passportScores.currentMerkleRoot()).eq(
        initialCurrentMerkleRoot,
      );
      expect(await passportScores.upcomingMerkleRoot()).eq(THREE_BYTES32);
    });

    it('should be able to update the merkle root as the root updater', async () => {
      const initialUpcomingMerkleRoot = await passportScores.upcomingMerkleRoot();
      const timestamp = await advanceEpoch(passportScores);
      const updateMerkleRootTxn = passportScores
        .connect(merkleRootUpdater)
        .updateMerkleRoot(TWO_BYTES32);

      await expect(updateMerkleRootTxn)
        .to.emit(passportScores, 'MerkleRootUpdated')
        .withArgs(merkleRootUpdater.address, TWO_BYTES32, timestamp);
      expect(await passportScores.lastMerkleRootUpdate()).eq(timestamp);
      expect(await passportScores.currentMerkleRoot()).eq(
        initialUpcomingMerkleRoot,
      );
      expect(await passportScores.upcomingMerkleRoot()).eq(TWO_BYTES32);
    });

    it('should increment the current epoch when updating as the root updater', async () => {
      const initialEpoch = await passportScores.currentEpoch();

      await advanceEpoch(passportScores);

      await passportScores
        .connect(merkleRootUpdater)
        .updateMerkleRoot(TWO_BYTES32);

      expect(await passportScores.currentEpoch()).to.eq(initialEpoch.add(1));
    });

    it('should ensure that malicious merkle root does not became a current one', async () => {
      // malicious update merkle root
      const maliciousRoot = TWO_BYTES32;
      const maliciousTxnTimestamp = await advanceEpoch(passportScores);
      const maliciousUpdateTxn = passportScores
        .connect(merkleRootUpdater)
        .updateMerkleRoot(maliciousRoot);

      await expect(maliciousUpdateTxn)
        .to.emit(passportScores, 'MerkleRootUpdated')
        .withArgs(
          merkleRootUpdater.address,
          maliciousRoot,
          maliciousTxnTimestamp,
        );
      expect(await passportScores.upcomingMerkleRoot()).eq(maliciousRoot);

      // admin prevent attack to not allow set malicious root as current one
      await passportScores.connect(pauseOperator).setPause(true);
      const timestamp = await advanceEpoch(passportScores);
      const updateMerkleRootTxn = passportScores
        .connect(admin)
        .updateMerkleRoot(THREE_BYTES32);

      await expect(updateMerkleRootTxn)
        .to.emit(passportScores, 'MerkleRootUpdated')
        .withArgs(admin.address, THREE_BYTES32, timestamp);
      expect(await passportScores.upcomingMerkleRoot()).eq(THREE_BYTES32);
      expect(await passportScores.currentMerkleRoot()).not.eq(maliciousRoot);
    });

    it('should check if updater cannot update merklee root before thee delay duration passes', async () => {
      const mockpassportScores = await createNewCreditScoreInstance(
        ONE_BYTES32,
        merkleRootUpdater.address,
        pauseOperator.address,
      );

      await mockpassportScores.connect(pauseOperator).setPause(false);
      await advanceEpoch(mockpassportScores);
      await mockpassportScores
        .connect(merkleRootUpdater)
        .updateMerkleRoot(TWO_BYTES32);
      const lastMerkleRootUpdate = await mockpassportScores.lastMerkleRootUpdate();
      const delay = await mockpassportScores.merkleRootDelayDuration();

      // update merkle root right after root was updated
      await expect(
        mockpassportScores
          .connect(merkleRootUpdater)
          .updateMerkleRoot(THREE_BYTES32),
      ).to.be.revertedWith(
        'SapphirePassportScores: cannot update merkle root before delay period',
      );

      await mockpassportScores.setCurrentTimestamp(
        lastMerkleRootUpdate.add(delay).sub(1),
      );

      // update merkle root 1 sec before delay passes
      await expect(
        mockpassportScores
          .connect(merkleRootUpdater)
          .updateMerkleRoot(THREE_BYTES32),
      ).to.be.revertedWith(
        'SapphirePassportScores: cannot update merkle root before delay period',
      );
      await mockpassportScores.setCurrentTimestamp(
        lastMerkleRootUpdate.add(delay),
      );

      // update merkle root right after delay has passed
      await mockpassportScores
        .connect(merkleRootUpdater)
        .updateMerkleRoot(THREE_BYTES32);

      expect(await mockpassportScores.currentMerkleRoot()).eq(TWO_BYTES32);
      expect(await mockpassportScores.upcomingMerkleRoot()).eq(THREE_BYTES32);
    });
  });

  describe('#verify', async () => {
    it(`should be able to verify a user's score for the specified protocol`, async () => {
      expect(await passportScores.currentMerkleRoot()).eq(tree.getHexRoot());

      expect(
        await passportScores
          .connect(unauthorized)
          .verify(getScoreProof(passportScore1, tree)),
      ).to.be.true;
    });

    it('reverts if proof is invalid', async () => {
      const user2Proof = getScoreProof(passportScore2, tree);

      await expect(
        passportScores.verify({
          ...getScoreProof(passportScore1, tree),
          merkleProof: user2Proof.merkleProof,
        }),
      ).to.be.revertedWith('SapphirePassportScores: invalid proof');
    });

    it('reverts if protocol does not exist', async () => {
      await expect(
        passportScores.verify({
          ...getScoreProof(passportScore1, tree),
          protocol: utils.formatBytes32String('this.does.not.exist'),
        }),
      ).to.be.revertedWith('SapphirePassportScores: invalid proof');
    });
  });

  describe('#setMerkleRootUpdater', () => {
    it('should be able to update as the admin', async () => {
      await expect(passportScores.setMerkleRootUpdater(unauthorized.address))
        .to.emit(passportScores, 'MerkleRootUpdaterUpdated')
        .withArgs(unauthorized.address);
      expect(await passportScores.merkleRootUpdater()).eq(unauthorized.address);
    });

    it('should not be able to update as non-admin', async () => {
      await expect(
        passportScores
          .connect(merkleRootUpdater)
          .setMerkleRootUpdater(merkleRootUpdater.address),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });
  });

  describe('#setPauseOperator', () => {
    it('should be able to update as the admin', async () => {
      await expect(
        passportScores.connect(admin).setPauseOperator(unauthorized.address),
      )
        .to.emit(passportScores, 'PauseOperatorUpdated')
        .withArgs(unauthorized.address);
      expect(await passportScores.pauseOperator()).eq(unauthorized.address);
    });

    it('should not be able to update as non-admin', async () => {
      await expect(
        passportScores
          .connect(merkleRootUpdater)
          .setPauseOperator(merkleRootUpdater.address),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });
  });

  describe('#setMerkleRootDelay', () => {
    it('should be able to update as the admin', async () => {
      await expect(passportScores.setMerkleRootDelay(5))
        .to.emit(passportScores, 'DelayDurationUpdated')
        .withArgs(admin.address, 5);
      expect(await passportScores.merkleRootDelayDuration()).eq(5);
    });

    it('should not be able to update as non-admin', async () => {
      await expect(
        passportScores.connect(merkleRootUpdater).setMerkleRootDelay(5),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });
  });

  describe('#setDocumentId', () => {
    it('should be able to update as the admin', async () => {
      const documentId = 'test123';

      await expect(passportScores.setDocumentId(documentId))
        .to.emit(passportScores, 'DocumentIdUpdated')
        .withArgs(documentId);
    });

    it('should not be able to update as non-admin', async () => {
      await expect(
        passportScores.connect(merkleRootUpdater).setDocumentId('test123'),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });
  });
});
