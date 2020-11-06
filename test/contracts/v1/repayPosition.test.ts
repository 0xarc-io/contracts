import 'module-alias/register';

import { Wallet } from 'ethers';

import { ITestContext } from '@test/helpers/d1ArcDescribe';
import d1ArcDescribe from '@test/helpers/d1ArcDescribe';
import ArcDecimal from '@src/utils/ArcDecimal';
import ArcNumber from '@src/utils/ArcNumber';
import { BigNumberish } from 'ethers/utils';
import { expectRevert } from '@src/utils/expectRevert';
import { getWaffleExpect, Account } from '../../helpers/testingUtils';

let ownerAccount: Account;
let lenderAccount: Account;
let syntheticMinterAccount: Account;
let stableShareMinterAccount: Account;
let reserveAccount: Account;
let liquidatorAccount: Account;

async function init(ctx: ITestContext): Promise<void> {
  ownerAccount = ctx.accounts[0];
  lenderAccount = ctx.accounts[1];
  syntheticMinterAccount = ctx.accounts[2];
  stableShareMinterAccount = ctx.accounts[3];
  liquidatorAccount = ctx.accounts[4];
  reserveAccount = ctx.accounts[5];
}

const expect = getWaffleExpect();

d1ArcDescribe('#Actions.repayPosition()', init, (ctx: ITestContext) => {
  let positionId: BigNumberish;

  beforeEach(async () => {
    await ctx.arc.oracle.setPrice(ArcDecimal.new(400));
    const result = await ctx.arc._borrowSynthetic(
      ArcNumber.new(200),
      ArcNumber.new(1),
      syntheticMinterAccount.signer,
    );
    positionId = result.params.id;
  });

  it('should not be able to deposit someone elses position', async () => {
    await expectRevert(
      ctx.arc._repay(positionId, ArcDecimal.new(0.5).value, 0, reserveAccount.signer),
    );
  });

  it('should be able to repay the synthetic and withdraw an equal amount', async () => {
    await ctx.arc._repay(
      positionId,
      ArcNumber.new(100),
      ArcDecimal.new(0.5).value,
      syntheticMinterAccount.signer,
    );
  });

  it('should be able to deposit synthetic to increase the collateral ratio', async () => {
    await ctx.arc._repay(
      positionId,
      ArcNumber.new(100),
      ArcDecimal.new(0).value,
      syntheticMinterAccount.signer,
    );
  });

  it('should be able to repay synthetic then withdraw the excess', async () => {
    await ctx.arc._repay(
      positionId,
      ArcNumber.new(200),
      ArcDecimal.new(0).value,
      syntheticMinterAccount.signer,
    );

    await ctx.arc._repay(
      positionId,
      ArcNumber.new(0),
      ArcDecimal.new(1).value,
      syntheticMinterAccount.signer,
    );
  });

  it('should be able to repay if undercollateralised', async () => {
    await ctx.arc.oracle.setPrice(ArcDecimal.new(200));
    await ctx.arc._repay(
      positionId,
      ArcNumber.new(200),
      ArcNumber.new(0),
      syntheticMinterAccount.signer,
    );
  });

  it('should not be able to withdraw anything if undercollateralised', async () => {
    await ctx.arc.oracle.setPrice(ArcDecimal.new(200));
    await expectRevert(
      ctx.arc.repay(positionId, ArcNumber.new(0), ArcNumber.new(1), syntheticMinterAccount.signer),
    );
  });

  it('should not be able to withdraw more than it is allowed', async () => {
    await expectRevert(
      ctx.arc._repay(
        positionId,
        ArcNumber.new(0),
        ArcDecimal.new(0.0001).value,
        syntheticMinterAccount.signer,
      ),
    );
  });
});
