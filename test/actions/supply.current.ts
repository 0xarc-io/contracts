import 'jest';

import { generatedWallets } from '@utils/generatedWallets';
import arcDescribe from '../arcDescribe';
import { ITestContext } from '../arcDescribe';
import initializeArc from 'test/initializeArc';
import { Wallet } from 'ethers';

let ownerWallet: Wallet;
let lenderWallet: Wallet;
let borrowerWallet: Wallet;

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);
  ownerWallet = ctx.wallets[0];
  lenderWallet = ctx.wallets[1];
  borrowerWallet = ctx.wallets[2];
}

arcDescribe('Actions.supply()', init, (ctx: ITestContext) => {
  it('should not be able to supply 0', async () => {});

  it('should not be able to supply without enough funds', async () => {});

  it('should be able to supply', async () => {});

  it('should not accrue interest if there are no borrows', async () => {});

  it('should accrue the correct amount of interest after 1 minute', async () => {});

  it('should accrue the correct amount of interest after 1 hour', async () => {});

  it('should accrue the correct amount of interest after 1 day', async () => {});
});
