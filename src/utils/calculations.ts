import { BigNumber, BigNumberish } from 'ethers/utils';
import { BASE } from '../constants';

export interface LiquidationInformation {
  debtNeededToLiquidate: BigNumber;
  collateralLiquidated: BigNumber;
  collateralToArc: BigNumber;
  newDebtAmount: BigNumber;
  newCollateralAmount: BigNumber;
}

export function calculateLiquidationPrice(
  currentPrice: BigNumberish,
  liquidationRatio: BigNumberish,
) {
  return new BigNumber(currentPrice).bigMul(BASE.sub(liquidationRatio));
}

export function calculateCollateralNeeded(
  borrowedAmount: BigNumberish,
  price: BigNumberish,
  collateralRatio: BigNumberish,
) {
  return new BigNumber(borrowedAmount).bigMul(collateralRatio).bigDiv(price);
}

export function calculateCollateralPadded(
  collateralAmount: BigNumberish,
  liquidationRatio: BigNumberish,
) {
  return new BigNumber(collateralAmount).bigMul(BASE.add(liquidationRatio));
}

export function calculateLiquidationAmount(
  collateralAmount: BigNumberish,
  borrowedAmount: BigNumberish,
  currentPrice: BigNumberish,
  liquidationRatio: BigNumberish,
  collateralRatio: BigNumberish,
  arcRatio: BigNumberish,
): LiquidationInformation {
  const liquidationPrice = calculateLiquidationPrice(currentPrice, liquidationRatio);

  const collateralNeeded = calculateCollateralNeeded(
    borrowedAmount,
    liquidationPrice,
    collateralRatio,
  );

  const collateralToLiquidate = calculateCollateralPadded(
    collateralNeeded.sub(collateralAmount),
    liquidationRatio,
  );

  const borrowToLiquidate = collateralToLiquidate.bigMul(liquidationPrice);
  const newCollateralAmount = new BigNumber(collateralAmount).sub(collateralToLiquidate);
  const newBorrowAmount = new BigNumber(borrowedAmount).sub(borrowToLiquidate);
  const collateralProfit = collateralToLiquidate.sub(borrowToLiquidate.bigDiv(currentPrice));
  const arcProft = collateralProfit.bigMul(arcRatio);

  return {
    debtNeededToLiquidate: borrowToLiquidate,
    collateralLiquidated: collateralToLiquidate,
    newDebtAmount: newBorrowAmount,
    newCollateralAmount: newCollateralAmount,
    collateralToArc: arcProft,
  } as LiquidationInformation;
}
