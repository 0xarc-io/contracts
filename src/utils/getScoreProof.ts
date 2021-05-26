import { CreditScore, CreditScoreProof } from '@arc-types/sapphireCore';
import { Signer } from '@ethersproject/abstract-signer';
import { BigNumber } from '@ethersproject/bignumber';
import { constants } from 'ethers';
import CreditScoreTree from '../MerkleTree/CreditScoreTree';

export function getScoreProof(
  creditScore: CreditScore,
  creditScoreTreeToCheck: CreditScoreTree,
): CreditScoreProof {
  return {
    account: creditScore.account,
    score: creditScore.amount,
    merkleProof: creditScoreTreeToCheck.getProof(
      creditScore.account,
      creditScore.amount,
    ),
  };
}

export function getEmptyScoreProof() {
  return {
    account: constants.AddressZero,
    score: BigNumber.from(0),
    merkleProof: [],
  };
}
