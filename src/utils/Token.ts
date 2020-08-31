import { BigNumberish } from 'ethers/utils';
import { BaseERC20 } from '../typings/BaseERC20';
import { Signer } from 'ethers';
import { TransactionOverrides } from '../types';

export default class Token {
  constructor() {}

  static async approve(
    token: string,
    owner: Signer,
    to: string,
    value: BigNumberish,
    overrides: TransactionOverrides = {},
  ) {
    const contract = BaseERC20.at(owner, token);
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
    const contract = BaseERC20.at(caller, token);
    return await contract.transferFrom(from, to, value, overrides);
  }

  static async transfer(
    token: string,
    to: string,
    value: BigNumberish,
    caller: Signer,
    overrides: TransactionOverrides = {},
  ) {
    const contract = BaseERC20.at(caller, token);
    return await contract.transfer(to, value, overrides);
  }
}
