import { BigNumber, BigNumberish, Signer } from 'ethers';
import { asyncForEach } from '@src/utils/asyncForEach';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BaseErc20Factory, TestTokenFactory } from '@src/typings';
import { TransactionOverrides } from '../../arc-types/ethereum';

export default class Token {
  constructor() {}

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
    const contract = new BaseErc20Factory(owner).attach(token);
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
    const contract = new BaseErc20Factory(caller).attach(token);
    return await contract.transferFrom(from, to, value, overrides);
  }

  static async transfer(
    token: string,
    to: string,
    value: BigNumberish,
    caller: Signer,
    overrides: TransactionOverrides = {},
  ) {
    const contract = new BaseErc20Factory(caller).attach(token);
    return await contract.transfer(to, value, overrides);
  }
}
