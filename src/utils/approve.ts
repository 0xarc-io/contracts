import { TransactionOverrides } from '@arc-types/ethereum';
import { IERC20__factory } from '../typings';
import { BigNumberish, Signer } from 'ethers';

export async function approve(
  amount: BigNumberish,
  ierc20address: string,
  spender: string,
  signer: Signer,
  overrides: TransactionOverrides = {},
) {
  const ierc20Contract = IERC20__factory.connect(ierc20address, signer);
  const existingAllowance = await ierc20Contract.allowance(
    await signer.getAddress(),
    spender,
  );

  if (existingAllowance.gte(amount)) {
    return;
  }

  const tx = await ierc20Contract.approve(spender, amount, overrides);
  return tx.wait();
}
