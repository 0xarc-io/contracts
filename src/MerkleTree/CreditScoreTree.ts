import MerkleTree from './MerkleTree';
import { BigNumber, utils } from 'ethers';

export default class CreditScoreTree {
  private readonly tree: MerkleTree;
  constructor(creditScores: { account: string; amount: BigNumber }[]) {
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
    let pair = CreditScoreTree.toNode(account, amount );
    for (const item of proof) {
      pair = MerkleTree.combinedHash(pair, item);
    }

    return pair === root;
  }

  public static toNode(account: string, amount: BigNumber): string {
    return utils.solidityKeccak256(['address', 'uint256' ], [account, amount]);
  }

  public getHexRoot(): string {
    return this.tree.getHexRoot();
  }

  public getProof(account: string, amount: BigNumber): string[] {
    return this.tree.getProof(CreditScoreTree.toNode(account, amount));
  }
}
