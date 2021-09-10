import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { Wallet } from '@ethersproject/wallet';
import CreditScoreTree from '@src/MerkleTree/PassportScoreTree';

describe('CreditScoreTree', () => {
  const account1 = Wallet.createRandom().address;
  const account2 = Wallet.createRandom().address;
  const creditScore1 = {
    account: account1,
    amount: BigNumber.from(500),
  };
  const creditScore2 = {
    account: account2,
    amount: BigNumber.from(20),
  };

  describe('#constructor', () => {
    it('fails if credit score is duplicated', () => {
      expect(
        () => new CreditScoreTree([creditScore1, creditScore2, creditScore2]),
      ).throw(`Credit score for ${creditScore2.account} is not unique`);
    });

    it('fails if there are more than 2 credit scores per address', () => {
      expect(
        () =>
          new CreditScoreTree([
            creditScore1,
            creditScore2,
            { account: account1, amount: BigNumber.from(10) },
          ]),
      ).throw(`Credit score for ${creditScore1.account} is not unique`);
    });

    it('successfully created', () => {
      expect(() => new CreditScoreTree([creditScore1, creditScore2])).not.throw;
    });
  });
});
