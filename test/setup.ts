import { BigNumber, BigNumberish } from 'ethers';
import { MozartTestArc } from '../src/MozartTestArc';
import { BASE } from '@src/constants';
import {
  DEFAULT_LIQUIDATION_USER_FEE,
  DEFAULT_LIQUIDATION_ARC_RATIO,
} from '../test_old/helpers/d2ArcDescribe';

export interface MozartOptions {
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

export async function setupMozart(arc: MozartTestArc, options: MozartOptions) {
  // Set the starting timestamp
  await arc.updateTime(options.startingTime || 0);

  // Set the price of the oracle
  await arc.updatePrice(options.oraclePrice);

  // Update the collateral ratio
  await arc.synth().core.setCollateralRatio({ value: options.collateralRatio });

  // Set a starting balance and approval for each user we're going to be using

  // Set the interest rate
  await arc.synth().core.setRate(options.interestRate || BASE);

  // Set ARC's fees
  await arc
    .synth()
    .core.setFees(
      { value: options.fees?.liquidationUserFee || DEFAULT_LIQUIDATION_USER_FEE },
      { value: options.fees?.liquidationArcRatio || DEFAULT_LIQUIDATION_ARC_RATIO },
    );
}
