import Arc from './Arc';

import { Wallet } from 'ethers';
import { StableShare } from './typings/StableShare';
import { MockOracle } from './typings/MockOracle';
import Token from './utils/Token';
import { BigNumberish } from 'ethers/utils';
import { AssetType } from './types';

import { getConfig } from './addresses/Config';

export class TestArc extends Arc {
  static async init(wallet: Wallet): Promise<TestArc> {
    let arc = new TestArc();
    arc.wallet = wallet;
    return arc;
  }

  async deployTestArc() {
    this.collateralAsset = await StableShare.deploy(this.wallet);
    this.oracle = await MockOracle.deploy(this.wallet);

    const testConfig = getConfig(50);
    testConfig.name = 'ARCxBTC';
    testConfig.symbol = 'USDT-BTC';
    testConfig.stableShare = this.collateralAsset.address;
    testConfig.oracle = this.oracle.address;

    await this.deployArc(testConfig);
  }

  async _borrowSynthetic(
    amount: BigNumberish,
    collateral: BigNumberish,
    from: Wallet,
    positionId?: BigNumberish,
  ) {
    await Token.approve(this.syntheticAsset.address, from, this.core.address, collateral, {});
    await this.collateralAsset.mintShare(from.address, collateral, {});

    if (!positionId) {
      return await this.openPosition(AssetType.Collateral, collateral, amount, from, {});
    } else {
      return await this.borrow(positionId!, AssetType.Collateral, collateral, amount, from, {});
    }
  }

  async _borrowStableShares(
    amount: BigNumberish,
    collateral: BigNumberish,
    from: Wallet,
    positionId?: BigNumberish,
  ) {
    await Token.approve(this.syntheticAsset.address, from, this.core.address, collateral, {});

    if (!positionId) {
      return await this.openPosition(AssetType.Synthetic, collateral, amount, from, {});
    } else {
      return await this.borrow(positionId!, AssetType.Synthetic, collateral, amount, from, {});
    }
  }

  async _repay(
    positionId: BigNumberish,
    repayAmount: BigNumberish,
    withdrawAmount: BigNumberish,
    from: Wallet,
  ) {
    const position = await this.state.getPosition(positionId);

    if (position.borrowedAsset == AssetType.Collateral) {
      await this.collateralAsset.mintShare(from.address, repayAmount, {});
      await Token.approve(this.collateralAsset.address, from, this.core.address, repayAmount, {});
    } else if (position.borrowedAsset == AssetType.Synthetic) {
      const price = await this.oracle.fetchCurrentPrice();
      await this._borrowSynthetic(repayAmount, price.value.mul(repayAmount).mul(2), from);
      await Token.approve(this.syntheticAsset.address, from, this.core.address, repayAmount, {});
    }

    return await this.repay(positionId, repayAmount, withdrawAmount, from, {});
  }
}
