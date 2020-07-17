import { Wallet } from 'ethers';
import { ITestContext } from '../arcDescribe';
import initializeArc from '../initializeArc';
import arcDescribe from '../arcDescribe';
import ArcDecimal from '../../src/utils/ArcDecimal';
import ArcNumber from '../../src/utils/ArcNumber';
import Token from '../../src/utils/Token';
import { BigNumberish } from 'ethers/utils';

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

jest.setTimeout(30000);

arcDescribe('#Actions.depositPosition()', init, (ctx: ITestContext) => {
  describe('#synthetic', () => {
    let positionId: BigNumberish;

    beforeEach(async () => {
      const result = await ctx.arc._borrowSynthetic(
        ArcNumber.new(1),
        ArcNumber.new(200),
        syntheticMinterWallet,
      );
      positionId = result.params.id;
    });

    it('should not be able to deposit an invalid position', async () => {});

    it('should not be able to deposit 0', async () => {});

    it('should not be able to deposit with an invalid asset', async () => {});

    it('should be able to deposit the synthetic to decrease the collateral ratio', async () => {});

    it('should be able to deposit liquidity to increase the collateral ratio', async () => {});
  });

  describe('#stable asset', () => {
    it('should not be able to deposit an invalid position', async () => {});

    it('should not be able to deposit 0', async () => {});

    it('should not be able to deposit with an invalid asset', async () => {});

    it('should be able to deposit the synthetic to decrease the collateral ratio', async () => {});

    it('should be able to deposit liquidity to increase the collateral ratio', async () => {});
  });
});
