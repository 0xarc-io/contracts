import { Signer } from 'ethers';
import { BaseERC20__factory } from '../typings/BaseERC20__factory';

import { TransactionOverrides } from '../../arc-types/ethereum';
import { BigNumberish } from '@ethersproject/bignumber';

export class Token {
  static async approve(
    token: string,
    owner: Signer,
    to: string,
    value: BigNumberish,
    overrides: TransactionOverrides = {},
  ) {
    const contract = BaseERC20__factory.connect(token, owner);
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
    const contract = BaseERC20__factory.connect(token, caller);
    return await contract.transferFrom(from, to, value, overrides);
  }

  static async transfer(
    token: string,
    to: string,
    value: BigNumberish,
    caller: Signer,
    overrides: TransactionOverrides = {},
  ) {
    const contract = BaseERC20__factory.connect(token, caller);
    return await contract.transfer(to, value, overrides);
  }
}
