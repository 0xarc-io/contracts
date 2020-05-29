import { Wallet, ethers } from 'ethers';
import { BigNumber } from 'ethers/utils';
import { Core } from '../typechain/Core';
import { StableShare } from '../typechain/StableShare';

const ZERO = new BigNumber(0);
const BASE = new BigNumber(10).pow(18);

export default class Arc {
  public wallet: Wallet;

  public core: Core;
  public stableShare: StableShare;

  static async init(wallet: Wallet): Promise<Arc> {
    let arc = new Arc();
    arc.wallet = wallet;
    return arc;
  }

  async deployArc(stableShare: string) {
    this.core = await Core.deploy(this.wallet, 'Synthetic BTC', 'arcBTC', {
      collateralRatio: ZERO,
      syntheticRatio: ZERO,
      liquidationSpread: ZERO,
      originationFee: ZERO,
      interestSetter: ethers.constants.AddressZero,
      stableAsset: stableShare,
    });
  }

  async deployTestArc() {
    this.stableShare = await StableShare.deploy(this.wallet);
    await this.deployArc(this.stableShare.address);
  }

  async supply(amount: BigNumber, caller?: Wallet) {
    const contract = await this.getCore(caller);
    return await contract.supply(amount);
  }

  async withdraw(amount: BigNumber, caller?: Wallet) {
    const contract = await this.getCore(caller);
    return await contract.withdraw(amount);
  }

  async openPosition(
    collateralAsset: string,
    collateralAmount: BigNumber,
    borrowAmount: BigNumber,
    caller?: Wallet,
  ) {
    const contract = await this.getCore(caller);
    return contract.openPosition(collateralAsset, collateralAmount, borrowAmount);
  }

  private async getCore(caller?: Wallet) {
    return await Core.at(caller || this.wallet, this.core.address);
  }
}
