import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { Wallet } from '@ethersproject/wallet';
import { PassportScoreTree } from '@src/MerkleTree';
import { DEFAULT_PROOF_PROTOCOL } from '@test/helpers/sapphireDefaults';

describe('PassportScoreTree', () => {
  const account1 = Wallet.createRandom().address;
  const account2 = Wallet.createRandom().address;
  const creditScore1 = {
    account: account1,
    protocol: DEFAULT_PROOF_PROTOCOL,
    score: BigNumber.from(500),
  };
  const creditScore2 = {
    account: account2,
    protocol: DEFAULT_PROOF_PROTOCOL,
    score: BigNumber.from(20),
  };

  describe('#constructor', () => {
    it('fails if credit score is duplicated', () => {
      expect(
        () => new PassportScoreTree([creditScore1, creditScore2, creditScore2]),
      ).throw(
        `There are more than 1 score for the protocol ${DEFAULT_PROOF_PROTOCOL} for user ${creditScore2.account}`,
      );
    });

    it('fails if there are more than 2 credit scores per address', () => {
      expect(
        () =>
          new PassportScoreTree([
            creditScore1,
            creditScore2,
            {
              account: account1,
              protocol: DEFAULT_PROOF_PROTOCOL,
              score: BigNumber.from(10),
            },
          ]),
      ).throw(
        `There are more than 1 score for the protocol ${DEFAULT_PROOF_PROTOCOL} for user ${creditScore1.account}`,
      );
    });

    it('successfully created', () => {
      expect(() => new PassportScoreTree([creditScore1, creditScore2])).not
        .throw;
    });
  });
});
