import { Wallet } from 'ethers';
import { ITestContext } from '../arcDescribe';
import initializeArc from '../initializeArc';
import arcDescribe from '../arcDescribe';
import ArcDecimal from '../../src/utils/ArcDecimal';
import ArcNumber from '../../src/utils/ArcNumber';
import { BigNumberish } from 'ethers/utils';
import { expectRevert } from '../../src/utils/expectRevert';
import Token from '../../src/utils/Token';

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
  reserveWallet = ctx.wallets[5];
}

jest.setTimeout(30000);

arcDescribe('#Actions.repayPosition()', init, (ctx: ITestContext) => {
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

    it('should not be able to deposit someone elses position', async () => {
      await expectRevert(ctx.arc._repay(positionId, ArcDecimal.new(0.5).value, 0, reserveWallet));
    });

    it('should be able to deposit the synthetic and withdraw an equal amount', async () => {
      await ctx.arc._repay(
        positionId,
        ArcDecimal.new(0.5).value,
        ArcNumber.new(99),
        syntheticMinterWallet,
      );
    });

    it('should be able to deposit collateral to increase the collateral ratio', async () => {
      await ctx.arc._repay(
        positionId,
        ArcDecimal.new(0.5).value,
        ArcNumber.new(0),
        syntheticMinterWallet,
      );
    });

    it('should be able to deposit collateral then withdraw the excess', async () => {
      await ctx.arc._repay(
        positionId,
        ArcDecimal.new(0.5).value,
        ArcNumber.new(0),
        syntheticMinterWallet,
      );

      await ctx.arc._repay(
        positionId,
        ArcDecimal.new(0).value,
        ArcNumber.new(95),
        syntheticMinterWallet,
      );
    });

    it('should not be able to withdraw more than it is allowed', async () => {
      await expectRevert(
        ctx.arc._repay(
          positionId,
          ArcDecimal.new(0).value,
          ArcNumber.new(1),
          syntheticMinterWallet,
        ),
      );
    });
  });

  describe('#stable asset', () => {
    let positionId: BigNumberish;

    beforeEach(async () => {
      const syntheticResult = await ctx.arc._borrowSynthetic(
        ArcNumber.new(2),
        ArcNumber.new(1000),
        syntheticMinterWallet,
      );

      await Token.transfer(
        ctx.arc.synthetic.address,
        stableShareMinterWallet.address,
        ArcNumber.new(2),
        syntheticMinterWallet,
      );

      await ctx.arc._supply(ArcNumber.new(1000), lenderWallet);

      const stableResult = await ctx.arc._borrowStableShares(
        ArcNumber.new(99),
        ArcNumber.new(2),
        stableShareMinterWallet,
      );

      positionId = stableResult.params.id;
    });

    it('should not be able to deposit someone elses position', async () => {
      await expectRevert(
        ctx.arc._repay(
          positionId,
          ArcNumber.new(50),
          ArcDecimal.new(0.5).value,
          syntheticMinterWallet,
        ),
      );
    });

    it('should be able to pay back the stable share to increase the collateral ratio', async () => {
      await ctx.arc._repay(
        positionId,
        ArcNumber.new(50),
        ArcDecimal.new(0).value,
        stableShareMinterWallet,
      );
    });

    it('should be able to deposit and withdraw at the same time', async () => {
      await ctx.arc._repay(
        positionId,
        ArcNumber.new(50),
        ArcDecimal.new(0.49).value,
        stableShareMinterWallet,
      );
    });

    it('should be able to deposit then withdraw', async () => {
      await ctx.arc._repay(
        positionId,
        ArcNumber.new(50),
        ArcDecimal.new(0).value,
        stableShareMinterWallet,
      );
      await ctx.arc._repay(
        positionId,
        ArcNumber.new(0),
        ArcDecimal.new(0.49).value,
        stableShareMinterWallet,
      );
    });
  });
});
