import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { IERC20Factory } from '../typings/IERC20Factory';

export function balanceOf(user: SignerWithAddress, tokenAddress: string): Promise<BigNumber> {
  const tokenContract = IERC20Factory.connect(tokenAddress, user);
  return tokenContract.balanceOf(user.address);
}
