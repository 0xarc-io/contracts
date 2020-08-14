import 'jest';

import { ethers, Wallet } from 'ethers';
import { expectRevert } from '@src/utils/expectRevert';

import ArcNumber from '@src/utils/ArcNumber';
import arcDescribe from './helpers/arcDescribe';
import { ITestContext } from './helpers/arcDescribe';
import initializeArc from './helpers/initializeArc';
import { StateV1 } from '@src/typings';
import { AddressZero } from 'ethers/constants';
import ArcDecimal from '../dist/src/utils/ArcDecimal';
import { BigNumber } from 'ethers/utils';

let ownerWallet: Wallet;
let otherWallet: Wallet;

jest.setTimeout(30000);

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);
  await ctx.arc.oracle.setPrice(ArcDecimal.new(100));

  await ctx.arc.state.setMarketParams({
    collateralRatio: { value: ArcNumber.new(2) },
    liquidationUserFee: { value: ArcDecimal.new(0.05).value },
    liquidationArcFee: { value: ArcDecimal.new(0.05).value },
    interestRate: { value: '1585489599' },
  });

  ownerWallet = ctx.wallets[0];
  otherWallet = ctx.wallets[1];
}

arcDescribe('Arc', init, (ctx: ITestContext) => {
  describe('#init', () => {
    it('cannot call init if already called', async () => {
      const stateAddress = await ctx.arc.core.state();
      expect(stateAddress).not.toEqual(AddressZero);
      await expectRevert(ctx.arc.core.init(AddressZero));
    });
  });

  describe('#claimFees', () => {
    it.only('can claim fees', async () => {
      const core = await ctx.arc.getCore(ownerWallet);

      const params = await ctx.arc._borrowSynthetic(
        ArcNumber.new(1),
        ArcNumber.new(200),
        ownerWallet,
      );

      await ctx.evm.increaseTime(60 * 60 * 24 * 365);
      await ctx.evm.mineBlock();
      await ctx.arc.state.updateIndex();

      await ctx.arc._repay(params.params.id, ArcNumber.new(1), ArcNumber.new(210), ownerWallet);

      const preBalance = await ctx.arc.collateralAsset.balanceOf(ctx.arc.core.address);
      expect(preBalance).toEqual(ArcNumber.new(0));

      await core.claimFees();

      const postBalance = await ctx.arc.collateralAsset.balanceOf(ctx.arc.core.address);
      expect(postBalance.gt(ArcNumber.new(10))).toBeTruthy();
    });
  });

  describe('#withdrawTokens', () => {
    it('cannot withdraw as a non-admin', async () => {});

    it('cannot withdraw depositors funds', async () => {});

    it('can withdraw any other tokens', async () => {});
  });
});
