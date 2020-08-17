import Arc from './Arc';

import { Wallet } from 'ethers';
import { MockOracle } from './typings/MockOracle';
import Token from './utils/Token';
import { BigNumberish, BigNumber } from 'ethers/utils';
import { AssetType } from './types';

import { getConfig } from './addresses/Config';
import { TestToken } from './typings';

export class TestArc extends Arc {
  static async init(wallet: Wallet): Promise<TestArc> {
    let arc = new TestArc();
    arc.wallet = wallet;
    return arc;
  }

  async deployTestArc() {
    this.collateralAsset = await TestToken.deploy(this.wallet, 'TEST', 'TEST');
    this.oracle = await MockOracle.deploy(this.wallet);

    const testConfig = getConfig(50);
    testConfig.name = 'ARCxBTC';
    testConfig.symbol = 'USDT-BTC';
    testConfig.collateralAsset = this.collateralAsset.address;
    testConfig.oracle = this.oracle.address;

    await this.deployArc(testConfig);
  }

  async _borrowSynthetic(
    amount: BigNumberish,
    collateral: BigNumberish,
    from: Wallet,
    positionId?: BigNumberish,
  ) {
    await Token.approve(this.collateralAsset.address, from, this.core.address, collateral, {});
    await this.collateralAsset.mintShare(from.address, collateral, {});

    if (!positionId) {
      return await this.openPosition(collateral, amount, from, {});
    } else {
      return await this.borrow(positionId!, AssetType.Collateral, collateral, amount, from, {});
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
      const market = await this.state.market();
      await this._borrowSynthetic(
        repayAmount,
        price.value
          .mul(repayAmount)
          .div(new BigNumber(10).pow(18))
          .mul(market.collateralRatio.value)
          .div(new BigNumber(10).pow(18)),
        from,
      );
      await Token.approve(this.syntheticAsset.address, from, this.core.address, repayAmount, {});
    }

    return await this.repay(positionId, repayAmount, withdrawAmount, from, {});
  }
}
