import { BigNumber, BigNumberish } from 'ethers';
import { BASE } from '../constants';
import ArcNumber from './ArcNumber';

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
  return ArcNumber.bigMul(BigNumber.from(currentPrice), BASE.sub(liquidationRatio));
}

export function calculateCollateralNeeded(
  borrowedAmount: BigNumberish,
  price: BigNumberish,
  collateralRatio: BigNumberish,
) {
  return ArcNumber.bigDiv(ArcNumber.bigMul(BigNumber.from(borrowedAmount), collateralRatio), price);
}

export function calculateCollateralPadded(
  collateralAmount: BigNumberish,
  liquidationRatio: BigNumberish,
) {
  return ArcNumber.bigMul(BigNumber.from(collateralAmount), BASE.add(liquidationRatio));
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

  const borrowToLiquidate = ArcNumber.bigMul(collateralToLiquidate, liquidationPrice);
  const newCollateralAmount = BigNumber.from(collateralAmount).sub(collateralToLiquidate);
  const newBorrowAmount = BigNumber.from(borrowedAmount).sub(borrowToLiquidate);
  const collateralProfit = collateralToLiquidate.sub(
    ArcNumber.bigDiv(borrowToLiquidate, currentPrice),
  );
  const arcProft = ArcNumber.bigMul(collateralProfit, arcRatio);

  return {
    debtNeededToLiquidate: borrowToLiquidate,
    collateralLiquidated: collateralToLiquidate,
    newDebtAmount: newBorrowAmount,
    newCollateralAmount: newCollateralAmount,
    collateralToArc: arcProft,
  } as LiquidationInformation;
}
