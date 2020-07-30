import { ActionOperated } from '../generated/ARC/CoreV1';
import { Position, GlobalIndex, GlobalParams, TotalPar } from '../generated/schema';
import {
  LogIndexUpdated,
  GlobalParamsUpdated,
  TotalParUpdated,
} from '../generated/StateV1/StateV1';

export function actionOperated(event: ActionOperated): void {
  if (
    event.params.updatedPosition.owner.toString() == '0x0000000000000000000000000000000000000000'
  ) {
    return;
  }

  let position = new Position(event.params.params.id.toHex());
  position.owner = event.params.updatedPosition.owner;
  position.collateralAsset = event.params.updatedPosition.collateralAsset;
  position.borrowedAsset = event.params.updatedPosition.borrowedAsset;
  position.collateralAmountSign = event.params.updatedPosition.collateralAmount.sign;
  position.collateralAmountValue = event.params.updatedPosition.collateralAmount.value;
  position.borrowedAmountSign = event.params.updatedPosition.borrowedAmount.sign;
  position.borrowedAmountValue = event.params.updatedPosition.borrowedAmount.value;
  position.save();
}

export function logIndexUpdated(event: LogIndexUpdated): void {
  let index = new GlobalIndex(event.params.updatedIndex.lastUpdate.toHex());
  index.supply = event.params.updatedIndex.supply;
  index.borrow = event.params.updatedIndex.borrow;
  index.lastUpdate = event.params.updatedIndex.lastUpdate;
  index.save();
}

export function globalParamsUpdated(event: GlobalParamsUpdated): void {
  let globalParams = new GlobalParams(event.block.timestamp.toHex());
  globalParams.stableAsset = event.params.updatedParams.stableAsset;
  globalParams.lendAsset = event.params.updatedParams.lendAsset;
  globalParams.syntheticAsset = event.params.updatedParams.syntheticAsset;
  globalParams.interestSetter = event.params.updatedParams.interestSetter;
  globalParams.collateralRatio = event.params.updatedParams.collateralRatio.value;
  globalParams.syntheticRatio = event.params.updatedParams.syntheticRatio.value;
  globalParams.liquidationSpread = event.params.updatedParams.liquidationSpread.value;
  globalParams.originationFee = event.params.updatedParams.originationFee.value;
  globalParams.earningsRate = event.params.updatedParams.earningsRate.value;
  globalParams.oracle = event.params.updatedParams.oracle;
  globalParams.save();
}

export function totalParUpdated(event: TotalParUpdated): void {
  let total = new TotalPar(event.block.timestamp.toHex());
  total.supply = event.params.updatedPar.supply;
  total.borrow = event.params.updatedPar.borrow;
  total.save();
}
