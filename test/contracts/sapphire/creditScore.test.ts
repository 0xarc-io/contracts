import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import { SapphireCreditScore } from '@src/typings/SapphireCreditScore';
import { getTxnTimestamp } from '@test/helpers/getTxnTimestamp';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber } from 'ethers';
import 'module-alias/register';
import { generateContext, ITestContext } from '../context';
import { deployMockSapphireCreditScore } from '../deployers';
import { createSapphireFixture } from '../fixtures';

chai.use(solidity);

const ONE_BYTES32 = '0x1111111111111111111111111111111111111111111111111111111111111111';
const TWO_BYTES32 = '0x2222222222222222222222222222222222222222222222222222222222222222';
const THREE_BYTES32 = '0x3333333333333333333333333333333333333333333333333333333333333333';

/**
 * This is the core credit score contract and is where a user's credit score will
 * be posted. The logic around this contract needs to be very sound since we anticipate
 * it to be a core DeFi primitive for other applications to build on.
 */
describe('SapphireCreditScore', () => {
  let ctx: ITestContext;
  let creditScoreContract: SapphireCreditScore;
  let merkleRootUpdater: SignerWithAddress;
  let unauthorised: SignerWithAddress;
  let owner: SignerWithAddress;

  beforeEach(async () => {
    ctx = await generateContext(createSapphireFixture(), async () => {});
    creditScoreContract = ctx.contracts.sapphire.creditScore;
    merkleRootUpdater = ctx.signers.interestSetter;
    unauthorised = ctx.signers.unauthorised;
    owner = ctx.signers.admin;
  });

  it('should have merkle root updater not equal owner', async () => {
    const merkleRootUpdaterAddress = await creditScoreContract.merkleRootUpdater();
    expect(merkleRootUpdaterAddress).not.eq(owner.address);
    expect(merkleRootUpdaterAddress).eq(merkleRootUpdater.address);
  });

  describe('#setPause', () => {
    it('initially not active', async () => {
      expect(await creditScoreContract.isPaused()).to.be.true;
    });

    it('revert if trying to pause as an unauthorised user', async () => {
      expect(await creditScoreContract.merkleRootUpdater()).not.eq(
        unauthorised.address,
      );
      expect(await creditScoreContract.owner()).not.eq(unauthorised.address);
      await expect(
        creditScoreContract.connect(unauthorised).setPause(false),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('revert if set pause as merkle root updater', async () => {
      expect(await creditScoreContract.merkleRootUpdater()).eq(merkleRootUpdater.address);
      await expect(
        creditScoreContract.connect(merkleRootUpdater).setPause(false),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('set pause as owner', async () => {
      expect(await creditScoreContract.isPaused()).to.be.true;
      await expect(creditScoreContract.setPause(false))
        .emit(creditScoreContract, 'PauseStatusUpdated')
        .withArgs(false);
      expect(await creditScoreContract.isPaused()).to.be.false;
    });
  });

  describe('#updateMerkleRoot', () => {
    beforeEach(async () => {
      await creditScoreContract.setPause(false);
    });

    it('should not be able to update the merkle root as an unauthorised user', async () => {
      await expect(
        creditScoreContract.connect(unauthorised).updateMerkleRoot(ONE_BYTES32),
      ).to.be.revertedWith('SapphireCreditScore: caller is not authorized to update merkle root');
    });

    it('should not be able to be called by the root updater before the delay duration', async () => {
      await creditScoreContract.connect(merkleRootUpdater).updateMerkleRoot(ONE_BYTES32);
      await expect(
        creditScoreContract.connect(merkleRootUpdater).updateMerkleRoot(ONE_BYTES32),
      ).to.be.revertedWith('SapphireCreditScore: too frequent root update');
    });

    it('should not be able to post an empty root', async () => {
      await expect(
        creditScoreContract
          .connect(merkleRootUpdater)
          .updateMerkleRoot('0x0000000000000000000000000000000000000000000000000000000000000000'),
      ).to.be.revertedWith('SapphireCreditScore: root is empty');
    });

    it('should not be able to update as owner if the contract is not paused', async () => {
      await expect(creditScoreContract.updateMerkleRoot(ONE_BYTES32)).to.be.revertedWith(
        'SapphireCreditScore: pause contract to update merkle root as owner',
      );
    });

    it('instantly update merkle root as the owner', async () => {
      await creditScoreContract.setPause(true);
      const currentMerkleRoot = await creditScoreContract.currentMerkleRoot();
      const initialLastMerkleRootUpdate = await creditScoreContract.lastMerkleRootUpdate();
      const updateMerkleRootTxn = creditScoreContract
        .connect(owner)
        .updateMerkleRoot(TWO_BYTES32);
      const txnBlockTimestamp = await getTxnTimestamp(ctx, updateMerkleRootTxn);
      await expect(updateMerkleRootTxn)
        .to.emit(creditScoreContract, 'MerkleRootUpdated')
        .withArgs(owner.address, TWO_BYTES32, txnBlockTimestamp);
      expect(await creditScoreContract.upcomingMerkleRoot()).eq(TWO_BYTES32);
      expect(await creditScoreContract.currentMerkleRoot()).eq(currentMerkleRoot);
      expect(await creditScoreContract.lastMerkleRootUpdate()).eq(initialLastMerkleRootUpdate);
    });

    it('instantly update merkle root avoiding time delay as the owner', async () => {
      await creditScoreContract.connect(merkleRootUpdater).updateMerkleRoot(TWO_BYTES32);

      const initialLastMerkleRootUpdate = await creditScoreContract.lastMerkleRootUpdate();
      const initialCurrentMerkleRoot = await creditScoreContract.currentMerkleRoot();

      await creditScoreContract.connect(owner).setPause(true);
      await creditScoreContract.connect(owner).updateMerkleRoot(THREE_BYTES32);

      expect(await creditScoreContract.lastMerkleRootUpdate()).eq(initialLastMerkleRootUpdate);
      expect(await creditScoreContract.currentMerkleRoot()).eq(initialCurrentMerkleRoot);
      expect(await creditScoreContract.upcomingMerkleRoot()).eq(THREE_BYTES32);
    });

    it('should be able to update the merkle root as the root updater', async () => {
      const initialUpcomingMerkleRoot = await creditScoreContract.upcomingMerkleRoot();
      const updateMerkleRootTxn = creditScoreContract
        .connect(merkleRootUpdater)
        .updateMerkleRoot(TWO_BYTES32);
      const timestamp = await getTxnTimestamp(ctx, updateMerkleRootTxn);

      await expect(updateMerkleRootTxn)
        .to.emit(creditScoreContract, 'MerkleRootUpdated')
        .withArgs(merkleRootUpdater.address, TWO_BYTES32, timestamp);
      expect(await creditScoreContract.lastMerkleRootUpdate()).eq(timestamp);
      expect(await creditScoreContract.currentMerkleRoot()).eq(initialUpcomingMerkleRoot);
      expect(await creditScoreContract.upcomingMerkleRoot()).eq(TWO_BYTES32);
    });

    it('should ensure that malicious merkle root does not became a current one', async () => {
      const maliciousRoot = TWO_BYTES32;
      const maliciousUpdateTxn = creditScoreContract
        .connect(merkleRootUpdater)
        .updateMerkleRoot(maliciousRoot);
      const maliciousTxnTimestamp = await getTxnTimestamp(ctx, maliciousUpdateTxn);
      await expect(maliciousUpdateTxn)
        .to.emit(creditScoreContract, 'MerkleRootUpdated')
        .withArgs(merkleRootUpdater.address, maliciousRoot, maliciousTxnTimestamp);
      expect(await creditScoreContract.upcomingMerkleRoot()).eq(maliciousRoot);
      await creditScoreContract.setPause(true);
      const updateMerkleRootTxn = creditScoreContract
        .connect(owner)
        .updateMerkleRoot(THREE_BYTES32);
      const timestamp = await getTxnTimestamp(ctx, updateMerkleRootTxn);
      await expect(updateMerkleRootTxn)
        .to.emit(creditScoreContract, 'MerkleRootUpdated')
        .withArgs(owner.address, THREE_BYTES32, timestamp);
      expect(await creditScoreContract.upcomingMerkleRoot()).eq(THREE_BYTES32);
      expect(await creditScoreContract.currentMerkleRoot()).not.eq(maliciousRoot);
    });

    it('should check if delay work properly', async () => {
      const mockCreditScoreContract = await deployMockSapphireCreditScore(owner, ONE_BYTES32, merkleRootUpdater.address);
      await mockCreditScoreContract.setPause(false);
      await mockCreditScoreContract.connect(merkleRootUpdater).updateMerkleRoot(TWO_BYTES32);
      const lastMerkleRootUpdate = await mockCreditScoreContract.lastMerkleRootUpdate();
      const delay = await mockCreditScoreContract.merkleRootDelayDuration();
      await expect(
        mockCreditScoreContract.connect(merkleRootUpdater).updateMerkleRoot(THREE_BYTES32),
      ).to.be.revertedWith('SapphireCreditScore: too frequent root update');
      await mockCreditScoreContract.setCurrentTimestamp(lastMerkleRootUpdate.add(delay).sub(1));
      await expect(
        mockCreditScoreContract.connect(merkleRootUpdater).updateMerkleRoot(THREE_BYTES32),
      ).to.be.revertedWith('SapphireCreditScore: too frequent root update');
      const { wait: waitFotCurrentTimestamp } = await mockCreditScoreContract.setCurrentTimestamp(
        lastMerkleRootUpdate.add(delay),
      );
      await waitFotCurrentTimestamp();
      await mockCreditScoreContract.connect(merkleRootUpdater).updateMerkleRoot(THREE_BYTES32);
      expect(await mockCreditScoreContract.currentMerkleRoot()).eq(TWO_BYTES32);
      expect(await mockCreditScoreContract.upcomingMerkleRoot()).eq(THREE_BYTES32);
    });
  });

  describe('#verifyAndUpdate', async () => {
    let tree: CreditScoreTree;
    let creditScore1;
    let creditScore2;

    beforeEach(async () => {
      creditScore1 = {
        account: owner.address,
        amount: BigNumber.from(12),
      };
      creditScore2 = {
        account: unauthorised.address,
        amount: BigNumber.from(20),
      };
      tree = new CreditScoreTree([creditScore1, creditScore2]);
      ctx = await generateContext(createSapphireFixture(tree.getHexRoot()), async () => {});
      creditScoreContract = ctx.contracts.sapphire.creditScore;
    });

    it('should be able to verify and update a users score', async () => {
      expect(await creditScoreContract.currentMerkleRoot()).eq(tree.getHexRoot());
      const verifyAndUpdateTxn = creditScoreContract
        .connect(unauthorised)
        .verifyAndUpdate(getVerifyRequest(creditScore1.account, creditScore1.amount, tree));
      const verifyAndUpdateTimestamp = await getTxnTimestamp(ctx, verifyAndUpdateTxn);
      expect(verifyAndUpdateTxn)
        .to.emit(creditScoreContract, 'CreditScoreUpdated')
        .withArgs(creditScore1.account, creditScore1.amount, verifyAndUpdateTimestamp);

      const { 0: creditScore, 1: maxCreditScore, 2: lastUpdated } = await creditScoreContract.getLastScore(
        creditScore1.account,
      );
      expect(creditScore).eq(creditScore1.amount);
      expect(lastUpdated).eq(verifyAndUpdateTimestamp);
      expect(maxCreditScore).eq(await creditScoreContract.maxScore());
    });

    it('should not be able to verifyAndUpdate an invalid proof', async () => {
      const invalidTree = new CreditScoreTree([
        { ...creditScore1, amount: BigNumber.from(99) },
        creditScore2,
      ]);
      await expect(
        creditScoreContract
          .connect(unauthorised)
          .verifyAndUpdate(getVerifyRequest(creditScore1.account, BigNumber.from(99), invalidTree)),
      ).to.be.revertedWith('SapphireCreditScore: invalid proof');
    });

    it('should reverify a score and change timestamp when score is the same', async () => {
      const creditScoreContract = await deployMockSapphireCreditScore(
        owner,tree.getHexRoot(), merkleRootUpdater.address
      );
      await expect(
        creditScoreContract.verifyAndUpdate(getVerifyRequest(creditScore1.account, creditScore1.amount, tree)),
      )
        .to.emit(creditScoreContract, 'CreditScoreUpdated')
        .withArgs(
          creditScore1.account,
          creditScore1.amount,
          await creditScoreContract.getCurrentTimestamp(),
        );
      await creditScoreContract.setCurrentTimestamp(631000);
      await expect(
        creditScoreContract.verifyAndUpdate(getVerifyRequest(creditScore1.account, creditScore1.amount, tree)),
      )
        .to.emit(creditScoreContract, 'CreditScoreUpdated')
        .withArgs(creditScore1.account, creditScore1.amount, 631000);
    });

    it('should reverify a score and change timestamp after merkle root was changed', async () => {
      const creditScoreContract = await deployMockSapphireCreditScore(
        owner,tree.getHexRoot(), merkleRootUpdater.address
      );
      await creditScoreContract.setPause(false)
      const initTimestamp = await creditScoreContract.getCurrentTimestamp();
      const merkleRootDelay = await creditScoreContract.merkleRootDelayDuration();
      await expect(
        creditScoreContract.verifyAndUpdate(getVerifyRequest(creditScore1.account, creditScore1.amount, tree)),
      )
        .to.emit(creditScoreContract, 'CreditScoreUpdated')
        .withArgs(creditScore1.account, creditScore1.amount, initTimestamp);
      const changedAmount = BigNumber.from(99);
      const newTree = new CreditScoreTree([
        { ...creditScore1, amount: changedAmount },
        creditScore2,
      ]);
      await creditScoreContract.connect(merkleRootUpdater).updateMerkleRoot(newTree.getHexRoot());
      
      const changedTimestamp = initTimestamp.add(merkleRootDelay);
      await creditScoreContract.setCurrentTimestamp(changedTimestamp);
      await creditScoreContract.connect(merkleRootUpdater).updateMerkleRoot(TWO_BYTES32);

      await expect(
        creditScoreContract.verifyAndUpdate(getVerifyRequest(creditScore1.account, changedAmount, newTree)),
      )
        .to.emit(creditScoreContract, 'CreditScoreUpdated')
        .withArgs(creditScore1.account, changedAmount, changedTimestamp);

      const { 0: creditScore, 2: lastUpdated } = await creditScoreContract.getLastScore(
        creditScore1.account,
      );
      expect(creditScore).eq(changedAmount);
      expect(lastUpdated).eq(changedTimestamp);
    });
  });

  describe('#updateMerkleRootUpdater', () => {
    it('should be able to update as the owner', async () => {
      await creditScoreContract.updateMerkleRootUpdater(ctx.signers.positionOperator.address);
      expect(await creditScoreContract.merkleRootUpdater()).eq(
        ctx.signers.positionOperator.address,
      );
    });

    it('should not be able to update as non-owner', async () => {
      await expect(
        creditScoreContract
          .connect(merkleRootUpdater)
          .updateMerkleRootUpdater(merkleRootUpdater.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('#setMerkleRootDelay', () => {
    it('should be able to update as the owner', async () => {
      await expect(creditScoreContract.setMerkleRootDelay(5))
        .to.emit(creditScoreContract, 'DelayDurationUpdated')
        .withArgs(owner.address, 5);
      expect(await creditScoreContract.merkleRootDelayDuration()).eq(5);
    });

    it('should not be able to update as non-owner', async () => {
      await expect(
        creditScoreContract.connect(merkleRootUpdater).setMerkleRootDelay(5),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
});

function getVerifyRequest(account: string, amount: BigNumber, tree: CreditScoreTree) {
  return {
    account: account,
    score: amount,
    merkleProof: tree.getProof(account, amount),
  };
}
