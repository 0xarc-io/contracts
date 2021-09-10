import MerkleTree from './MerkleTree';
import { utils } from 'ethers';
import { PassportScore } from '@arc-types/sapphireCore';
import _ from 'lodash';

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
      ['address', 'string', 'uint256'],
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
    const groupedScores = _.groupBy(passportScores, 'protocol');

    Object.keys(groupedScores).map((protocol) => {
      const scores = groupedScores[protocol];

      scores.map((passScore) => {
        const nbScoresSameProtocol = scores.filter(
          ({ account }) => account === passScore.account,
        ).length;

        if (nbScoresSameProtocol > 1) {
          throw Error(
            `There are more than 1 score for the protocol ${protocol} for user ${passScore.account}`,
          );
        }
      });
    });
  }
}
