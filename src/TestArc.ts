import Arc from './Arc';
import { StableShare } from '../typechain/StableShare';
import { MockOracle } from '../typechain/MockOracle';
import { Wallet } from 'ethers';

export class TestArc extends Arc {
  static async init(wallet: Wallet): Promise<TestArc> {
    let arc = new TestArc();
    arc.wallet = wallet;
    return arc;
  }

  async deployTestArc() {
    this.stableShare = await StableShare.deploy(this.wallet);
    this.oracle = await MockOracle.deploy(this.wallet);

    await this.deployArc(this.stableShare.address, this.oracle.address);
  }
}
