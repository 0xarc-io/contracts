import 'module-alias/register';

import ArcNumber from '@src/utils/ArcNumber';
import Token from '@src/utils/Token';
import { expectRevert } from '@src/utils/expectRevert';
import ArcDecimal from '@src/utils/ArcDecimal';
import { AssetType } from '@src/types';
import { Account, getWaffleExpect } from '../../helpers/testingUtils';
import d2ArcDescribe, { initializeD2Arc } from '@test/helpers/d2ArcDescribe';
import { ITestContext } from '@test/helpers/d2ArcDescribe';
import { D2ArcOptions } from '../../helpers/d2ArcDescribe';
import { Operation } from '../../../src/types';
import { BigNumber } from 'ethers/utils';
import { UNDERCOLLATERALIZED_ERROR } from '../../helpers/contractErrors';

let ownerAccount: Account;
let minterAccount: Account;
let otherAccount: Account;

const COLLATERAL_AMOUNT = ArcNumber.new(100);
const BORROW_AMOUNT = ArcNumber.new(50);

async function init(ctx: ITestContext): Promise<void> {
  [ownerAccount, minterAccount, otherAccount] = ctx.accounts;

  const setupOptions = {
    oraclePrice: ArcDecimal.new(1).value,
    collateralRatio: ArcDecimal.new(2).value,
    initialCollateralBalances: [[minterAccount, COLLATERAL_AMOUNT]],
  } as D2ArcOptions;

  await initializeD2Arc(ctx, setupOptions);
}

const expect = getWaffleExpect();

d2ArcDescribe('D2Core.operateAction(Open)', init, (ctx: ITestContext) => {
  before(async () => {});

  it('should be be able to open at the exact c-ratio', async () => {
    const result = await ctx.arc.openPosition(
      COLLATERAL_AMOUNT,
      BORROW_AMOUNT,
      minterAccount.wallet,
    );

    expect(result.operation).to.equal(Operation.Open, 'Invalid operation emitted');
    expect(result.params.amountOne).to.equal(
      COLLATERAL_AMOUNT,
      'Invalid collateral amount emitted',
    );
    expect(result.params.amountTwo).to.equal(BORROW_AMOUNT, 'Invalid borrow amount emitted');
    expect(result.params.id).to.equal(new BigNumber(1));
    expect(result.updatedPosition.borrowedAmount).to.equal(BORROW_AMOUNT);
    expect(result.updatedPosition.collateralAmount).to.equal(COLLATERAL_AMOUNT);

    const position = await ctx.arc.synth().core.getPosition(0);
    expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT);
    expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT);
    expect(position.owner).to.equal(minterAccount.address);
  });

  it('should be able to open above the c-ratio', async () => {
    const result = await ctx.arc.openPosition(
      COLLATERAL_AMOUNT.mul(2),
      BORROW_AMOUNT,
      minterAccount.wallet,
    );

    const position = await ctx.arc.synth().core.getPosition(0);
    expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT);
    expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT.mul(2));
    expect(position.owner).to.equal(minterAccount.address);
  });

  it('should not be able to open below the required c-ratio', async () => {
    expect(
      await ctx.arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT.add(1), minterAccount.wallet),
    ).to.be.revertedWith(UNDERCOLLATERALIZED_ERROR);

    expect(
      await ctx.arc.openPosition(COLLATERAL_AMOUNT.sub(1), BORROW_AMOUNT, minterAccount.wallet),
    ).to.be.revertedWith(UNDERCOLLATERALIZED_ERROR);
  });
});
