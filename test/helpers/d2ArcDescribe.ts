import { ethers } from '@nomiclabs/buidler';
import { EVM } from './EVM';
import { D2TestArc } from '../../src/D2TestArc';
import { Account, getAccounts } from './testingUtils';
import ArcDecimal from '@src/utils/ArcDecimal';
import { MockOracle } from '@src/typings';
import { BigNumberish, BigNumber } from 'ethers/utils';
import { asyncForEach } from '@src/utils/asyncForEach';
import Token from '@src/utils/Token';

/**
 * Setup test tooling
 */

const provider = ethers.provider;
const evm = new EVM(provider);

/**
 * Declare interfaces
 */

export interface ITestContext {
  arc?: D2TestArc;
  accounts?: Account[];
  evm?: EVM;
}

export interface D2ArcOptions {
  oraclePrice: BigNumberish;
  collateralRatio: BigNumberish;
  initialCollateralBalances?: [Account, BigNumber][];
}

export type initFunction = (ctx: ITestContext) => Promise<void>;
export type testsFunction = (ctx: ITestContext) => void;

/**
 * Initialize the Arc smart contracts
 */
export async function initializeD2Arc(ctx: ITestContext, options: D2ArcOptions): Promise<void> {
  // Set the price of the oracle
  await ctx.arc.updatePrice(options.oraclePrice);

  // Update the collateral ratio
  await ctx.arc.synth().core.setCollateralRatio({ value: options.collateralRatio });

  // Set a starting balance and approval for each user we're going to be using
  await asyncForEach(options.initialCollateralBalances, async (account, balance) => {
    await ctx.arc.synth().collateral.mintShare(account.address, balance);
    await Token.approve(
      ctx.arc.synth().collateral.address,
      account.wallet,
      ctx.arc.synth().core.address,
      balance,
    );
  });
}

export default function d2ArcDescribe(
  name: string,
  init: initFunction,
  tests: testsFunction,
): void {
  // Note that the function passed into describe() should not be async.
  describe(name, () => {
    const ctx: ITestContext = {};

    let preInitSnapshotId: string;
    let postInitSnapshotId: string;

    // Runs before any before() calls made within the d1ArcDescribe() call.
    before(async () => {
      ctx.accounts = await getAccounts();
      ctx.evm = evm;
      ctx.arc = await D2TestArc.init(ctx.accounts[0].wallet);

      await ctx.arc.deployTestArc();

      preInitSnapshotId = await evm.snapshot();

      await init(ctx);

      await evm.mineAvgBlock();

      postInitSnapshotId = await evm.snapshot();
    });

    // Runs before any beforeEach() calls made within the d1ArcDescribe() call.
    beforeEach(async () => {
      await evm.resetEVM(postInitSnapshotId);
    });

    // Runs before any after() calls made within the d1ArcDescribe() call.
    afterEach(async () => {
      await evm.resetEVM(postInitSnapshotId);
    });

    tests(ctx);
  });
}
