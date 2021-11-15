import { PassportScore } from '@arc-types/sapphireCore';
import { utils } from 'ethers';
import MerkleTree from './MerkleTree';

export class PassportScoreTree {
  private readonly tree: MerkleTree;
  constructor(creditScores: PassportScore[]) {
    this.ensureUniqueAccounts(creditScores);
    this.tree = new MerkleTree(creditScores.map(PassportScoreTree.toNode));
  }

  public static verifyProof(
    score: PassportScore,
    proof: string[],
    root: string,
  ): boolean {
    let pair = PassportScoreTree.toNode(score);
    for (const item of proof) {
      pair = MerkleTree.combinedHash(pair, item);
    }

    return pair === root;
  }

  public static toNode(score: PassportScore): string {
    return utils.solidityKeccak256(
      ['address', 'bytes32', 'uint256'],
      [score.account, score.protocol, score.score],
    );
  }

  public getHexRoot(): string {
    return this.tree.getHexRoot();
  }

  public getProof(score: PassportScore): string[] {
    return this.tree.getProof(PassportScoreTree.toNode(score));
  }

  /**
   * Ensure an account does not have multiple scores for the same protocol
   */
  private ensureUniqueAccounts(passportScores: PassportScore[]) {
    const uniqueMap = {}

    for(const score of passportScores) {
      const key = `${score.account}-${score.protocol}`;
      if(!uniqueMap[key]) {
       
        uniqueMap[key] = key // Value never used
      }else {
        throw Error(
          `There are more than 1 score for the protocol ${utils.parseBytes32String(
            score.protocol,
          )} for user ${score.account}`,
        );
      }
    }
  }
}
