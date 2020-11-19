import { BigNumber, BigNumberish } from 'ethers';
import { BASE } from '../constants';

export default class ArcNumber {
  static new(amount: number, decimals: BigNumberish = 18): BigNumber {
    return BigNumber.from(10).pow(decimals).mul(amount);
  }

  static bigMul(value1: BigNumber, value2: BigNumberish): BigNumber {
    return value1.mul(value2).div(BASE);
  }

  static bigDiv(value1: BigNumber, value2: BigNumberish): BigNumber {
    return value1.mul(BASE).div(value2);
  }
}
