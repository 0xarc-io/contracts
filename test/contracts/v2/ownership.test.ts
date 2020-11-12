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
      const contract = await getCore(otherAccount);
      await expect(contract.setGlobalOperatorStatus(globalOperatorAccount.address, true)).to.be
        .reverted;
    });

    it('should be able to set as an admin', async () => {
      const contract = await getCore(ownerAccount);
      await expect(contract.setGlobalOperatorStatus(globalOperatorAccount.address, true))
        .to.be.emit(contract, 'GlobalOperatorSet')
        .withArgs(globalOperatorAccount.address, true);
      expect(await contract.isGlobalOperator(globalOperatorAccount.address)).to.be.true;
    });

    it('should be able to remove as an admin', async () => {
      const contract = await getCore(ownerAccount);
      await contract.setGlobalOperatorStatus(globalOperatorAccount.address, true);
      expect(await contract.isGlobalOperator(globalOperatorAccount.address)).to.be.true;
      await expect(contract.setGlobalOperatorStatus(globalOperatorAccount.address, false))
        .to.be.emit(contract, 'GlobalOperatorSet')
        .withArgs(globalOperatorAccount.address, false);
      expect(await contract.isGlobalOperator(globalOperatorAccount.address)).to.be.false;
    });

    it('should not be able to set as a global operator', async () => {
      const ownerContract = await getCore(ownerAccount);
      await ownerContract.setGlobalOperatorStatus(globalOperatorAccount.address, true);
      const operatorContract = await getCore(globalOperatorAccount);
      await expect(operatorContract.setGlobalOperatorStatus(otherAccount.address, true)).to.be
        .reverted;
    });

    it('should be able to borrow as a global operator', async () => {});

    it('should be able to repay as a global operator', async () => {});
  });

  describe('#transferOwnership', () => {
    let currentPosition: BigNumberish;

    beforeEach(async () => {
      await ctx.arc.core().setGlobalOperatorStatus(globalOperatorAccount.address, true);
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
    });
  });

  describe('#setPositionOperatorStatus', () => {
    let currentPosition: BigNumberish;

    beforeEach(async () => {
      await ctx.arc.core().setGlobalOperatorStatus(globalOperatorAccount.address, true);

      const result = await ctx.arc.openPosition(
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT,
        minterAccount.signer,
      );
      currentPosition = result.params.id;
    });

    it('should not be able to set authorized operator as a non-owner', async () => {
      const otherContract = await getCore(otherAccount);
      await expect(
        otherContract.setPositionOperatorStatus(currentPosition, otherContract.address, true),
      ).to.be.reverted;
    });

    it('should be able to set an authorized operator as the global operator', async () => {
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

    it('should be able to remove an authorized operator as the global operator', async () => {
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

    it('should be able to set an authorized operator as the global operator', async () => {
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

    it('should be able to borrow as an operator', async () => {});

    it('should be able to repay as an operator', async () => {});
  });
});
