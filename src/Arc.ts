import { Wallet, ethers } from 'ethers';
import { BigNumber, BigNumberish } from 'ethers/utils';
import { Core } from '../typechain/Core';
import { StableShare } from '../typechain/StableShare';
import { AddressZero } from 'ethers/constants';
import { MockOracle } from '../typechain/MockOracle';
import ArcDecimal from './utils/ArcDecimal';
import { SyntheticToken } from '../typechain/SyntheticToken';
import { LinearInterestRate } from '../typechain/LinearInterestRate';

const ZERO = new BigNumber(0);
const BASE = new BigNumber(10).pow(18);

export default class Arc {
  public wallet: Wallet;

  public core: Core;
  public synthetic: SyntheticToken;
  public stableShare: StableShare;
  public oracle: MockOracle;
  public interestModel: LinearInterestRate;

  static async init(wallet: Wallet): Promise<Arc> {
    let arc = new Arc();
    arc.wallet = wallet;
    return arc;
  }

  async deployArc(interestRateMOdel: string, stableShare: string, oracle: string) {
    this.core = await Core.deploy(this.wallet, 'Synthetic BTC', 'arcBTC', {
      collateralRatio: ArcDecimal.new(2),
      syntheticRatio: ArcDecimal.new(2),
      liquidationSpread: ArcDecimal.new(0),
      originationFee: ArcDecimal.new(0),
      maximumUtilisationRatio: ArcDecimal.new(0.5),
      interestRateModel: interestRateMOdel,
      stableAsset: stableShare,
      oracle: oracle,
    });

    const sythAddress = await this.core.synthetic();
    this.synthetic = await SyntheticToken.at(this.wallet, sythAddress);
  }

  async supply(amount: BigNumberish, caller?: Wallet) {
    const contract = await this.getCore(caller);
    return await contract.supply(amount);
  }

  async withdraw(amount: BigNumberish, caller?: Wallet) {
    const contract = await this.getCore(caller);
    return await contract.withdraw(amount);
  }

  async openPosition(collateralAsset: string, borrowAmount: BigNumberish, caller?: Wallet) {
    const contract = await this.getCore(caller);
    return contract.openPosition(collateralAsset, borrowAmount);
  }

  private async getCore(caller?: Wallet) {
    return await Core.at(caller || this.wallet, this.core.address);
  }
}
