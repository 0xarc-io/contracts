import { BigNumber, BigNumberish } from 'ethers/utils';
import { BASE } from '../constants';

export interface LiquidationInformation {
  debtNeededToLiquidate: BigNumberish;
  collateralReceivedOnLiquidation: BigNumberish;
  newDebtAmount: BigNumberish;
  newCollateralAmount: BigNumberish;
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
): LiquidationInformation {
  const liquidationPrice = calculateLiquidationPrice(currentPrice, liquidationRatio);
  console.log(`Liquidation price: ${liquidationPrice.toString()}`);
  const collateralNeeded = calculateCollateralNeeded(
    borrowedAmount,
    liquidationPrice,
    collateralRatio,
  );
  console.log(`Collateral needed: ${collateralNeeded.toString()}`);
  const collateralToLiquidate = calculateCollateralPadded(
    collateralNeeded.sub(collateralAmount),
    liquidationRatio,
  );
  console.log(`Collateral to liquidate: ${collateralToLiquidate.toString()}`);
  const borrowToLiquidate = collateralToLiquidate.bigMul(liquidationPrice);
  console.log(`Borrow to liquidate: ${borrowToLiquidate.toString()}`);
  const newCollateralAmount = new BigNumber(collateralAmount).sub(collateralToLiquidate);
  console.log(`New collateral amount: ${newCollateralAmount.toString()}`);
  const newBorrowAmount = new BigNumber(borrowedAmount).sub(borrowToLiquidate);
  console.log(`New Borrow amount: ${newBorrowAmount.toString()}`);

  return {
    debtNeededToLiquidate: borrowToLiquidate,
    collateralReceivedOnLiquidation: collateralToLiquidate,
    newDebtAmount: newBorrowAmount,
    newCollateralAmount: newCollateralAmount,
  } as LiquidationInformation;
}
