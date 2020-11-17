import 'module-alias/register';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';
import {
  Account,
  addSnapshotBeforeRestoreAfterEach,
  getWaffleExpect,
} from '../../helpers/testingUtils';

import { d2Setup, initializeD2Arc } from '@test/helpers/d2ArcDescribe';
import { ITestContext } from '@test/helpers/d2ArcDescribe';
import { D2ArcOptions } from '../../helpers/d2ArcDescribe';
import { BigNumber, BigNumberish } from 'ethers/utils';
import { TEN_PERCENT, ONE_YEAR_IN_SECONDS, BASE } from '../../../src/constants';
import { Signer } from 'ethers';
import Token from '../../../dist/src/utils/Token';

let ownerAccount: Account;
let minterAccount: Account;
let globalOperatorAccount: Account;
let localOperatorAccount: Account;
let otherAccount: Account;

const COLLATERAL_AMOUNT = ArcNumber.new(100);
const BORROW_AMOUNT = ArcNumber.new(50);

const ctx: ITestContext = {};

async function init(ctx: ITestContext): Promise<void> {
  [
    ownerAccount,
    minterAccount,
    globalOperatorAccount,
    localOperatorAccount,
    otherAccount,
  ] = ctx.accounts;

  const setupOptions = {
    oraclePrice: ArcDecimal.new(1).value,
    collateralRatio: ArcDecimal.new(2).value,
    interestRate: TEN_PERCENT,
    initialCollateralBalances: [[minterAccount, COLLATERAL_AMOUNT.mul(5)]],
  } as D2ArcOptions;

  await initializeD2Arc(ctx, setupOptions);
}

const expect = getWaffleExpect();

