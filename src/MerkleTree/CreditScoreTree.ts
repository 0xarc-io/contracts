import MerkleTree from './MerkleTree';
import { utils } from 'ethers';
import { PassportScore } from '@arc-types/sapphireCore';

export class PasspotScoreTree {
  private readonly tree: MerkleTree;
  constructor(creditScores: PassportScore[]) {
    this.ensureUniqueAccounts(creditScores);
    this.tree = new MerkleTree(creditScores.map(PasspotScoreTree.toNode));
  }

  public static verifyProof(
    score: PassportScore,
    proof: string[],
    root: string,
  ): boolean {
    let pair = PasspotScoreTree.toNode(score);
    for (const item of proof) {
      pair = MerkleTree.combinedHash(pair, item);
    }

    return pair === root;
  }

  public static toNode(score: PassportScore): string {
    return utils.solidityKeccak256(
      ['address', 'string', 'uint256'],
      [score.account, score.protocol, score.score],
    );
  }

  public getHexRoot(): string {
    return this.tree.getHexRoot();
  }

  public getProof(score: PassportScore): string[] {
    return this.tree.getProof(PasspotScoreTree.toNode(score));
  }

  private ensureUniqueAccounts(creditScores: PassportScore[]) {
    creditScores.map((creditScore) => {
      const numberOfScoresPerAccount = creditScores.filter(
        ({ account }) => account === creditScore.account,
      ).length;
      if (numberOfScoresPerAccount > 1) {
        throw Error(`Credit score for ${creditScore.account} is not unique`);
      }
    });
  }
}

export default PasspotScoreTree;
