import { CreditScore, CreditScoreProof } from '@arc-types/sapphireCore';
import { Signer } from '@ethersproject/abstract-signer';
import { BigNumber } from '@ethersproject/bignumber';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';

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

export async function getEmptyScoreProof(caller: Signer) {
  return {
    account: await caller.getAddress(),
    score: BigNumber.from(0),
    merkleProof: [],
  };
}

export async function getEmptyScoreProof(caller: Signer) {
  return {
    account: await caller.getAddress(),
    score: BigNumber.from(0),
    merkleProof: [],
  };
}
