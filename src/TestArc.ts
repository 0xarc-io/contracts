import Arc from './Arc';
import { StableShare } from '../typechain/StableShare';
import { MockOracle } from '../typechain/MockOracle';
import { Wallet } from 'ethers';
import Token from './utils/Token';
import ArcNumber from './utils/ArcNumber';
import { BigNumberish } from 'ethers/utils';
import { LinearInterestRate } from '../typechain/LinearInterestRate';
import ArcDecimal from './utils/ArcDecimal';

export class TestArc extends Arc {
  static async init(wallet: Wallet): Promise<TestArc> {
    let arc = new TestArc();
    arc.wallet = wallet;
    return arc;
  }

  async deployTestArc() {
    this.stableShare = await StableShare.deploy(this.wallet);
    this.oracle = await MockOracle.deploy(this.wallet);
    this.interestModel = await LinearInterestRate.deploy(
      this.wallet,
      ArcDecimal.new(0.02),
      ArcDecimal.new(0.46),
      ArcDecimal.new(0.25),
    );
    await this.deployArc(this.interestModel.address, this.stableShare.address, this.oracle.address);
  }

  async sucessfullySupply(amount: BigNumberish, from: Wallet) {
    await Token.approve(this.stableShare.address, from, this.core.address, amount);
    await this.stableShare.mintShare(from.address, amount);
    await this.supply(amount, from);
  }

  async sucessfullyMintSynthetic(amount: BigNumberish, collateral: BigNumberish, from: Wallet) {
    await Token.approve(this.stableShare.address, from, this.core.address, collateral);
    await this.stableShare.mintShare(from.address, collateral);
    await this.openPosition(this.stableShare.address, amount, from);
  }

  async sucessfullyBorrowStableShares(
    amount: BigNumberish,
    collateral: BigNumberish,
    from: Wallet,
  ) {
    await Token.approve(this.synthetic.address, from, this.core.address, collateral);

    await this.openPosition(this.synthetic.address, amount, from);
  }
}
