import 'jest';

import { ethers, Wallet } from 'ethers';
import { expectRevert } from '@src/utils/expectRevert';

import ArcNumber from '@src/utils/ArcNumber';
import arcDescribe from '../arcDescribe';
import { ITestContext } from '../arcDescribe';
import initializeArc from '../initializeArc';
import ArcDecimal from '../../src/utils/ArcDecimal';
import { BigNumber } from 'ethers/utils';

let ownerWallet: Wallet;
let lenderWallet: Wallet;
let minterWallet: Wallet;
let reserveWallet: Wallet;

jest.setTimeout(30000);

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);
  await ctx.arc.oracle.setPrice(ArcDecimal.new(100));

  ownerWallet = ctx.wallets[0];
  lenderWallet = ctx.wallets[1];
  minterWallet = ctx.wallets[2];

  await ctx.arc._borrowSynthetic(ArcNumber.new(2), ArcNumber.new(400), minterWallet);
}

arcDescribe('Actions.withdraw()', init, (ctx: ITestContext) => {
  it('should not be able to withdraw 0', async () => {
    await expectRevert(ctx.arc.withdraw(ArcNumber.new(0), lenderWallet));
  });

  it('should not be able to withdraw more than they have deposited', async () => {
    await ctx.arc._supply(ArcNumber.new(1000), lenderWallet);
    await expectRevert(ctx.arc.withdraw(ArcNumber.new(1001), lenderWallet));
    await ctx.arc.withdraw(ArcNumber.new(1000), lenderWallet);
  });

  it('should be able to withdraw the amount deposited', async () => {
    await ctx.arc._supply(ArcNumber.new(1000), lenderWallet);
    await ctx.arc.withdraw(ArcNumber.new(1000), lenderWallet);
  });

  it.only('should be able withdraw the principal + interest accrued', async () => {
    await ctx.arc._supply(ArcNumber.new(1000), lenderWallet);
    const position = await ctx.arc._borrowStableShares(
      ArcNumber.new(50),
      ArcNumber.new(2),
      minterWallet,
    );

    await ctx.evm.increaseTime(60 * 60 * 24 * 365);
    await ctx.evm.mineBlock();
    await ctx.arc.state.updateIndex();

    const borrowIndex = await ctx.arc.state.getIndex();

    const BASE = new BigNumber(10).pow(18);
    const borrowBalance = borrowIndex.borrow
      .mul(position.updatedPosition.borrowedAmount.value)
      .div(BASE);

    await ctx.arc._repay(position.params.id, borrowBalance, ArcNumber.new(2), minterWallet);

    const withdrawAmount = ArcNumber.new(999).add(borrowBalance).sub(ArcNumber.new(50));

    await ctx.arc.withdraw(withdrawAmount, lenderWallet);
  });
});
