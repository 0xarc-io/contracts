import { BigNumber } from 'ethers';
import hre from 'hardhat';

export function setAccountBalance(account: string, balance: BigNumber) {
  return hre.network.provider.send('hardhat_setBalance', [
    account,
    balance.toHexString().replace('0x0', '0x'),
  ]);
}
