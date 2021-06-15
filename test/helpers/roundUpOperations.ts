import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { BASE } from '@src/constants';

export function roundUpDiv(a: BigNumber, b: BigNumberish) {
  return a
    .mul(BASE)
    .add(BigNumber.from(b).sub(1))
    .div(b)
}

export function roundUpMul(a: BigNumber, b: BigNumber) {
  return a.mul(b).add(BASE.add(1)).div(BASE);
}
