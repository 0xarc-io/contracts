import { BigNumber } from 'ethers/utils';

export default class ArcNumber {
  static new(amount: number): BigNumber {
    return new BigNumber(10).pow(18).mul(amount);
  }
}
