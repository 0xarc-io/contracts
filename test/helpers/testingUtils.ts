// Buidler automatically injects the waffle version into chai
import chai from 'chai';

import { Wallet } from 'ethers';
import { EVM } from './EVM';
import { ethers } from '@nomiclabs/buidler';

// BUIDLER / WAFFLE
export const getWaffleExpect = (): Chai.ExpectStatic => {
  return chai.expect;
};

const provider = ethers.provider;
const evm = new EVM(provider);

export type Account = {
  address: string;
  wallet: Wallet;
};

export const getAccounts = async (): Promise<Account[]> => {
  const accounts: Account[] = [];

  const wallets = await getWallets();
  for (let i = 0; i < wallets.length; i++) {
    accounts.push({
      wallet: wallets[i],
      address: await wallets[i].getAddress(),
    });
  }

  return accounts;
};

export const getWallets = async (): Promise<Wallet[]> => {
  return (await ethers.signers()) as Wallet[];
};
