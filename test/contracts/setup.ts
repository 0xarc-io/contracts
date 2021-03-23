import { BigNumber, BigNumberish } from 'ethers';
import { BASE } from '@src/constants';
import ArcNumber from '@src/utils/ArcNumber';
import { ITestContext } from './context';
import { immediatelyUpdateMerkleRoot, setStartingBalances } from '../helpers/testingUtils';

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

export interface SapphireSetupOptions {
  merkleRoot?: string;
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
  await setStartingBalances(
    arc.collateral().address,
    arc.core().address,
    Object.values(ctx.signers),
    ArcNumber.new(1000000),
  );

  // Set the interest rate
  await arc.synth().core.setInterestRate(options.interestRate || BASE);

  // Set ARC's fees
  await arc
    .synth()
    .core.setFees(
      { value: options.fees?.liquidationUserFee || 0 },
      { value: options.fees?.liquidationArcRatio || 0 },
    );
}

export async function setupSapphire(ctx: ITestContext, options: SapphireSetupOptions) {
  const arc = ctx.sdks.sapphire;

  // Set the merkle root
  if (options.merkleRoot) {
    await ctx.contracts.sapphire.creditScore.setPause(false);
    await immediatelyUpdateMerkleRoot(
      ctx.contracts.sapphire.creditScore.connect(ctx.signers.interestSetter),
      options.merkleRoot,
    );
  }
}
