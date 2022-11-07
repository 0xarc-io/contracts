import { Signer } from 'ethers';
import hre from 'hardhat';

export async function impersonateAccount(account: string): Promise<Signer> {
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [account],
  });
  return hre.ethers.provider.getSigner(account);
}
