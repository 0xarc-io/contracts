import { PassportScore, PassportScoreProof } from '@arc-types/sapphireCore';
import { PassportScoreTree } from '@src/MerkleTree';
import { constants, BigNumber } from 'ethers';

export function getScoreProof(
  score: PassportScore,
  creditScoreTreeToCheck: PassportScoreTree,
): PassportScoreProof {
  return {
    ...score,
    merkleProof: creditScoreTreeToCheck.getProof(score),
  };
}

export function getEmptyScoreProof(
  account?: string,
  protocol = '',
): PassportScoreProof {
  return {
    account: account || constants.AddressZero,
    protocol,
    score: BigNumber.from(0),
    merkleProof: [],
  };
}
