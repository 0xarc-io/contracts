import 'jest';

import arcDescribe from '../arcDescribe';
import { ITestContext } from '../arcDescribe';
import initializeArc from '../initializeArc';
import { Wallet } from 'ethers';
import { expectRevert } from '../../src/utils/expectRevert';
import ArcNumber from '../../src/utils/ArcNumber';
import Token from '../../src/utils/Token';

let ownerWallet: Wallet;
let lenderWallet: Wallet;
let borrowerWallet: Wallet;

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);

  ownerWallet = ctx.wallets[0];
  lenderWallet = ctx.wallets[1];
  borrowerWallet = ctx.wallets[2];

  await ctx.arc.stableShare.mintShare(lenderWallet.address, ArcNumber.new(100));

  await Token.approve(
    ctx.arc.stableShare.address,
    lenderWallet,
    ctx.arc.core.address,
    ArcNumber.new(100),
  );
}

arcDescribe('Actions.supply()', init, (ctx: ITestContext) => {
  it('should not be able to supply 0', async () => {
    await expectRevert(ctx.arc.supply(ArcNumber.new(0), lenderWallet));
  });

  it('should not be able to supply without enough funds', async () => {
    await expectRevert(ctx.arc.supply(ArcNumber.new(101), lenderWallet));
  });

  it('should be able to supply', async () => {
    await ctx.arc.supply(ArcNumber.new(100), lenderWallet);

    const state = await ctx.arc.core.state();
    expect(state.totalPar.supply).toEqual(ArcNumber.new(100));
    expect(state.totalPar.borrow).toEqual(ArcNumber.new(0));
    expect(state.index.borrow).toEqual(ArcNumber.new(0));
    expect(state.index.supply).toEqual(ArcNumber.new(0));

    const balance = await ctx.arc.core.supplyBalances(lenderWallet.address);
    expect(balance.sign).toBeTruthy();
    expect(balance.value).toEqual(ArcNumber.new(100));
  });

  it('should not accrue interest if there are no borrows', async () => {
    const balance = await ctx.arc.core.supplyBalances(lenderWallet.address);
    expect(balance.value).toEqual(ArcNumber.new(0));
  });

  it('should accrue the correct amount of interest after 1 minute', async () => {});

  it('should accrue the correct amount of interest after 1 hour', async () => {});

  it('should accrue the correct amount of interest after 1 day', async () => {});
});
