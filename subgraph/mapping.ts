import { ActionOperated } from '../generated/ARC/CoreV1';
import { Position } from '../generated/schema';

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
