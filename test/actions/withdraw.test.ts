import 'jest';

import { generatedWallets } from '@utils/generatedWallets';
import { Blockchain } from '@src/utils/Blockchain';
import { ethers, Wallet } from 'ethers';
import { expectRevert } from '@src/utils/expectRevert';

import ArcNumber from '@src/utils/ArcNumber';
import { TestArc } from '../../src/TestArc';
import arcDescribe from '../arcDescribe';
import { ITestContext } from '../arcDescribe';
import initializeArc from 'test/initializeArc';
import ArcDecimal from '../../src/utils/ArcDecimal';

const provider = new ethers.providers.JsonRpcProvider();
const blockchain = new Blockchain(provider);

const TEN = ArcNumber.new(10);

let ownerWallet: Wallet;
let lenderWallet: Wallet;
let syntheticMinterWallet: Wallet;
let stableShareMinterWallet: Wallet;
let reserveWallet: Wallet;
let liquidatorWallet: Wallet;

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);
  await ctx.arc.oracle.setPrice(ArcDecimal.new(100));

  ownerWallet = ctx.wallets[0];
  lenderWallet = ctx.wallets[1];
  syntheticMinterWallet = ctx.wallets[2];
  stableShareMinterWallet = ctx.wallets[3];
  liquidatorWallet = ctx.wallets[4];

  await ctx.arc._borrowSynthetic(ArcNumber.new(2), ArcNumber.new(400), reserveWallet);
  await ctx.arc.stableShare.mintShare(reserveWallet.address, ArcNumber.new(1000));
}

arcDescribe('Actions.withdraw()', init, (ctx: ITestContext) => {
  const [ownerWallet, userWallet] = generatedWallets(provider);

  let arc: TestArc;

  beforeEach(async () => {
    await blockchain.resetAsync();
  });

  it('should not be able to withdraw 0', async () => {});

  it('should not be able to withdraw more than they have deposited', async () => {});

  it('should be able to withdraw the amount deposited', async () => {});

  it('should be able withdraw the principal + interest accrued', async () => {});

  it('should be able to withdraw a portion of the principal + interest accrued', async () => {});

  it('should be able to accrue the correct amount of interest after a portion is withdrawn', async () => {});
});
