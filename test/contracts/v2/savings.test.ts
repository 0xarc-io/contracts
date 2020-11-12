import 'module-alias/register';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';
import { d2Setup, initializeD2Arc } from '@test/helpers/d2ArcDescribe';

import {
  Account,
  addSnapshotBeforeRestoreAfterEach,
  getWaffleExpect,
} from '../../helpers/testingUtils';
import { ITestContext, D2ArcOptions } from '../../helpers/d2ArcDescribe';
import { TEN_PERCENT, BASE, ONE_YEAR_IN_SECONDS, MAX_UINT256 } from '../../../src/constants';
import { MockD2SavingsV1 } from '@src/typings';
import { Signer } from 'ethers';
import { BigNumber, BigNumberish } from 'ethers/utils';
import { Zero } from 'ethers/constants';
import Token from '../../../src/utils/Token';
import { update } from 'lodash';

const expect = getWaffleExpect();

let ownerAccount: Account;
let minterAccount: Account;
let otherAccount: Account;
let revenueAccount: Account;

let savings: MockD2SavingsV1;

const COLLATERAL_AMOUNT = ArcNumber.new(200);
const BORROW_AMOUNT = ArcNumber.new(50);

async function init(ctx: ITestContext): Promise<void> {
  [ownerAccount, minterAccount, otherAccount, revenueAccount] = ctx.accounts;

  const setupOptions = {
    oraclePrice: ArcDecimal.new(1).value,
    collateralRatio: ArcDecimal.new(2).value,
    interestRate: TEN_PERCENT,
    initialCollateralBalances: [
      [minterAccount, COLLATERAL_AMOUNT.mul(5)],
      [otherAccount, COLLATERAL_AMOUNT.mul(5)],
    ],
  } as D2ArcOptions;

  savings = await MockD2SavingsV1.deploy(
    ownerAccount.signer,
    ctx.arc.coreAddress(),
    ctx.arc.syntheticAddress(),
    revenueAccount.address,
    { value: 0 },
  );

  expect(await savings.synthetic()).to.equal(ctx.arc.syntheticAddress());
  expect(await savings.core()).to.equal(ctx.arc.coreAddress());
  expect(await savings.arcFee()).to.equal(0);
  expect(await savings.arcFeeDestination()).to.equal(revenueAccount.address);
  expect(await savings.fullyCollateralized()).to.be.true;

  await ctx.arc.synthetic().addMinter(savings.address, MAX_UINT256);

  await initializeD2Arc(ctx, setupOptions);
}

