import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { IERC20__factory } from '../typings';

export function balanceOf(
  user: SignerWithAddress,
  tokenAddress: string,
): Promise<BigNumber> {
  const tokenContract = IERC20__factory.connect(tokenAddress, user);
  return tokenContract.balanceOf(user.address);
}
