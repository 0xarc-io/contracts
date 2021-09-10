import { PassportScore, PassportScoreProof } from '@arc-types/sapphireCore';
import { constants, BigNumber } from 'ethers';
import CreditScoreTree from '../MerkleTree/PassportScoreTree';

export function getScoreProof(
  score: PassportScore,
  creditScoreTreeToCheck: CreditScoreTree,
): PassportScoreProof {
  return {
    ...score,
    merkleProof: creditScoreTreeToCheck.getProof(score),
  };
}

export function getEmptyScoreProof(account?: string): PassportScoreProof {
  return {
    account: account || constants.AddressZero,
    protocol: '',
    score: BigNumber.from(0),
    merkleProof: [],
  };
}
