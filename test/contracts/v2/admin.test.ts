import 'module-alias/register';

import ArcDecimal from '@src/utils/ArcDecimal';
import {
  Account,
  addSnapshotBeforeRestoreAfterEach,
  getWaffleExpect,
} from '../../helpers/testingUtils';
import { BigNumber } from 'ethers/utils';
import { ADMINABLE_ERROR, INTEREST_SETTER_ERROR } from '../../helpers/contractErrors';
import { getAccounts } from '../../helpers/testingUtils';
import { MockD2CoreV1 } from '@src/typings';
import { Signer } from 'ethers';
import { D2TestArc } from '../../../src/D2TestArc';
import { d2Setup, initializeD2Arc } from '@test/helpers/d2ArcDescribe';
import { TEN_PERCENT } from '../../../src/constants';
import { ITestContext } from '@test/helpers/d2ArcDescribe';
import ArcNumber from '../../../src/utils/ArcNumber';
import { D2ArcOptions } from '../../helpers/d2ArcDescribe';

let ownerAccount: Account;
let minterAccount: Account;
let otherAccount: Account;

const expect = getWaffleExpect();

const ctx: ITestContext = {};

const COLLATERAL_AMOUNT = ArcNumber.new(200);
const BORROW_AMOUNT = ArcNumber.new(50);

async function init(ctx: ITestContext): Promise<void> {
  [ownerAccount, minterAccount, otherAccount] = ctx.accounts;

  const setupOptions = {
    oraclePrice: ArcDecimal.new(1).value,
    collateralRatio: ArcDecimal.new(2).value,
    interestRate: TEN_PERCENT,
    initialCollateralBalances: [
      [minterAccount, COLLATERAL_AMOUNT.mul(5)],
      [otherAccount, COLLATERAL_AMOUNT.mul(5)],
    ],
  } as D2ArcOptions;

  await initializeD2Arc(ctx, setupOptions);
}

describe('D2Core.admin', () => {
  let ctx: ITestContext = {};

  before(async () => {
    ctx = await d2Setup(init);

    await ctx.arc.synth().collateral.mintShare(ctx.arc.coreAddress(), 100);
  });

  addSnapshotBeforeRestoreAfterEach();

  async function getCore(signer: Signer) {
    return await ctx.arc.getCore(ctx.arc.synth(), signer);
  }

  describe('#withdrawTokens', () => {
    it('should not be callable by any user', async () => {
      const contract = await getCore(otherAccount.signer);
      await expect(
        contract.withdrawTokens(ctx.arc.synth().collateral.address, otherAccount.address, 100),
      ).to.be.reverted;
    });

    it('should only be callable by the admin', async () => {
      const contract = await getCore(ownerAccount.signer);
      await contract.withdrawTokens(ctx.arc.synth().collateral.address, ownerAccount.address, 100);
    });
  });

  describe('#setPause', () => {
    it('should not be callable by any user', async () => {
      const contract = await getCore(otherAccount.signer);
      expect(await contract.paused()).to.be.false;
      await expect(contract.setPause(true)).to.be.reverted;
    });

    it('should only be callable by the admin', async () => {
      const contract = await getCore(ownerAccount.signer);
      expect(await contract.paused()).to.be.false;
      await contract.setPause(true);
      expect(await contract.paused()).to.be.true;
    });

    it('should not be able to execute any action once paused', async () => {
      const contract = await getCore(ownerAccount.signer);
      expect(await contract.paused()).to.be.false;

      await ctx.arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, minterAccount.signer);
      await contract.setPause(true);
      await expect(ctx.arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, minterAccount.signer)).to
        .be.reverted;
    });
  });
});