describe('D2Core.ownership', () => {
  let ctx: ITestContext = {};

  before(async () => {
    ctx = await d2Setup(init);
  });

  async function getCore(account: Account) {
    return ctx.arc.getCore(ctx.arc.synth(), account.signer);
  }

  addSnapshotBeforeRestoreAfterEach();

  describe('#setGlobalOperator', () => {
    it('should not be able to set as a non-admin', async () => {
      await expect(
        ctx.arc.setGlobalOperatorStatus(globalOperatorAccount.address, true, otherAccount.signer),
      ).to.be.reverted;
    });

    it('should be able to set as an admin', async () => {
      await expect(
        ctx.arc.setGlobalOperatorStatus(globalOperatorAccount.address, true, ownerAccount.signer),
      )
        .to.be.emit(ctx.arc.core(), 'GlobalOperatorSet')
        .withArgs(globalOperatorAccount.address, true);
      expect(await ctx.arc.core().isGlobalOperator(globalOperatorAccount.address)).to.be.true;
    });

    it('should be able to remove as an admin', async () => {
      await ctx.arc.setGlobalOperatorStatus(
        globalOperatorAccount.address,
        true,
        ownerAccount.signer,
      );
      expect(await ctx.arc.core().isGlobalOperator(globalOperatorAccount.address)).to.be.true;
      await expect(
        ctx.arc.setGlobalOperatorStatus(globalOperatorAccount.address, false, ownerAccount.signer),
      )
        .to.be.emit(ctx.arc.core(), 'GlobalOperatorSet')
        .withArgs(globalOperatorAccount.address, false);
      expect(await ctx.arc.core().isGlobalOperator(globalOperatorAccount.address)).to.be.false;
    });

    it('should not be able to set as a global operator', async () => {
      await ctx.arc.setGlobalOperatorStatus(
        globalOperatorAccount.address,
        true,
        ownerAccount.signer,
      );
      await expect(
        ctx.arc.setGlobalOperatorStatus(otherAccount.address, true, globalOperatorAccount.signer),
      ).to.be.reverted;
    });

    it('should be able to borrow & repay as a global operator', async () => {
      await ctx.arc.openPosition(COLLATERAL_AMOUNT.mul(2), BORROW_AMOUNT, minterAccount.signer);
      await ctx.arc.setGlobalOperatorStatus(
        globalOperatorAccount.address,
        true,
        ownerAccount.signer,
      );

      expect(await ctx.arc.synthetic().balanceOf(globalOperatorAccount.address)).to.equal(0);

      await ctx.arc.borrow(0, 0, BORROW_AMOUNT, globalOperatorAccount.signer);

      expect(await ctx.arc.synthetic().balanceOf(globalOperatorAccount.address)).to.equal(
        BORROW_AMOUNT,
      );

      await ctx.arc.repay(0, BORROW_AMOUNT, 0, globalOperatorAccount.signer);

      expect(await ctx.arc.synthetic().balanceOf(globalOperatorAccount.address)).to.equal(0);

      await Token.transfer(
        ctx.arc.syntheticAddress(),
        globalOperatorAccount.address,
        BORROW_AMOUNT,
        minterAccount.signer,
      );

      await ctx.arc.repay(0, BORROW_AMOUNT, COLLATERAL_AMOUNT.mul(2), globalOperatorAccount.signer);

      expect(await ctx.arc.synth().collateral.balanceOf(globalOperatorAccount.address)).to.equal(
        COLLATERAL_AMOUNT.mul(2),
      );
    });
  });

  describe('#transferOwnership', () => {
    let currentPosition: BigNumberish;

    beforeEach(async () => {
      await ctx.arc.setGlobalOperatorStatus(globalOperatorAccount.address, true);
      const result = await ctx.arc.openPosition(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        minterAccount.signer,
      );
      currentPosition = result.params.id;
    });

    it('should not be able to transfer ownership as a non-owner', async () => {
      await expect(
        ctx.arc.transferOwnership(currentPosition, otherAccount.address, otherAccount.signer),
      ).to.be.reverted;
    });

    it('should not be able to transfer ownership as an operator', async () => {
      await expect(
        ctx.arc.transferOwnership(
          currentPosition,
          otherAccount.address,
          globalOperatorAccount.signer,
        ),
      ).to.be.reverted;
    });

    it('should be able to transfer ownership as the owner', async () => {
      await ctx.arc.transferOwnership(currentPosition, otherAccount.address, minterAccount.signer);
      const position = await ctx.arc.getPosition(currentPosition);
      expect(position.owner).to.equal(otherAccount.address);

      // ensure that the original owner can't do shiet
    });
  });

  describe('#setPositionOperatorStatus', () => {
    let currentPosition: BigNumberish;

    beforeEach(async () => {
      await ctx.arc.setGlobalOperatorStatus(globalOperatorAccount.address, true);

      const result = await ctx.arc.openPosition(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        minterAccount.signer,
      );
      currentPosition = result.params.id;
    });

    it('should not be able to set authorized position operator as a non-owner', async () => {
      const otherContract = await getCore(otherAccount);
      await expect(
        otherContract.setPositionOperatorStatus(currentPosition, otherContract.address, true),
      ).to.be.reverted;
    });

    it('should be able to set an authorized position operator as the global operator', async () => {
      const globalOperatorContract = await getCore(globalOperatorAccount);
      await expect(
        globalOperatorContract.setPositionOperatorStatus(
          currentPosition,
          localOperatorAccount.address,
          true,
        ),
      )
        .to.emit(globalOperatorContract, 'PositionOperatorSet')
        .withArgs(currentPosition, localOperatorAccount.address, true);

      expect(
        await globalOperatorContract.isPositionOperator(
          currentPosition,
          localOperatorAccount.address,
        ),
      ).to.be.true;
    });

    it('should be able to remove an authorized position operator as the global operator', async () => {
      const globalOperatorContract = await getCore(globalOperatorAccount);
      await expect(
        globalOperatorContract.setPositionOperatorStatus(
          currentPosition,
          localOperatorAccount.address,
          true,
        ),
      )
        .to.emit(globalOperatorContract, 'PositionOperatorSet')
        .withArgs(currentPosition, localOperatorAccount.address, true);

      expect(
        await globalOperatorContract.isPositionOperator(
          currentPosition,
          localOperatorAccount.address,
        ),
      ).to.be.true;

      await expect(
        globalOperatorContract.setPositionOperatorStatus(
          currentPosition,
          localOperatorAccount.address,
          false,
        ),
      )
        .to.emit(globalOperatorContract, 'PositionOperatorSet')
        .withArgs(currentPosition, localOperatorAccount.address, false);

      expect(
        await globalOperatorContract.isPositionOperator(
          currentPosition,
          localOperatorAccount.address,
        ),
      ).to.be.false;
    });

    it('should be able to set an authorized  operator as the global operator', async () => {
      const globalOperatorContract = await getCore(globalOperatorAccount);
      await globalOperatorContract.setPositionOperatorStatus(
        currentPosition,
        localOperatorAccount.address,
        true,
      );
      expect(
        await globalOperatorContract.isPositionOperator(
          currentPosition,
          localOperatorAccount.address,
        ),
      ).to.be.true;
    });

    it('should be able to borrow & repay as an operator', async () => {
      await ctx.arc.borrow(0, COLLATERAL_AMOUNT, 0, minterAccount.signer);

      await ctx.arc.setPositionOperatorStatus(
        0,
        localOperatorAccount.address,
        true,
        minterAccount.signer,
      );

      expect(await ctx.arc.synthetic().balanceOf(localOperatorAccount.address)).to.equal(0);

      await ctx.arc.borrow(0, 0, BORROW_AMOUNT, localOperatorAccount.signer);

      expect(await ctx.arc.synthetic().balanceOf(localOperatorAccount.address)).to.equal(
        BORROW_AMOUNT,
      );

      await ctx.arc.repay(0, BORROW_AMOUNT, 0, localOperatorAccount.signer);

      expect(await ctx.arc.synthetic().balanceOf(localOperatorAccount.address)).to.equal(0);

      await Token.transfer(
        ctx.arc.syntheticAddress(),
        localOperatorAccount.address,
        BORROW_AMOUNT,
        minterAccount.signer,
      );

      await ctx.arc.repay(0, BORROW_AMOUNT, COLLATERAL_AMOUNT.mul(2), localOperatorAccount.signer);

      expect(await ctx.arc.synth().collateral.balanceOf(localOperatorAccount.address)).to.equal(
        COLLATERAL_AMOUNT.mul(2),
      );
    });
  });
});
