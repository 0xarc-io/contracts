import Arc from './Arc';
import { StableShare } from '../typechain/StableShare';
import { MockOracle } from '../typechain/MockOracle';
import { Wallet } from 'ethers';
import Token from './utils/Token';
import { BigNumberish } from 'ethers/utils';
import ArcDecimal from './utils/ArcDecimal';
import { PolynomialInterestSetter } from '../typechain/PolynomialInterestSetter';
import { AssetType } from './types';

export class TestArc extends Arc {
  static async init(wallet: Wallet): Promise<TestArc> {
    let arc = new TestArc();
    arc.wallet = wallet;
    return arc;
  }

  async deployTestArc() {
    this.stableShare = await StableShare.deploy(this.wallet);
    this.oracle = await MockOracle.deploy(this.wallet);
    this.interestModel = await PolynomialInterestSetter.deploy(this.wallet, {
      maxAPR: ArcDecimal.new(0.5).value, // 100%
      coefficients: [0, 10, 10, 0, 0, 80],
    });
    await this.deployArc(this.interestModel.address, this.stableShare.address, this.oracle.address);
  }

  async _supply(amount: BigNumberish, from: Wallet) {
    await Token.approve(this.stableShare.address, from, this.core.address, amount);
    await this.stableShare.mintShare(from.address, amount);

    return await this.supply(amount, from);
  }

  async _borrowSynthetic(
    amount: BigNumberish,
    collateral: BigNumberish,
    from: Wallet,
    positionId?: BigNumberish,
  ) {
    await Token.approve(this.stableShare.address, from, this.core.address, collateral);
    await this.stableShare.mintShare(from.address, collateral);

    if (!positionId) {
      return await this.openPosition(AssetType.Stable, collateral, amount, from);
    } else {
      return await this.borrow(positionId!, AssetType.Stable, collateral, amount, from);
    }
  }

  async _borrowStableShares(
    amount: BigNumberish,
    collateral: BigNumberish,
    from: Wallet,
    positionId?: BigNumberish,
  ) {
    await Token.approve(this.synthetic.address, from, this.core.address, collateral);

    if (!positionId) {
      return await this.openPosition(AssetType.Synthetic, collateral, amount, from);
    } else {
      return await this.borrow(positionId!, AssetType.Synthetic, collateral, amount, from);
    }
  }

  async _repay(
    positionId: BigNumberish,
    repayAmount: BigNumberish,
    withdrawAmount: BigNumberish,
    from: Wallet,
  ) {
    const position = await this.state.getPosition(positionId);

    if (position.borrowedAsset == AssetType.Stable) {
      await this.stableShare.mintShare(from.address, repayAmount);
      await Token.approve(this.stableShare.address, from, this.core.address, repayAmount);
    } else if (position.borrowedAsset == AssetType.Synthetic) {
      const price = await this.oracle.fetchCurrentPrice();
      await this._borrowSynthetic(repayAmount, price.value.mul(repayAmount).mul(2), from);
      await Token.approve(this.synthetic.address, from, this.core.address, repayAmount);
    }

    console.log('gonna repay' + repayAmount.toString());

    return await this.repay(positionId, repayAmount, withdrawAmount, from);
  }
}
