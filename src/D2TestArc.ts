import { Wallet } from 'ethers';
import D2Arc from './D2Arc';

export class D2TestArc extends D2Arc {
  static async init(wallet: Wallet): Promise<D2TestArc> {
    let arc = new D2TestArc();
    arc.wallet = wallet;
    return arc;
  }

  async deployTestArc() {}
}
