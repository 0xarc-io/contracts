import { CreditScore } from '@arc-types/sapphireCore';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';
import {
  SapphireMapperLinear,
  SapphireMapperLinearFactory,
} from '@src/typings';
import { MockSapphireCreditScore } from '@src/typings/MockSapphireCreditScore';
import { MockSapphireCreditScoreFactory } from '@src/typings/MockSapphireCreditScoreFactory';
import { MockSapphireMapperLinearFactory } from '@src/typings/MockSapphireMapperLinearFactory';
import { SapphireAssessor } from '@src/typings/SapphireAssessor';
import { SapphireAssessorFactory } from '@src/typings/SapphireAssessorFactory';
import ArcNumber from '@src/utils/ArcNumber';
import { expect } from 'chai';
import { BigNumber, constants } from 'ethers';
import { ethers } from 'hardhat';

describe('SapphireAssessor', () => {
  let owner: SignerWithAddress;
  let assessor: SapphireAssessor;
  let mapper: SapphireMapperLinear;
  let creditScoreContract: MockSapphireCreditScore;

  let creditScoreTree: CreditScoreTree;
  let creditScore1: CreditScore;
  let creditScore2: CreditScore;
  let creditScore3: CreditScore;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  /**
   * Returns an assessor that is set up with a sapphire credit score contract
   * containing a user with the given `creditScore`
   */
  async function getAssessorWithCredit(
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
    const anotherCreditScore = {
      account: user2.address,
      amount: BigNumber.from(500),
    };

    const testCreditScoreTree = new CreditScoreTree([
      testCreditScore,
      anotherCreditScore,
    ]);

    const testCreditScoreContract = await new MockSapphireCreditScoreFactory(
      owner,
    ).deploy(testCreditScoreTree.getHexRoot(), owner.address, owner.address);

    const testAssessor = await new SapphireAssessorFactory(owner).deploy(
      mapper.address,
      testCreditScoreContract.address,
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
      amount: BigNumber.from(600),
    };

    creditScore2 = {
      account: user2.address,
      amount: BigNumber.from(200),
    };

    creditScore3 = {
      account: signers[3].address,
      amount: BigNumber.from(300),
    };

    creditScoreTree = new CreditScoreTree([
      creditScore1,
      creditScore2,
      creditScore3,
    ]);

    creditScoreContract = await new MockSapphireCreditScoreFactory(
      owner,
    ).deploy(
      creditScoreTree.getHexRoot(),
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
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
      ).to.be.revertedWith(
        'SapphireAssessor: The mapper and the credit score addresses cannot be null',
      );

      await expect(
        new SapphireAssessorFactory(owner).deploy(
          mapper.address,
          '0x0000000000000000000000000000000000000000',
        ),
      ).to.be.revertedWith(
        'SapphireAssessor: The mapper and the credit score addresses cannot be null',
      );

      await expect(
        new SapphireAssessorFactory(owner).deploy(
          '0x0000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000000',
        ),
      ).to.be.revertedWith(
        'SapphireAssessor: The mapper and the credit score addresses cannot be null',
      );
    });

    it('initializes the mapper and the credit score', async () => {
      const testAssessor = await new SapphireAssessorFactory(owner).deploy(
        mapper.address,
        creditScoreContract.address,
      );

      expect(await testAssessor.mapper()).to.eq(mapper.address);
      expect(await testAssessor.creditScoreContract()).to.eq(
        creditScoreContract.address,
      );
    });
  });

  describe('#assess', () => {
    it('reverts if upper bound or account are empty', async () => {
      // upper bound is empty
      await expect(
        assessor.assess(
          0,
          0,
          {
            account: user1.address,
            score: 100,
            merkleProof: creditScoreTree.getProof(
              creditScore1.account,
              creditScore1.amount,
            ),
          },
          false,
        ),
      ).to.be.revertedWith('SapphireAssessor: The upper bound cannot be zero');

      // account is empty
      await expect(
        assessor.assess(
          0,
          100,
          {
            account: constants.AddressZero,
            score: creditScore1.amount,
            merkleProof: creditScoreTree.getProof(
              creditScore1.account,
              creditScore1.amount,
            ),
          },
          false,
        ),
      ).to.be.revertedWith(
        'SapphireAssessor: The account cannot be the zero address',
      );
    });

    it('reverts if lower bound is not smaller than upper bound', async () => {
      await expect(
        assessor.assess(
          11,
          10,
          {
            account: user1.address,
            score: creditScore1.amount,
            merkleProof: creditScoreTree.getProof(
              creditScore1.account,
              creditScore1.amount,
            ),
          },
          false,
        ),
      ).to.be.revertedWith(
        'SapphireAssessor: The lower bound must be smaller than the upper bound',
      );
    });

    it('reverts if the mapper returns a value that is outside the lower and upper bounds', async () => {
      const testMapper = await new MockSapphireMapperLinearFactory(
        owner,
      ).deploy();
      const testAssessor = await new SapphireAssessorFactory(owner).deploy(
        testMapper.address,
        creditScoreContract.address,
      );

      await testMapper.setMapResult(0);

      await expect(
        testAssessor.assess(
          1,
          10,
          {
            account: user1.address,
            score: creditScore1.amount,
            merkleProof: creditScoreTree.getProof(
              creditScore1.account,
              creditScore1.amount,
            ),
          },
          false,
        ),
      ).to.be.revertedWith(
        'SapphireAssessor: The mapper returned a value out of bounds',
      );

      await testMapper.setMapResult(11);

      await expect(
        testAssessor.assess(
          1,
          10,
          {
            account: user1.address,
            score: creditScore1.amount,
            merkleProof: creditScoreTree.getProof(
              creditScore1.account,
              creditScore1.amount,
            ),
          },
          false,
        ),
      ).to.be.revertedWith(
        'SapphireAssessor: The mapper returned a value out of bounds',
      );
    });

    it('reverts if the proof is invalid', async () => {
      await expect(
        assessor.assess(
          1,
          10,
          {
            account: creditScore1.account,
            score: creditScore1.amount.add(1),
            merkleProof: creditScoreTree.getProof(
              creditScore1.account,
              creditScore1.amount,
            ),
          },
          false,
        ),
      ).to.be.revertedWith('SapphireCreditScore: invalid proof');
    });

    it(`returns the upperBound if the user doesn't have an existing score and no proof`, async () => {
      // If there's no score & no proof, pass the lowest credit score to the mapper
      await expect(
        assessor.assess(
          1,
          10,
          {
            account: user2.address,
            score: 0,
            merkleProof: [],
          },
          false,
        ),
      )
        .to.emit(assessor, 'Assessed')
        .withArgs(user2.address, 10);
    });

    it(`returns the upperBound if the user doesn't have an existing score, score is required and no proof`, async () => {
      await expect(
        assessor.assess(
          1,
          10,
          {
            account: creditScore3.account,
            score: 0,
            merkleProof: [],
          },
          true,
        ),
      )
        .to.emit(assessor, 'Assessed')
        .withArgs(creditScore3.account, 10);
    });

    it(`throw an error if the user has an existing score, score is required and no proof`, async () => {
      await expect(
        assessor.assess(
          1,
          10,
          {
            account: user2.address,
            score: creditScore2.amount,
            merkleProof: creditScoreTree.getProof(
              creditScore2.account,
              creditScore2.amount,
            ),
          },
          true,
        ),
      ).to.emit(assessor, 'Assessed');

      await expect(
        assessor.assess(
          1,
          10,
          {
            account: user2.address,
            score: 0,
            merkleProof: [],
          },
          true,
        ),
      ).to.be.revertedWith(
        'SapphireAssessor: proof should be provided for credit score',
      );
    });

    it(`emit Assessed if the user has an existing score, score is required and proof is provided`, async () => {
      await expect(
        assessor.assess(
          ArcNumber.new(100),
          ArcNumber.new(200),
          {
            account: user1.address,
            score: creditScore1.amount,
            merkleProof: creditScoreTree.getProof(
              creditScore1.account,
              creditScore1.amount,
            ),
          },
          true,
        ),
      ).to.emit(assessor, 'Assessed');

      await expect(
        assessor.assess(
          ArcNumber.new(100),
          ArcNumber.new(200),
          {
            account: user1.address,
            score: creditScore1.amount,
            merkleProof: creditScoreTree.getProof(
              creditScore1.account,
              creditScore1.amount,
            ),
          },
          true,
        ),
      ).to.emit(assessor, 'Assessed');
    });

    it('returns the lowerBound if credit score is maxed out', async () => {
      const {
        assessor: testAssessor,
        creditScore: maxCreditScore,
        creditScoreTree: testCreditScoreTree,
      } = await getAssessorWithCredit(BigNumber.from(1000));

      await expect(
        testAssessor.assess(
          ArcNumber.new(100),
          ArcNumber.new(200),
          {
            account: maxCreditScore.account,
            score: maxCreditScore.amount,
            merkleProof: testCreditScoreTree.getProof(
              maxCreditScore.account,
              maxCreditScore.amount,
            ),
          },
          false,
        ),
      )
        .to.emit(testAssessor, 'Assessed')
        .withArgs(maxCreditScore.account, ArcNumber.new(100));
    });

    it('returns the upperBound if credit score is at minimum', async () => {
      const {
        assessor: testAssessor,
        creditScore: minCreditScore,
        creditScoreTree: testCreditScoreTree,
      } = await getAssessorWithCredit(BigNumber.from(0));

      await expect(
        testAssessor.assess(
          ArcNumber.new(100),
          ArcNumber.new(200),
          {
            account: minCreditScore.account,
            score: minCreditScore.amount,
            merkleProof: testCreditScoreTree.getProof(
              minCreditScore.account,
              minCreditScore.amount,
            ),
          },
          false,
        ),
      )
        .to.emit(testAssessor, 'Assessed')
        .withArgs(minCreditScore.account, ArcNumber.new(200));
    });

    it('returns the correct value given the credit score and a valid proof', async () => {
      // 200 - (600/1000 * (200-100)) = 140
      await expect(
        assessor.assess(
          ArcNumber.new(100),
          ArcNumber.new(200),
          {
            account: user1.address,
            score: creditScore1.amount,
            merkleProof: creditScoreTree.getProof(
              creditScore1.account,
              creditScore1.amount,
            ),
          },
          false,
        ),
      )
        .to.emit(assessor, 'Assessed')
        .withArgs(user1.address, ArcNumber.new(140));
    });
  });

  describe('#setMapper', () => {
    it('reverts if called by non-owner', async () => {
      const userAssessor = SapphireAssessorFactory.connect(
        assessor.address,
        user1,
      );

      await expect(userAssessor.setMapper(user1.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });

    it('reverts if no new mapper is passed', async () => {
      await expect(
        assessor.setMapper(constants.AddressZero),
      ).to.be.revertedWith('SapphireAssessor: _mapper is not a contract');
    });

    it('reverts if the new mapper is the same as the existing one', async () => {
      await expect(assessor.setMapper(mapper.address)).to.be.revertedWith(
        'The same mapper is already set',
      );
    });

    it('sets the new mapper as owner', async () => {
      const testMapper = await new SapphireMapperLinearFactory(owner).deploy();

      await assessor.setMapper(testMapper.address);

      const newMapper = await assessor.mapper();
      expect(newMapper).to.eq(testMapper.address);
    });

    it('emits a MapperSet event', async () => {
      const testMapper = await new SapphireMapperLinearFactory(owner).deploy();

      await expect(assessor.setMapper(testMapper.address))
        .to.emit(assessor, 'MapperSet')
        .withArgs(testMapper.address);
    });
  });

  describe('#setCreditScoreContract', () => {
    it('reverts if called by non-owner', async () => {
      const userAssessor = SapphireAssessorFactory.connect(
        assessor.address,
        user1,
      );

      await expect(
        userAssessor.setCreditScoreContract(user1.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('reverts if new address is 0', async () => {
      await expect(
        assessor.setCreditScoreContract(
          '0x0000000000000000000000000000000000000000',
        ),
      ).to.be.revertedWith('SapphireAssessor: _creditScore is not a contract');
    });

    it('reverts if new address is the same as the existing one', async () => {
      await expect(
        assessor.setCreditScoreContract(creditScoreContract.address),
      ).to.be.revertedWith(
        'SapphireAssessor: The same credit score contract is already set',
      );
    });

    it('sets the new credit score contract', async () => {
      const testCreditScoreTree = new CreditScoreTree([creditScore2]);

      const testCreditScoreContract = await new MockSapphireCreditScoreFactory(
        owner,
      ).deploy(testCreditScoreTree.getHexRoot(), owner.address, owner.address);

      await assessor.setCreditScoreContract(testCreditScoreContract.address);

      expect(await assessor.creditScoreContract()).to.eq(
        testCreditScoreContract.address,
      );
    });

    it('emits the CreditScoreContractSet event', async () => {
      const testCreditScoreTree = new CreditScoreTree([creditScore2]);

      const testCreditScoreContract = await new MockSapphireCreditScoreFactory(
        owner,
      ).deploy(testCreditScoreTree.getHexRoot(), owner.address, owner.address);

      await expect(
        assessor.setCreditScoreContract(testCreditScoreContract.address),
      )
        .to.emit(assessor, 'CreditScoreContractSet')
        .withArgs(testCreditScoreContract.address);
    });
  });
});
