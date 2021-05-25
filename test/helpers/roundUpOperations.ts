import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { BASE } from '@src/constants';

export function roundUpDiv(numerator: BigNumber, denominator: BigNumberish) {
  const basedAmount = numerator.mul(BASE.mul(10));

  return basedAmount.div(denominator).add(5).div(10);
}

export function roundUpMul(a: BigNumber, b: BigNumber) {
  return a.mul(b).add(BASE).div(BASE);
}
