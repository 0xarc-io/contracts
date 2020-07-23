import { BigNumberish } from 'ethers/utils';
import { BaseERC20 } from '../typings/BaseERC20';
import { Wallet } from 'ethers';

export default class Token {
  constructor() {}

  static async approve(token: string, owner: Wallet, to: string, value: BigNumberish) {
    const contract = BaseERC20.at(owner, token);
    return await contract.approve(to, value);
  }

  static async transferFrom(
    token: string,
    from: string,
    to: string,
    value: BigNumberish,
    caller: Wallet,
  ) {
    const contract = BaseERC20.at(caller, token);
    return await contract.transferFrom(from, to, value);
  }

  static async transfer(token: string, to: string, value: BigNumberish, caller: Wallet) {
    const contract = BaseERC20.at(caller, token);
    return await contract.transfer(to, value);
  }
}