describe('D2SavingsV1', () => {
  let ctx: ITestContext = {};

  before(async () => {
    ctx = await d2Setup(init);

    // Open a position at 400% c-ratio
    await ctx.arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, minterAccount.signer);
  });

  addSnapshotBeforeRestoreAfterEach();

  async function getContract(signer: Signer) {
    return await MockD2SavingsV1.at(signer, savings.address);
  }

  async function updateTime(time: BigNumberish) {
    await savings.setCurrentTimestamp(time);
    await ctx.arc.updateTime(time);
  }

  async function updateOwnerIndex() {
    const contract = await getContract(ownerAccount.signer);
    await contract.updateIndex();
  }

  async function stake(amount: BigNumberish, signer: Signer = minterAccount.signer) {
    await Token.approve(ctx.arc.syntheticAddress(), signer, savings.address, amount);

    const contract = await getContract(signer);
    await contract.stake(amount);
  }

  describe('#setSavingsRate', () => {
    it('should not be settable by anyone', async () => {
      const contract = await getContract(otherAccount.signer);
      await expect(contract.setSavingsRate(5)).to.be.reverted;
    });

    it('should be settable by the admin', async () => {
      const contract = await getContract(ownerAccount.signer);
      await contract.setSavingsRate(5);
      expect(await contract.getSavingsRate()).to.equal(new BigNumber(5));
    });
  });

  describe('#setArcFee', () => {
    it('should not be settable by anyone', async () => {
      const contract = await getContract(otherAccount.signer);
      await expect(contract.setArcFee(revenueAccount.address, { value: 5 })).to.be.reverted;
    });

    it('should be settable by the admin', async () => {
      const contract = await getContract(ownerAccount.signer);
      await contract.setArcFee(revenueAccount.address, { value: 5 });
      expect(await contract.arcFee()).to.equal(new BigNumber(5));
      expect(await contract.arcFeeDestination()).to.equal(revenueAccount.address);
    });
  });

  describe('#setFullCollateralized', () => {
    it('should not be settable by anyone', async () => {
      const contract = await getContract(otherAccount.signer);
      await expect(contract.setSavingsRate(5)).to.be.reverted;
    });

    it('should be settable by the admin', async () => {
      const contract = await getContract(ownerAccount.signer);
      await contract.setSavingsRate(5);
      expect(await contract.getSavingsRate()).to.equal(new BigNumber(5));
    });
  });

  describe('#setPaused', () => {
    it('should not be settable by anyone', async () => {
      const contract = await getContract(otherAccount.signer);
      await expect(contract.setPaused(true)).to.be.reverted;
    });

    it('should be settable by the admin', async () => {
      const contract = await getContract(ownerAccount.signer);
      await contract.setPaused(true);
      expect(await contract.paused()).to.be.true;
    });

    it('should not be able to call any function if pause', async () => {
      await updateOwnerIndex();
      await savings.setPaused(true);
      await expect(stake(BORROW_AMOUNT)).to.be.reverted;
      await expect(savings.updateIndex()).to.be.reverted;
    });
  });

  describe('#updateIndex', () => {
    beforeEach(async () => {
      await savings.setSavingsRate(TEN_PERCENT);
      await savings.setFullyCollateralized(true);
    });

    it('should not be able to update the first index by anyone else', async () => {
      const contract = await getContract(otherAccount.signer);
      await expect(contract.updateIndex()).to.be.reverted;
    });

    it('the first update index is only callable by the owner', async () => {
      await updateOwnerIndex();
      expect(await savings.exchangeRate()).to.equal(BASE);
      expect(await savings.totalSupplied()).to.equal(Zero);
      expect(await savings.indexLastUpdate()).to.equal(Zero);
    });

    it('should be callabe by anyone', async () => {
      await updateOwnerIndex();
      await savings.updateIndex();
    });

    it('should update the index based on the increased debt issuance & mint more', async () => {
      await updateOwnerIndex();

      // Stake the whole borrow amount
      await stake(BORROW_AMOUNT);

      // Update to the future with a ~10% APY savings rate
      await updateTime(ONE_YEAR_IN_SECONDS);
      await ctx.arc.core().updateIndex();

      expect(await savings.savingsIndex()).to.equal(BASE);
      const beforeSupply = await ctx.arc.synthetic().totalSupply();
      await savings.updateIndex();
      const afterSupply = await ctx.arc.synthetic().totalSupply();

      const coreBorrowIndex = (await ctx.arc.core().getBorrowIndex())[0];
      expect(await savings.savingsIndex()).to.equal(coreBorrowIndex);
      expect(afterSupply).to.equal(coreBorrowIndex.bigMul(BORROW_AMOUNT));

      // The newly minted synth should go straight to this contract
      const savingsBalance = coreBorrowIndex.bigMul(BORROW_AMOUNT);
      expect(await ctx.arc.synthetic().balanceOf(savings.address)).to.equal(savingsBalance);

      const issuedAmount = await ctx.arc.synthetic().getMinterIssued(savings.address);
      expect(issuedAmount.value).to.equal(BORROW_AMOUNT.bigMul(coreBorrowIndex).sub(BORROW_AMOUNT));
    });

    it('should calculate the correct index if someone deposits more funds', async () => {
      await updateOwnerIndex();

      // Stake the whole borrow amount
      await stake(BORROW_AMOUNT);

      // Update to the future with a ~10% APY savings rate
      await updateTime(ONE_YEAR_IN_SECONDS);
      await ctx.arc.core().updateIndex();
      await savings.updateIndex();

      const savingsIndex = await savings.savingsIndex();

      // User mints more debt to stake,
      await ctx.arc.borrow(0, COLLATERAL_AMOUNT, BORROW_AMOUNT, minterAccount.signer);
      await stake(BORROW_AMOUNT, minterAccount.signer);

      expect(await savings.balanceOf(minterAccount.address)).to.equal(
        BORROW_AMOUNT.add(BORROW_AMOUNT.bigDiv(savingsIndex)),
      );
    });

    it('should calculate the correct index if someone withdraws funds', async () => {
      await updateOwnerIndex();

      // Stake the whole borrow amount
      await stake(BORROW_AMOUNT);

      // Update to the future with a ~10% APY savings rate
      await updateTime(ONE_YEAR_IN_SECONDS);
      await ctx.arc.core().updateIndex();
      await savings.updateIndex();

      const savingsIndex = await savings.savingsIndex();

      const contract = await getContract(minterAccount.signer);
      const preSynthBalance = await ctx.arc.synthetic().balanceOf(minterAccount.address);
      const preSavingsBalance = await savings.balanceOf(minterAccount.address);
      await contract.unstake(BORROW_AMOUNT);

      const postSynthBalance = await ctx.arc.synthetic().balanceOf(minterAccount.address);
      const postSavingsBalance = await savings.balanceOf(minterAccount.address);
      expect(postSynthBalance).to.equal(preSynthBalance.add(BORROW_AMOUNT));
      expect(postSavingsBalance).to.equal(
        preSavingsBalance.sub(BORROW_AMOUNT.bigDiv(savingsIndex)),
      );
    });

    it('should not be able to update beyond the debt hard cap (if fully collateralized)', async () => {
      await updateOwnerIndex();

      // Stake half the borrow amount
      await stake(BORROW_AMOUNT.div(2));

      // Update to the future with a ~10% APY savings rate
      await updateTime(ONE_YEAR_IN_SECONDS);
      await ctx.arc.core().updateIndex();
      await savings.updateIndex();

      await savings.setSavingsRate(TEN_PERCENT.mul(3));

      // Update to the future by another year
      await updateTime(ONE_YEAR_IN_SECONDS.mul(2));
      await ctx.arc.core().updateIndex();
      await savings.updateIndex();

      // Update to the future by another year
      await updateTime(ONE_YEAR_IN_SECONDS.mul(3));
      await ctx.arc.core().updateIndex();
      await expect(savings.updateIndex()).to.be.reverted;
    });

    it('should not be able to update beyond the debt hard cap (if not fully collateralized)', async () => {
      await updateOwnerIndex();
      await savings.setFullyCollateralized(false);

      // Stake half the borrow amount
      await stake(BORROW_AMOUNT.div(2));

      // Update to the future with a ~10% APY savings rate
      await updateTime(ONE_YEAR_IN_SECONDS);
      await ctx.arc.core().updateIndex();
      await savings.updateIndex();

      await savings.setSavingsRate(TEN_PERCENT.mul(3));

      // Update to the future by another year
      await updateTime(ONE_YEAR_IN_SECONDS.mul(2));
      await ctx.arc.core().updateIndex();
      await savings.updateIndex();

      // Update to the future by another year
      await updateTime(ONE_YEAR_IN_SECONDS.mul(3));
      await ctx.arc.core().updateIndex();
      await savings.updateIndex();
    });
  });
});
