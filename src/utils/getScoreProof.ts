import { CreditScore, CreditScoreProof } from '@arc-types/sapphireCore';
import CreditScoreTree from '@src/MerkleTree/CreditScoreTree';

export function getScoreProof(
  creditScore: CreditScore,
  creditScoreTreeToCheck: CreditScoreTree,
): CreditScoreProof {
  return {
    account: creditScore.account,
    score: creditScore.amount,
    merkleProof: creditScoreTreeToCheck.getProof(creditScore.account, creditScore.amount),
  };
}
