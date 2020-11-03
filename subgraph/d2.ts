import { Address, BigInt } from '@graphprotocol/graph-ts';
import {
  ActionOperated as ActionOperatedEvent,
  FeesUpdated as FeesUpdatedEvent,
  LimitsUpdated as LimitsUpdatedEvent,
  RateUpdated as RateUpdatedEvent,
  OracleUpdated as OracleUpdatedEvent,
  CollateralRatioUpdated as CollateralRatioUpdatedEvent,
  PrinterUpdated as PrinterUpdatedEvent,
  PauseStatusUpdated as PauseStatusUpdatedEvent,
} from '../generated/D2CoreV1/D2CoreV1';

import { ActionOperated, Position, Synth } from '../generated/schema';

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

export function feesUpdated(event: FeesUpdatedEvent): void {
  let synth = createOrLoadSynth(event.address);
  synth.liquidationArcRatio = event.params._liquidationArcRatio.value;
  synth.liquidationUserFee = event.params._liquidationUserFee.value;
  synth.printerArcRatio = event.params._printerArcRatio.value;
  synth.save();
}

export function limitsUpdated(event: LimitsUpdatedEvent): void {
  let synth = createOrLoadSynth(event.address);
  synth.syntheticLimit = event.params._syntheticLimit;
  synth.collateralLimit = event.params._collateralLimit;
  synth.positionCollateralMinimum = event.params._positionCollateralMinimum;
  synth.save();
}

export function rateUpdated(event: RateUpdatedEvent): void {
  let synth = createOrLoadSynth(event.address);
  synth.interestRate = event.params.value;
  synth.save();
}

export function oracleUpdated(event: OracleUpdatedEvent): void {
  let synth = createOrLoadSynth(event.address);
  synth.oracle = event.params.value;
  synth.save();
}

export function collateralRatioUpdated(event: CollateralRatioUpdatedEvent): void {
  let synth = createOrLoadSynth(event.address);
  synth.collateralRatio = event.params.value.value;
  synth.save();
}

export function pauseStatusUpdated(event: PauseStatusUpdatedEvent): void {
  let synth = createOrLoadSynth(event.address);
  synth.paused = event.params.value;
  synth.save();
}

function createOrLoadSynth(address: Address): Synth {
  let synth = Synth.load(address.toHex());

  if (synth == null) {
    synth = new Synth(address.toHex());
    synth.borrowIndex = BigInt.fromI32(1000000000000000000);
  }

  return synth;
}
