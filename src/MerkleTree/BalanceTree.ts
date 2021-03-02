import MerkleTree from './MerkleTree';
import { BigNumber, utils } from 'ethers';

export class BalanceTree {
  private readonly tree: MerkleTree;
  constructor(balances: { account: string; amount: BigNumber }[]) {
    this.tree = new MerkleTree(
      balances.map(({ account, amount }, index) => {
        return BalanceTree.toNode(index, account, amount);
      }),
    );
  }

  public static verifyProof(
    index: number | BigNumber,
    account: string,
    amount: BigNumber,
    proof: string[],
    root: string,
  ): boolean {
    let pair = BalanceTree.toNode(index, account, amount);
    for (const item of proof) {
      pair = MerkleTree.combinedHash(pair, item);
    }

    return pair === root;
  }

  public static toNode(index: number | BigNumber, account: string, amount: BigNumber): string {
    return utils.solidityKeccak256(['uint256', 'address', 'uint256'], [index, account, amount]);
  }

  public getHexRoot(): string {
    return this.tree.getHexRoot();
  }

  public getProof(index: number | BigNumber, account: string, amount: BigNumber): string[] {
    return this.tree.getProof(BalanceTree.toNode(index, account, amount));
  }
}
