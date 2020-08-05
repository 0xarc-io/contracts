import { Position, GlobalParam } from '../generated/schema';
import { GlobalParamsUpdated } from '../generated/StateV1/StateV1';
import { log } from '@graphprotocol/graph-ts';
import { ActionOperated } from '../generated/CoreV1/CoreV1';

export function actionOperated(event: ActionOperated): void {
  if (
    !(
      event.params.updatedPosition.borrowedAsset == 0 &&
      event.params.updatedPosition.collateralAsset == 0
    )
  ) {
    let position = new Position(event.params.params.id.toHex());
    position.owner = event.params.updatedPosition.owner;
    position.collateralAsset = event.params.updatedPosition.collateralAsset;
    position.borrowedAsset = event.params.updatedPosition.borrowedAsset;
    position.collateralAmountSign = event.params.updatedPosition.collateralAmount.isPositive;
    position.collateralAmountValue = event.params.updatedPosition.collateralAmount.value;
    position.borrowedAmountSign = event.params.updatedPosition.borrowedAmount.isPositive;
    position.borrowedAmountValue = event.params.updatedPosition.borrowedAmount.value;
    position.save();
  }
}

export function globalParamsUpdated(event: GlobalParamsUpdated): void {
  let globalParams = new GlobalParam(event.block.timestamp.toString());
  globalParams.collateralAsset = event.params.updatedParams.collateralAsset;
  globalParams.syntheticAsset = event.params.updatedParams.syntheticAsset;
  globalParams.collateralRatio = event.params.updatedParams.collateralRatio.value;
  globalParams.syntheticRatio = event.params.updatedParams.syntheticRatio.value;
  globalParams.liquidationSpread = event.params.updatedParams.liquidationSpread.value;
  globalParams.originationFee = event.params.updatedParams.originationFee.value;
  globalParams.oracle = event.params.updatedParams.oracle;
  globalParams.save();
}
