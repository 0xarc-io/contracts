import { Wallet, ethers } from 'ethers';
import { BigNumber } from 'ethers/utils';
import { Core } from '../typechain/Core';
import { StableShare } from '../typechain/StableShare';

const ZERO = new BigNumber(0);

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
    this.core = await Core.deploy(this.wallet, {
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

  async supply(caller: Wallet, amount: BigNumber) {
    const contract = await Core.at(caller, this.core.address);
    return await contract.supply(amount);
  }
}
