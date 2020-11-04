import { ethers } from 'hardhat';
import { EVM } from './EVM';
import { D2TestArc } from '../../src/D2TestArc';
import { Account, getAccounts } from './testingUtils';
import ArcDecimal from '@src/utils/ArcDecimal';
import { MockOracle } from '@src/typings';
import { BigNumberish, BigNumber } from 'ethers/utils';
import { asyncForEach } from '@src/utils/asyncForEach';
import Token from '@src/utils/Token';
import ArcNumber from '../../src/utils/ArcNumber';
import { D2Fees } from '@src/types';
import { BASE } from '../../src/constants';

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
  postInitSnapshotId?: string;
}

export interface D2ArcOptions {
  oraclePrice: BigNumberish;
  collateralRatio: BigNumberish;
  printerDestination: string;
  interestRate?: BigNumberish;
  startingTime?: BigNumberish;
  fees?: D2Fees;
  initialCollateralBalances?: [Account, BigNumber][];
}

export type initFunction = (ctx: ITestContext) => Promise<void>;
export type testsFunction = (ctx: ITestContext) => void;

export const DEFAULT_LIQUIDATION_USER_FEE = ArcDecimal.new(0.1).value;
export const DEFAULT_LIQUIDATION_ARC_RATIO = ArcDecimal.new(0.5).value;
export const DEFAULT_PRINTER_ARC_RATIO = ArcDecimal.new(0.1).value;

/**
 * Initialize the Arc smart contracts
 */
export async function initializeD2Arc(ctx: ITestContext, options: D2ArcOptions): Promise<void> {
  // Set the starting timestamp
  await ctx.arc.updateTime(options.startingTime || 0);

  // Set the price of the oracle
  await ctx.arc.updatePrice(options.oraclePrice);

  // Update the collateral ratio
  await ctx.arc.synth().core.setCollateralRatio({ value: options.collateralRatio });

  // Set a starting balance and approval for each user we're going to be using
  await asyncForEach(
    options.initialCollateralBalances,
    async ([account, balance]: [Account, BigNumberish]) => {
      await ctx.arc.synth().collateral.mintShare(account.address, balance);
      await Token.approve(
        ctx.arc.synth().collateral.address,
        account.signer,
        ctx.arc.synth().core.address,
        balance,
      );
    },
  );

  // Set the interest rate
  await ctx.arc.synth().core.setRate(options.interestRate || BASE);

  // Set the money printer destination
  await ctx.arc.synth().core.setPrinterDestination(options.printerDestination);

  // Set ARC's fees
  await ctx.arc
    .synth()
    .core.setFees(
      { value: options.fees?.liquidationUserFee || DEFAULT_LIQUIDATION_USER_FEE },
      { value: options.fees?.liquidationArcRatio || DEFAULT_LIQUIDATION_ARC_RATIO },
      { value: options.fees?.printerArcRatio || DEFAULT_PRINTER_ARC_RATIO },
    );
}

export async function d2Setup(init: initFunction): Promise<ITestContext> {
  const ctx: ITestContext = {};
  ctx.accounts = await getAccounts();
  ctx.evm = evm;
  ctx.arc = await D2TestArc.init(ctx.accounts[0].signer);

  await ctx.arc.deployTestArc();
  await init(ctx);

  ctx.postInitSnapshotId = await evm.snapshot();
  return ctx;
}
