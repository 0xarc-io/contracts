import { Position, ActionOperated, Synth } from '../generated/schema';
import { RiskParamsUpdated, MarketParamsUpdated, StateV1 } from '../generated/StateV1/StateV1';
import { ActionOperated as ActionOperatedEvent } from '../generated/CoreV1/CoreV1';
import { Address, BigInt, ByteArray } from '@graphprotocol/graph-ts';
import { BASE } from '../src/constants';

export function actionOperated(event: ActionOperatedEvent): void {
  handlePosition(event);

  let positionId = event.params.params.id.toHexString();
  let actionOperated = new ActionOperated(
    event.transaction.hash.toHexString().concat('-').concat(positionId),
  );
  actionOperated.sender = event.transaction.from;
  actionOperated.position = positionId;
  actionOperated.synth = event.address;
  actionOperated.amountOne = event.params.params.amountOne;
  actionOperated.amountTwo = event.params.params.amountTwo;
  actionOperated.operation = event.params.operation;
  actionOperated.createdAt = event.block.timestamp.toI32();
  actionOperated.save();
}

function handlePosition(event: ActionOperatedEvent): void {
  if (
    !(
      event.params.updatedPosition.borrowedAsset == 0 &&
      event.params.updatedPosition.collateralAsset == 0
    )
  ) {
    let position = Position.load(event.params.params.id.toHex());

    if (position == null) {
      position = new Position(event.params.params.id.toHex());
      position.createdAt = event.block.timestamp.toI32();
      position.synth = event.address;
    }

    position.owner = event.params.updatedPosition.owner;
    position.collateralAmountSign = event.params.updatedPosition.collateralAmount.sign;
    position.collateralAmountValue = event.params.updatedPosition.collateralAmount.value;
    position.borrowedAmountSign = event.params.updatedPosition.borrowedAmount.sign;
    position.borrowedAmountValue = event.params.updatedPosition.borrowedAmount.value;
    position.save();
  }
}

export function marketParamsUpdated(event: MarketParamsUpdated): void {
  let synth = createOrLoadSynth(event.address);
  synth.collateralRatio = event.params.updatedMarket.collateralRatio.value;

  let totalFee = event.params.updatedMarket.liquidationArcFee.value.plus(
    event.params.updatedMarket.liquidationArcFee.value,
  );
  synth.liquidationUserFee = totalFee;
  synth.liquidationArcRatio = event.params.updatedMarket.liquidationArcFee.value
    .times(BASE)
    .div(totalFee);

  synth.save();
}

export function riskParamsUpdated(event: RiskParamsUpdated): void {
  let synth = createOrLoadSynth(event.address);
  synth.collateralLimit = event.params.updatedParams.collateralLimit;
  synth.syntheticLimit = event.params.updatedParams.syntheticLimit;
  synth.positionCollateralMinimum = event.params.updatedParams.positionCollateralMinimum;
  synth.save();
}

function createOrLoadSynth(address: Address): Synth {
  let stateContract = StateV1.bind(address);
  let coreAddress = stateContract.core();

  let synth = Synth.load(coreAddress.toHex());

  if (synth == null) {
    synth = new Synth(coreAddress.toHex());
    synth.borrowIndex = BASE;
  }

  return synth as Synth;
}
