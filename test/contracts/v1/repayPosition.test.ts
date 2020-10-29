import 'module-alias/register';

import { Wallet } from 'ethers';
import { ITestContext } from '@test/helpers/d1ArcDescribe';
import d1ArcDescribe from '@test/helpers/d1ArcDescribe';
import ArcDecimal from '@src/utils/ArcDecimal';
import ArcNumber from '@src/utils/ArcNumber';
import { BigNumberish } from 'ethers/utils';
import { expectRevert } from '@src/utils/expectRevert';
import { getWaffleExpect } from '../../helpers/testingUtils';

let ownerWallet: Wallet;
let lenderWallet: Wallet;
let syntheticMinterWallet: Wallet;
let stableShareMinterWallet: Wallet;
let reserveWallet: Wallet;
let liquidatorWallet: Wallet;

async function init(ctx: ITestContext): Promise<void> {
  ownerWallet = ctx.accounts[0].wallet;
  lenderWallet = ctx.accounts[1].wallet;
  syntheticMinterWallet = ctx.accounts[2].wallet;
  stableShareMinterWallet = ctx.accounts[3].wallet;
  liquidatorWallet = ctx.accounts[4].wallet;
  reserveWallet = ctx.accounts[5].wallet;
}

const expect = getWaffleExpect();

d1ArcDescribe('#Actions.repayPosition()', init, (ctx: ITestContext) => {
  let positionId: BigNumberish;

  beforeEach(async () => {
    await ctx.arc.oracle.setPrice(ArcDecimal.new(400));
    const result = await ctx.arc._borrowSynthetic(
      ArcNumber.new(200),
      ArcNumber.new(1),
      syntheticMinterWallet,
    );
    positionId = result.params.id;
  });

  it('should not be able to deposit someone elses position', async () => {
    await expectRevert(ctx.arc._repay(positionId, ArcDecimal.new(0.5).value, 0, reserveWallet));
  });

  it('should be able to repay the synthetic and withdraw an equal amount', async () => {
    await ctx.arc._repay(
      positionId,
      ArcNumber.new(100),
      ArcDecimal.new(0.5).value,
      syntheticMinterWallet,
    );
  });

  it('should be able to deposit synthetic to increase the collateral ratio', async () => {
    await ctx.arc._repay(
      positionId,
      ArcNumber.new(100),
      ArcDecimal.new(0).value,
      syntheticMinterWallet,
    );
  });

  it('should be able to repay synthetic then withdraw the excess', async () => {
    await ctx.arc._repay(
      positionId,
      ArcNumber.new(200),
      ArcDecimal.new(0).value,
      syntheticMinterWallet,
    );

    await ctx.arc._repay(
      positionId,
      ArcNumber.new(0),
      ArcDecimal.new(1).value,
      syntheticMinterWallet,
    );
  });

  it('should be able to repay if undercollateralised', async () => {
    await ctx.arc.oracle.setPrice(ArcDecimal.new(200));
    await ctx.arc._repay(positionId, ArcNumber.new(200), ArcNumber.new(0), syntheticMinterWallet);
  });

  it('should not be able to withdraw anything if undercollateralised', async () => {
    await ctx.arc.oracle.setPrice(ArcDecimal.new(200));
    await expectRevert(
      ctx.arc.repay(positionId, ArcNumber.new(0), ArcNumber.new(1), syntheticMinterWallet),
    );
  });

  it('should not be able to withdraw more than it is allowed', async () => {
    await expectRevert(
      ctx.arc._repay(
        positionId,
        ArcNumber.new(0),
        ArcDecimal.new(0.0001).value,
        syntheticMinterWallet,
      ),
    );
  });
});
