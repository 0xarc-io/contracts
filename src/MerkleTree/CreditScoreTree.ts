import MerkleTree from './MerkleTree';
import { BigNumber, utils } from 'ethers';

export interface CreditScore {
  account: string;
  amount: BigNumber;
}

export class CreditScoreTree {
  private readonly tree: MerkleTree;
  constructor(creditScores: CreditScore[]) {
    this.ensureUniqueAccounts(creditScores);
    this.tree = new MerkleTree(
      creditScores.map(({ account, amount }) => {
        return CreditScoreTree.toNode(account, amount);
      }),
    );
  }

  public static verifyProof(
    account: string,
    amount: BigNumber,
    proof: string[],
    root: string,
  ): boolean {
    let pair = CreditScoreTree.toNode(account, amount);
    for (const item of proof) {
      pair = MerkleTree.combinedHash(pair, item);
    }

    return pair === root;
  }

  public static toNode(account: string, amount: BigNumber): string {
    return utils.solidityKeccak256(['address', 'uint256'], [account, amount]);
  }

  public getHexRoot(): string {
    return this.tree.getHexRoot();
  }

  public getProof(account: string, amount: BigNumber): string[] {
    return this.tree.getProof(CreditScoreTree.toNode(account, amount));
  }

  private ensureUniqueAccounts(
    creditScores: { account: string; amount: BigNumber }[],
  ) {
    creditScores.map((creditScore, idx, arr) => {
      const numberOfScoresPerAccount = creditScores.filter(
        ({ account }) => account === creditScore.account,
      ).length;
      if (numberOfScoresPerAccount > 1) {
        throw Error(`Credit score for ${creditScore.account} is not unique`);
      }
    });
  }
}

export default CreditScoreTree;
