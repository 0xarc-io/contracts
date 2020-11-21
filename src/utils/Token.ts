import { BigNumberish, Signer } from 'ethers';
import { asyncForEach } from './asyncForEach';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BaseERC20Factory } from '../typings/BaseERC20Factory';
import { TestTokenFactory } from '../typings/TestTokenFactory';

import { TransactionOverrides } from '../../arc-types/ethereum';

export default class Token {
  static async setStartingBalances(
    collateral: string,
    core: string,
    signers: SignerWithAddress[],
    balance: BigNumberish,
  ) {
    await asyncForEach(signers, async (signer) => {
      const testToken = await new TestTokenFactory(signer).attach(collateral);
      await testToken.mintShare(signer.address, balance);
      await Token.approve(collateral, signer, core, balance);
    });
  }

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
