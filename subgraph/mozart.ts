import {
  ActionOperated as ActionOperatedEvent,
  FeesUpdated as FeesUpdatedEvent,
  LimitsUpdated as LimitsUpdatedEvent,
  RateUpdated as RateUpdatedEvent,
  OracleUpdated as OracleUpdatedEvent,
  CollateralRatioUpdated as CollateralRatioUpdatedEvent,
  PrinterUpdated as PrinterUpdatedEvent,
  PauseStatusUpdated as PauseStatusUpdatedEvent,
  MozartV1,
} from '../generated/templates/MozartV1/MozartV1';

import { ActionOperated, Position, Synth } from '../generated/schema';
import { Address, BigInt } from '@graphprotocol/graph-ts';
import { BaseERC20 } from '../generated/templates/BaseERC20/BaseERC20';

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
  let positionId = event.address.toHexString().concat('-').concat(event.params.params.id.toHex());
  let position = Position.load(positionId);

  if (position == null) {
    position = new Position(positionId);
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
  let synth = createOrLoadMozartSynth(event.address);
  synth.liquidationArcRatio = event.params._liquidationArcRatio.value;
  synth.liquidationUserFee = event.params._liquidationUserFee.value;
  synth.save();
}

export function limitsUpdated(event: LimitsUpdatedEvent): void {
  let synth = createOrLoadMozartSynth(event.address);
  synth.collateralLimit = event.params._collateralLimit;
  synth.positionCollateralMinimum = event.params._positionCollateralMinimum;
  synth.save();
}

export function rateUpdated(event: RateUpdatedEvent): void {
  let synth = createOrLoadMozartSynth(event.address);
  synth.interestRate = event.params.value;
  synth.save();
}

export function oracleUpdated(event: OracleUpdatedEvent): void {
  let synth = createOrLoadMozartSynth(event.address);
  synth.oracle = event.params.value;
  synth.save();
}

export function collateralRatioUpdated(event: CollateralRatioUpdatedEvent): void {
  let synth = createOrLoadMozartSynth(event.address);
  synth.collateralRatio = event.params.value.value;
  synth.save();
}

export function pauseStatusUpdated(event: PauseStatusUpdatedEvent): void {
  let synth = createOrLoadMozartSynth(event.address);
  synth.paused = event.params.value;
  synth.save();
}

export function createOrLoadMozartSynth(address: Address): Synth {
  let synth = Synth.load(address.toHexString());

  let core = MozartV1.bind(address);
  let syntheticAddress = core.getSyntheticAsset();
  let syntheticToken = BaseERC20.bind(syntheticAddress);
  let collateralToken = BaseERC20.bind(core.getCollateralAsset());

  if (synth == null) {
    synth = new Synth(address.toHexString());
    synth.name = syntheticToken.symbol();
    synth.collateral = collateralToken.symbol();
    synth.synthetic = syntheticToken.symbol();
    synth.collateralAddress = core.getCollateralAsset();
    synth.syntheticAddress = syntheticAddress;
    synth.oracle = core.getCurrentOracle();
    synth.paused = false;
    synth.collateralRatio = core.getCollateralRatio().value;
    synth.interestRate = BigInt.fromI32(0);

    let fees = core.getFees();
    synth.liquidationUserFee = fees.value0.value;
    synth.liquidationArcRatio = fees.value1.value;

    let limits = core.getLimits();
    synth.collateralLimit = limits.value0;
    synth.positionCollateralMinimum = limits.value1;
  }

  if (syntheticToken.symbol().length == 0) {
    synth.name = syntheticToken.symbol();
  }

  return synth as Synth;
}
