import { PassportScore } from '@arc-types/sapphireCore';
import { utils } from '@ethereum-waffle/provider/node_modules/ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { PassportScoreTree } from '@src/MerkleTree';
import {
  PassportScoreVerifiableTest,
  PassportScoreVerifiableTestFactory,
  SapphirePassportScores,
} from '@src/typings';
import { getEmptyScoreProof, getScoreProof } from '@src/utils';
import { DEFAULT_PROOF_PROTOCOL } from '@test/helpers/sapphireDefaults';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { generateContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

describe('PassportScoreVerifiable', () => {
  let creditScoreContract: SapphirePassportScores;
  let contract: PassportScoreVerifiableTest;
  let owner: SignerWithAddress;

  let userCreditScore: PassportScore;
  let ownerCreditScore: PassportScore;
  let tree: PassportScoreTree;

  before(async () => {
    const ctx = await generateContext(sapphireFixture, async (ctx) => {
      userCreditScore = {
        account: ctx.signers.scoredMinter.address,
        protocol: utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
        score: BigNumber.from(12),
      };
      ownerCreditScore = {
        account: ctx.signers.admin.address,
        protocol: utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
        score: BigNumber.from(20),
      };
      tree = new PassportScoreTree([userCreditScore, ownerCreditScore]);
      return setupSapphire(ctx, {
        merkleRoot: tree.getHexRoot(),
      });
    });
    owner = ctx.signers.admin;

    creditScoreContract = ctx.contracts.sapphire.passportScores;
    contract = await new PassportScoreVerifiableTestFactory(owner).deploy(
      creditScoreContract.address,
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#checkScoreProof', () => {
    it('reverts if score > 0 and proof is not passed', async () => {
      await expect(
        contract.doSomething(
          {
            ...getScoreProof(userCreditScore, tree),
            merkleProof: [],
          },
          false,
          false,
        ),
      ).to.be.revertedWith('SapphirePassportScores: invalid proof');
    });

    it(`reverts if the proof is not the caller's and _enforceSameCaller is true`, async () => {
      await expect(
        contract
          .connect(owner)
          .doSomething(getScoreProof(userCreditScore, tree), false, true),
      ).to.be.revertedWith(
        'PassportScoreVerifiable: proof does not belong to the caller',
      );
    });

    it('does not revert if proof is not required and score is 0', async () => {
      await expect(
        contract.doSomething(getEmptyScoreProof(), false, false),
      ).to.emit(contract, 'DidNotRevert');
    });

    it('does not revert if proof is required and is valid', async () => {
      await expect(
        contract.doSomething(getScoreProof(userCreditScore, tree), true, false),
      ).to.emit(contract, 'DidNotRevert');
    });
  });
});
