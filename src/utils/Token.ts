import { Signer } from 'ethers';
import { asyncForEach } from './asyncForEach';
import { BaseERC20Factory } from '../typings/BaseERC20Factory';
import { TestTokenFactory } from '../typings/TestTokenFactory';

import { TransactionOverrides } from '../../arc-types/ethereum';
import { BigNumberish } from '@ethersproject/bignumber';

export default class Token {

  static async approve(
    token: string,
    owner: Signer,
    to: string,
    value: BigNumberish,
    overrides: TransactionOverrides = {},
  ) {
    const contract = BaseERC20Factory.connect(token, owner);
    return await contract.approve(to, value, overrides);
  }

  static async transferFrom(
    token: string,
    from: string,
    to: string,
    value: BigNumberish,
    caller: Signer,
    overrides: TransactionOverrides = {},
  ) {
    const contract = BaseERC20Factory.connect(token, caller);
    return await contract.transferFrom(from, to, value, overrides);
  }

  static async transfer(
    token: string,
    to: string,
    value: BigNumberish,
    caller: Signer,
    overrides: TransactionOverrides = {},
  ) {
    const contract = BaseERC20Factory.connect(token, caller);
    return await contract.transfer(to, value, overrides);
  }
}
