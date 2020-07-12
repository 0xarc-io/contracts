import { Wallet, ethers } from 'ethers';
import { BigNumber, BigNumberish } from 'ethers/utils';
import { Core } from '../typechain/Core';
import { StableShare } from '../typechain/StableShare';
import { AddressZero } from 'ethers/constants';
import { MockOracle } from '../typechain/MockOracle';
import ArcDecimal from './utils/ArcDecimal';
import { SyntheticToken } from '../typechain/SyntheticToken';
import { PolynomialInterestSetter } from '../typechain/PolynomialInterestSetter';
import { AssetType, Operation, OperationParams } from './types';
import { Storage } from '../typechain/Storage';

const ZERO = new BigNumber(0);
const BASE = new BigNumber(10).pow(18);

export default class Arc {
  public wallet: Wallet;

  public core: Core;
  public synthetic: SyntheticToken;
  public stableShare: StableShare;
  public oracle: MockOracle;
  public interestModel: PolynomialInterestSetter;

  static async init(wallet: Wallet): Promise<Arc> {
    let arc = new Arc();
    arc.wallet = wallet;
    return arc;
  }

  async deployArc(interestSetter: string, stableShare: string, oracle: string) {
    this.core = await Core.deploy(this.wallet, 'Synthetic BTC', 'arcBTC', {
      stableAsset: stableShare,
      interestSetter: interestSetter,
      collateralRatio: ArcDecimal.new(2),
      syntheticRatio: ArcDecimal.new(2),
      liquidationSpread: ArcDecimal.new(0.1),
      originationFee: ArcDecimal.new(0.01),
      earningsRate: ArcDecimal.new(0.1),
      oracle: oracle,
    });

    const synthAddress = await this.core.getSynthetic();
    this.synthetic = await SyntheticToken.at(this.wallet, synthAddress);
  }

  async supply(amount: BigNumberish, caller?: Wallet) {
    const contract = await this.getCore(caller);
    return await contract.operate(Operation.Supply, {
      id: 0,
      assetOne: AssetType.Stable,
      amountOne: amount,
      assetTwo: '',
      amountTwo: 0,
    });
  }

  async withdraw(amount: BigNumberish, caller?: Wallet) {
    const contract = await this.getCore(caller);
    return await contract.operate(Operation.Withdraw, {
      id: 0,
      assetOne: AssetType.Stable,
      amountOne: amount,
      assetTwo: '',
      amountTwo: 0,
    });
  }

  async openPosition(
    collateralAsset: AssetType,
    collateralAmount: BigNumberish,
    borrowAmount: BigNumberish,
    caller?: Wallet,
  ) {
    const contract = await this.getCore(caller);
    return contract.operate(Operation.Open, {
      id: 0,
      assetOne: collateralAsset,
      amountOne: collateralAmount,
      assetTwo: '',
      amountTwo: borrowAmount,
    });
  }

  async liquidatePosition(positionId: number, caller?: Wallet) {
    const contract = await this.getCore(caller);
    return contract.operate(Operation.Liquidate, {
      id: positionId,
      assetOne: '',
      amountOne: 0,
      assetTwo: '',
      amountTwo: 0,
    } as OperationParams);
  }

  private async getCore(caller?: Wallet) {
    return await Core.at(caller || this.wallet, this.core.address);
  }
}
