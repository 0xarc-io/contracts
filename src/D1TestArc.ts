import D1Arc from './D1Arc';

import { Wallet } from 'ethers';
import { MockOracle } from './typings/MockOracle';
import Token from './utils/Token';
import { BigNumberish, BigNumber } from 'ethers/utils';
import { AssetType, DeploymentConfig } from './types';

import { TestToken } from './typings';
import ArcDecimal from './utils/ArcDecimal';

export class D1TestArc extends D1Arc {
  static async init(wallet: Wallet): Promise<D1TestArc> {
    let arc = new D1TestArc();
    arc.wallet = wallet;
    return arc;
  }

  async deployTestArc() {
    this.collateralAsset = await TestToken.deploy(this.wallet, 'TEST', 'TEST');
    this.oracle = await MockOracle.deploy(this.wallet);

    const testConfig: DeploymentConfig = {
      owner: await this.wallet.getAddress(),
      name: 'LINKUSD',
      symbol: 'LINKUSD',
      collateralAsset: this.collateralAsset.address,
      oracle: this.oracle.address,
      collateralRatio: ArcDecimal.new(2).value,
      liquidationArcFee: ArcDecimal.new(0.1).value,
      liquidationUserFee: ArcDecimal.new(0.05).value,
      chainlinkAggregator: '',
      collateralLimit: '',
      syntheticAssetLimit: '',
      positionCollateralMinimum: '',
    };

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
