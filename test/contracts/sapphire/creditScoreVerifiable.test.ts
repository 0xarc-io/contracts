import { CreditScore } from '@arc-types/sapphireCore';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { CreditScoreTree } from '@src/MerkleTree';
import { SapphireCreditScore } from '@src/typings';
import { CreditScoreVerifiableTest } from '@src/typings/CreditScoreVerifiableTest';
import { CreditScoreVerifiableTestFactory } from '@src/typings/CreditScoreVerifiableTestFactory';
import { getEmptyScoreProof, getScoreProof } from '@src/utils';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { generateContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

describe('CreditScoreVerifiable', () => {
  let creditScoreContract: SapphireCreditScore;
  let contract: CreditScoreVerifiableTest;
  let owner: SignerWithAddress;

  let userCreditScore: CreditScore;
  let ownerCreditScore: CreditScore;
  let tree: CreditScoreTree;

  before(async () => {
    const ctx = await generateContext(sapphireFixture, async (ctx) => {
      userCreditScore = {
        account: ctx.signers.scoredMinter.address,
        amount: BigNumber.from(12),
      };
      ownerCreditScore = {
        account: ctx.signers.admin.address,
        amount: BigNumber.from(20),
      };
      tree = new CreditScoreTree([userCreditScore, ownerCreditScore]);
      return setupSapphire(ctx, {
        merkleRoot: tree.getHexRoot(),
      });
    });
    owner = ctx.signers.admin;

    creditScoreContract = ctx.contracts.sapphire.creditScore;
    contract = await new CreditScoreVerifiableTestFactory(owner).deploy(
      creditScoreContract.address,
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#checkScoreProof', () => {
    it('reverts if the score proof is required but not passed', async () => {
      await expect(
        contract.proofRequiredDoSomething(getEmptyScoreProof()),
      ).to.be.revertedWith(
        'CreditScoreVerifiable: proof is required but it is not passed',
      );
    });

    it(`reverts if the proof is not the caller's`, async () => {
      await expect(
        contract.proofRequiredDoSomething(getScoreProof(userCreditScore, tree)),
      ).to.be.revertedWith(
        'CreditScoreVerifiable: proof does not belong to the caller',
      );
    });

    it('updates the credit score if the proof is passed', async () => {
      let lastCreditScore = await creditScoreContract.getLastScore(
        owner.address,
      );
      expect(lastCreditScore[0]).to.eq(0);

      await contract.proofRequiredDoSomething(
        getScoreProof(ownerCreditScore, tree),
      );

      lastCreditScore = await creditScoreContract.getLastScore(owner.address);
      expect(lastCreditScore[0]).to.eq(ownerCreditScore.amount);
    });

    it('does not update the credit score if proof is not passed and not required', async () => {
      let lastCreditScore = await creditScoreContract.getLastScore(
        owner.address,
      );
      expect(lastCreditScore[0]).to.eq(0);

      await contract.proofOptionalDoSomething(getEmptyScoreProof());

      lastCreditScore = await creditScoreContract.getLastScore(owner.address);
      expect(lastCreditScore[0]).to.eq(0);

      await contract.proofOptionalDoSomething(
        getScoreProof(ownerCreditScore, tree),
      );

      lastCreditScore = await creditScoreContract.getLastScore(owner.address);
      expect(lastCreditScore[0]).to.eq(ownerCreditScore.amount);
    });
  });
});
