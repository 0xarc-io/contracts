import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import { SapphireMapperLinear, SapphireMapperLinearFactory } from '@src/typings';
import { MockSapphireCreditScore } from '@src/typings/MockSapphireCreditScore';
import { MockSapphireCreditScoreFactory } from '@src/typings/MockSapphireCreditScoreFactory';
import { MockSapphireMapperLinearFactory } from '@src/typings/MockSapphireMapperLinearFactory';
import { SapphireAssessor } from '@src/typings/SapphireAssessor';
import { SapphireAssessorFactory } from '@src/typings/SapphireAssessorFactory';
import ArcNumber from '@src/utils/ArcNumber';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

describe('SapphireAssessor', () => {
  let owner: SignerWithAddress;
  let assessor: SapphireAssessor;
  let mapper: SapphireMapperLinear;
  let creditScoreContract: MockSapphireCreditScore;

  let creditScoreTree: CreditScoreTree;
  let creditScore1: CreditScore;
  let creditScore2: CreditScore;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  /**
   * Returns an assessor that is set up with a sapphire credit score contract
   * containing a user with the given `creditScore`
   */
  async function getAssessorCreditFixture(
    creditScore: BigNumber,
  ): Promise<{
    assessor: SapphireAssessor;
    creditScore: CreditScore;
    creditScoreTree: CreditScoreTree;
  }> {
    const testCreditScore = {
      account: user1.address,
      amount: creditScore,
    };

    const testCreditScoreTree = new CreditScoreTree([testCreditScore]);

    const testCreditScoreContract = await new MockSapphireCreditScoreFactory(owner).deploy(
      testCreditScoreTree.getHexRoot(),
      owner.address,
      ArcNumber.new(1000),
    );

    const testAssessor = await new SapphireAssessorFactory(owner).deploy(
      mapper.address,
      testCreditScoreContract.address,
    );

    console.log(
      `PROOFZ: ${testCreditScoreTree.getProof(testCreditScore.account, testCreditScore.amount)}`,
    );

    return {
      assessor: testAssessor,
      creditScore: testCreditScore,
      creditScoreTree: testCreditScoreTree,
    };
  }

  before(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
    user1 = signers[1];
    user2 = signers[2];

    mapper = await new SapphireMapperLinearFactory(owner).deploy();

    creditScore1 = {
      account: user1.address,
      amount: ArcNumber.new(600),
    };

    creditScore2 = {
      account: user2.address,
      amount: ArcNumber.new(200),
    };

    creditScoreTree = new CreditScoreTree([creditScore1, creditScore2]);

    creditScoreContract = await new MockSapphireCreditScoreFactory(owner).deploy(
      creditScoreTree.getHexRoot(),
      '0x0000000000000000000000000000000000000000',
      ArcNumber.new(1000),
    );

    assessor = await new SapphireAssessorFactory(owner).deploy(
      mapper.address,
      creditScoreContract.address,
    );
  });

  describe('constructor', () => {
    it('reverts if mapper and credit score are null', async () => {
      await expect(
        new SapphireAssessorFactory(owner).deploy(
          '0x0000000000000000000000000000000000000000',
          creditScoreContract.address,
        ),
      ).to.be.revertedWith('The mapper and the credit score addresses cannot be null');

      await expect(
        new SapphireAssessorFactory(owner).deploy(
          mapper.address,
          '0x0000000000000000000000000000000000000000',
        ),
      ).to.be.revertedWith('The mapper and the credit score addresses cannot be null');

      await expect(
        new SapphireAssessorFactory(owner).deploy(
          '0x0000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000',
        ),
      ).to.be.revertedWith('The mapper and the credit score addresses cannot be null');
    });

    it('initializes the mapper and the credit score', async () => {
      const testAssessor = await new SapphireAssessorFactory(owner).deploy(
        mapper.address,
        creditScoreContract.address,
      );

      expect(await testAssessor.mapper()).to.eq(mapper.address);
      expect(await testAssessor.creditScoreContract()).to.eq(creditScoreContract.address);
    });
  });

  describe.only('#assess', () => {
    it('reverts if upper bound or account are empty', async () => {
      // upper bound is empty
      await expect(
        assessor.assess(0, 0, {
          account: user1.address,
          score: 100,
          merkleProof: creditScoreTree.getProof(creditScore1.account, creditScore1.amount),
        }),
      ).to.be.revertedWith('The upper bound cannot be empty');

      // account is empty
      await expect(
        assessor.assess(0, 100, {
          account: ZERO_ADDRESS,
          score: creditScore1.amount,
          merkleProof: creditScoreTree.getProof(creditScore1.account, creditScore1.amount),
        }),
      ).to.be.revertedWith('The account cannot be empty');
    });

    it('reverts if lower bound is not smaller than upper bound', async () => {
      await expect(
        assessor.assess(11, 10, {
          account: user1.address,
          score: creditScore1.amount,
          merkleProof: creditScoreTree.getProof(creditScore1.account, creditScore1.amount),
        }),
      ).to.be.revertedWith('The lower bound must be smaller than the upper bound');
    });

    it('reverts if score is passed but no proof is passed', async () => {
      await expect(
        assessor.assess(1, 10, {
          account: user1.address,
          score: creditScore1.amount,
          merkleProof: [],
        }),
      ).to.be.revertedWith('If a credit score is passed, the proof cannot be null');
    });

    it('reverts if the mapper returns a value that is outside the lower and upper bounds', async () => {
      const testMapper = await new MockSapphireMapperLinearFactory(owner).deploy();
      const testAssessor = await new SapphireAssessorFactory(owner).deploy(
        testMapper.address,
        creditScoreContract.address,
      );

      await testMapper.setMapResult(0);

      await expect(
        testAssessor.assess(1, 10, {
          account: user1.address,
          score: creditScore1.amount,
          merkleProof: creditScoreTree.getProof(creditScore1.account, creditScore1.amount),
        }),
      ).to.be.revertedWith('The mapper returned a value outside the lower and upper bounds');

      await testMapper.setMapResult(11);

      await expect(
        testAssessor.assess(1, 10, {
          account: user1.address,
          score: creditScore1.amount,
          merkleProof: creditScoreTree.getProof(creditScore1.account, creditScore1.amount),
        }),
      ).to.be.revertedWith('The mapper returned a value outside the lower and upper bounds');
    });

    it(`returns the upperBound if the user doesn't have an existing score and no proof`, async () => {
      // If there's no score & no proof, pass the lowest credit score to the mapper
      const value = await assessor.assess(1, 10, {
        account: user2.address,
        score: 0,
        merkleProof: [],
      });

      expect(value).to.eq(10);
    });

    it.skip('returns the lowerBound if credit score is maxed out', async () => {
      const {
        assessor: testAssessor,
        creditScore: maxCreditScore,
        creditScoreTree: testCreditScoreTree,
      } = await getAssessorCreditFixture(ArcNumber.new(1000));

      console.log(
        `Proof: ${testCreditScoreTree.getProof(maxCreditScore.account, maxCreditScore.amount)}`,
      );

      const value = await testAssessor.assess(ArcNumber.new(100), ArcNumber.new(200), {
        account: maxCreditScore.account,
        score: maxCreditScore.amount,
        merkleProof: testCreditScoreTree.getProof(maxCreditScore.account, maxCreditScore.amount),
      });

      expect(value).to.eq(ArcNumber.new(100));
    });

    it.skip('returns the upperBound if credit score is at minimum', async () => {
      const {
        assessor: testAssessor,
        creditScore: minCreditScore,
      } = await getAssessorCreditFixture(BigNumber.from(0));

      const value = await testAssessor.assess(ArcNumber.new(100), ArcNumber.new(200), {
        account: minCreditScore.account,
        score: minCreditScore.amount,
        merkleProof: creditScoreTree.getProof(minCreditScore.account, minCreditScore.amount),
      });

      // 200 - (600/1000 * (200-100)) = 140
      expect(value).to.eq(ArcNumber.new(200));
    });

    it.skip('returns the correct value given the credit score and a valid proof', async () => {
      const value = await assessor.assess(ArcNumber.new(100), ArcNumber.new(200), {
        account: user2.address,
        score: creditScore1.amount,
        merkleProof: creditScoreTree.getProof(creditScore1.account, creditScore1.amount),
      });

      // 200 - (600/1000 * (200-100)) = 140
      expect(value).to.eq(ArcNumber.new(140));
    });
  });

  describe('#setMapper', () => {
    it('reverts if called by non-owner', async () => {
      const userAssessor = SapphireAssessorFactory.connect(assessor.address, user1);

      await expect(userAssessor.setMapper(user1.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('reverts if no new mapper is passed', async () => {
      await expect(assessor.setMapper('')).to.be.revertedWith('The new mapper cannot be null');
      await expect(
        assessor.setMapper('0x0000000000000000000000000000000000000000'),
      ).to.be.revertedWith('The new mapper cannot be null');
    });

    it('reverts if the new mapper is the same as the existing one', async () => {
      await expect(assessor.setMapper(mapper.address)).to.be.revertedWith(
        'The same mapper is already set',
      );
    });

    it('sets the new mapper as owner', async () => {
      const testMapper = await new SapphireMapperLinearFactory(owner).deploy();

      await assessor.setMapper(testMapper.address);

      expect(assessor.mapper()).to.eq(testMapper.address);
    });
  });

  describe('#setCreditScoreContract', () => {
    it('reverts if called by non-owner', async () => {
      const userAssessor = SapphireAssessorFactory.connect(assessor.address, user1);

      await expect(userAssessor.setCreditScoreContract(user1.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('reverts if new address is 0', async () => {
      await expect(assessor.setCreditScoreContract('')).to.be.revertedWith(
        'The new credit score contract address cannot be null.',
      );
      await expect(
        assessor.setCreditScoreContract('0x0000000000000000000000000000000000000000'),
      ).to.be.revertedWith('Cannot set a null credit score contract');
    });

    it('reverts if new address is the same as the existing one', async () => {
      await expect(assessor.setCreditScoreContract(creditScoreContract.address)).to.be.revertedWith(
        'The same credit score contract is already set',
      );
    });

    it('sets the new credit score contract', async () => {
      const testCreditScoreTree = new CreditScoreTree([creditScore2]);

      const testCreditScoreContract = await new MockSapphireCreditScoreFactory(owner).deploy(
        testCreditScoreTree.getHexRoot(),
        owner.address,
        ArcNumber.new(1000),
      );

      await assessor.setCreditScoreContract(testCreditScoreContract.address);

      expect(await assessor.creditScoreContract()).to.eq(testCreditScoreContract.address);
    });
  });
});

interface CreditScore {
  account: string;
  amount: BigNumber;
}
