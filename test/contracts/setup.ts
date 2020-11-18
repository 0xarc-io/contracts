import { BigNumber, BigNumberish } from 'ethers';
import { BASE } from '@src/constants';
import Token from '@src/utils/Token';
import ArcNumber from '@src/utils/ArcNumber';
import { ITestContext } from './context';

export interface MozartSetupOptions {
  oraclePrice: BigNumberish;
  collateralRatio: BigNumberish;
  interestRate?: BigNumberish;
  startingTime?: BigNumberish;
  fees?: {
    liquidationUserFee?: BigNumberish;
    liquidationArcRatio?: BigNumberish;
  };
  initialCollateralBalances?: [Account, BigNumber][];
}

export async function setupMozart(ctx: ITestContext, options: MozartSetupOptions) {
  const arc = ctx.sdks.mozart;

  // Set the starting timestamp
  await arc.updateTime(options.startingTime || 0);

  // Set the price of the oracle
  await arc.updatePrice(options.oraclePrice);

  // Update the collateral ratio
  await arc.synth().core.setCollateralRatio({ value: options.collateralRatio });

  // Set a starting balance and approval for each user we're going to be using
  await Token.setStartingBalances(
    arc.collateral().address,
    arc.core().address,
    Object.values(ctx.signers),
    ArcNumber.new(1000000),
  );

  // Set the interest rate
  await arc.synth().core.setRate(options.interestRate || BASE);

  // Set ARC's fees
  await arc
    .synth()
    .core.setFees(
      { value: options.fees?.liquidationUserFee || 0 },
      { value: options.fees?.liquidationArcRatio || 0 },
    );
}
