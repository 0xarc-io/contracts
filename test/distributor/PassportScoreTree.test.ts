import { Wallet } from '@ethersproject/wallet';
import { PassportScoreTree } from '@src/MerkleTree';
import { CREDIT_PROOF_PROTOCOL } from '@src/constants/protocols';
import { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import { v1 as uuidv1 } from 'uuid';

describe('PassportScoreTree', () => {
  const account1 = Wallet.createRandom().address;
  const account2 = Wallet.createRandom().address;

  const passportScore1 = {
    account: account1,
    protocol: utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
    score: BigNumber.from(500),
  };
  const passportScore2 = {
    account: account2,
    protocol: utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
    score: BigNumber.from(20),
  };

  function generateScalabilityScores(numScores: number) {
    const scores = [];
    const protocol = utils.formatBytes32String(CREDIT_PROOF_PROTOCOL);
    for (let i = 0; i < numScores; i++) {
      scores.push({
        account: '0x' + uuidv1().replace(/-/g, '') + '00000000',
        // account: Wallet.createRandom().address, // <-- this takes wayyyyy to long to generate an address - Classicus, Nov 15th, 2021
        protocol,
        score: BigNumber.from(i),
      });
    }
    return scores;
  }


  describe('#constructor', () => {
    it('fails if a score is duplicated', () => {
      expect(
        () => new PassportScoreTree([passportScore1, passportScore2, passportScore2]),
      ).throw(
        `There are more than 1 score for the protocol ${CREDIT_PROOF_PROTOCOL} for user ${passportScore2.account}`,
      );
    });

    it('fails if there is more than 1 score type per address', () => {
      expect(
        () =>
          new PassportScoreTree([
            passportScore1,
            passportScore2,
            {
              account: account1,
              protocol: utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
              score: BigNumber.from(10),
            },
          ]),
      ).throw(
        `There are more than 1 score for the protocol ${CREDIT_PROOF_PROTOCOL} for user ${passportScore1.account}`,
      );
    });

    it('successfully created', () => {
      expect(() => new PassportScoreTree([passportScore1, passportScore2])).not
        .throw;
    });


    
  });

  describe('Can scale', () => {
    it('to 1k scores', () => {
      const scores = generateScalabilityScores(1000);
      expect(() => new PassportScoreTree(scores)).not
        .throw;
    });

    it('to 10k scores', () => {
      const scores = generateScalabilityScores(10000);
      expect(() => new PassportScoreTree(scores)).not
        .throw;
    });

    it('to 100k scores', () => {
      const scores = generateScalabilityScores(100000);
      expect(() => new PassportScoreTree(scores)).not
        .throw;
    });

    it('to 1m scores', () => {
      const scores = generateScalabilityScores(1000000);
      expect(() => new PassportScoreTree(scores)).not
        .throw;
    });

    // My computer can only go to 9m, but our servers will scale up - Classicus, Nov 15th, 2021
    xit('to 10m scores', () => {
      const scores = generateScalabilityScores(9000000);
      expect(() => new PassportScoreTree(scores)).not
        .throw;
    }).timeout(60000);

    // Theoritical limit of arrays is 2^32 - 1, so with enough memory we can scale linearly (time).
    xit('to 100m scores', () => {
      const scores = generateScalabilityScores(1000000000);
      expect(() => new PassportScoreTree(scores)).not
        .throw;
    });

  }).timeout(60000);
});

