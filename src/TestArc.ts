import Arc from './Arc';
import { StableShare } from '../typechain/StableShare';
import { MockOracle } from '../typechain/MockOracle';
import { Wallet, ContractTransaction } from 'ethers';
import Token from './utils/Token';
import { BigNumberish } from 'ethers/utils';
import ArcDecimal from './utils/ArcDecimal';
import { PolynomialInterestSetter } from '../typechain/PolynomialInterestSetter';
import { AssetType, ActionOperated } from './types';
import { parseLogs } from './utils/parseLogs';
import { Actions } from '../typechain/Actions';
import { CoreV1 } from '../typechain/CoreV1';
import { ContractReceipt } from 'ethers/contract';

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
      maxAPR: ArcDecimal.new(1).value, // 100%
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
}
