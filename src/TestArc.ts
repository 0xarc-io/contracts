import Arc from './Arc';
import { StableShare } from './typings/StableShare';
import { MockOracle } from './typings/MockOracle';
import { Wallet } from 'ethers';
import Token from './utils/Token';
import { BigNumberish } from 'ethers/utils';
import ArcDecimal from './utils/ArcDecimal';
import { PolynomialInterestSetter } from './typings/PolynomialInterestSetter';
import { AssetType } from './types';
import { Config } from './addresses';
import config from 'buidler.config';
import ArcNumber from './utils/ArcNumber';
import { defaultPolynomialInterestSetterParams, getConfig } from './addresses/Config';

export class TestArc extends Arc {
  static async init(wallet: Wallet): Promise<TestArc> {
    let arc = new TestArc();
    arc.wallet = wallet;
    return arc;
  }

  async deployTestArc() {
    this.stableShare = await StableShare.deploy(this.wallet);
    this.oracle = await MockOracle.deploy(this.wallet);
    this.interestModel = await PolynomialInterestSetter.deploy(
      this.wallet,
      defaultPolynomialInterestSetterParams,
    );

    const testConfig = getConfig(50);
    testConfig.name = 'ARCxBTC';
    testConfig.symbol = 'USDT-BTC';

    await this.deployArc(testConfig);
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

    return await this.repay(positionId, repayAmount, withdrawAmount, from);
  }
}
