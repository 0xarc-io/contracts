import { Wallet } from 'ethers';
import { ITestContext } from '../arcDescribe';
import initializeArc from '../initializeArc';
import arcDescribe from '../arcDescribe';
import ArcDecimal from '../../src/utils/ArcDecimal';
import ArcNumber from '../../src/utils/ArcNumber';

let ownerWallet: Wallet;
let lenderWallet: Wallet;
let syntheticMinterWallet: Wallet;
let stableShareMinterWallet: Wallet;
let liquidatorWallet: Wallet;

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);
  await ctx.arc.oracle.setPrice(ArcDecimal.new(100));

  ownerWallet = ctx.wallets[0];
  lenderWallet = ctx.wallets[1];
  syntheticMinterWallet = ctx.wallets[2];
  stableShareMinterWallet = ctx.wallets[3];
  liquidatorWallet = ctx.wallets[4];
}

jest.setTimeout(30000);

arcDescribe('#Actions.borrowPosition()', init, (ctx: ITestContext) => {
  describe('synthetic', () => {
    beforeEach(async () => {
      await ctx.arc._borrowSynthetic(ArcNumber.new(1), ArcNumber.new(400), syntheticMinterWallet);
    });

    it('should not be able to borrow more than it is allowed', async () => {});

    it('should not be able to borrow on behalf of someone else');
    it('should be able to borrow more if it has collateral to be used');
    it('should be able to borrow more if the price decreases');
  });

  describe('stable shares', () => {
    it('should not be able to borrow more than it is allowed');
    it('should not be able to borrow on behalf of someone else');
    it('should be able to borrow more if the price increases');
  });
});
