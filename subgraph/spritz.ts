import { Position, ActionOperated, Synth } from '../generated/schema';
import {
  RiskParamsUpdated,
  MarketParamsUpdated,
  OracleUpdated,
  StateV1,
} from '../generated/templates/StateV1/StateV1';
import { ActionOperated as ActionOperatedEvent } from '../generated/templates/CoreV1/CoreV1';
import { BASE } from './constants';
import { Address, BigInt } from '@graphprotocol/graph-ts';
import { BaseERC20 } from '../generated/templates/MozartCoreV1/BaseERC20';

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
}

export function marketParamsUpdated(event: MarketParamsUpdated): void {
  let synth = createOrLoadSpritzSynth(event.address);
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
  let synth = createOrLoadSpritzSynth(event.address);
  synth.collateralLimit = event.params.updatedParams.collateralLimit;
  synth.positionCollateralMinimum = event.params.updatedParams.positionCollateralMinimum;
  synth.save();
}

export function oracleUpdated(event: OracleUpdated): void {
  let synth = createOrLoadSpritzSynth(event.address);
  synth.oracle = event.params.updatedOracle;
  synth.save();
}

export function createOrLoadSpritzSynth(address: Address): Synth {
  let stateContract = StateV1.bind(address);
  let syntheticToken = BaseERC20.bind(stateContract.syntheticAsset());
  let collateralToken = BaseERC20.bind(stateContract.collateralAsset());

  let coreAddress = stateContract.core();
  let synth = Synth.load(coreAddress.toHex());

  if (synth == null) {
    synth = new Synth(coreAddress.toHex());
    synth.name = syntheticToken.symbol();
    synth.collateral = collateralToken.symbol();
    synth.synthetic = syntheticToken.symbol();
    synth.collateralAddress = stateContract.collateralAsset();
    synth.syntheticAddress = stateContract.syntheticAsset();
    synth.oracle = stateContract.oracle();
    synth.borrowIndex = BASE;
    synth.paused = false;

    let market = stateContract.market();
    synth.collateralRatio = market.value0.value;
    synth.liquidationUserFee = market.value1.value;
    synth.liquidationArcRatio = stateContract.calculateLiquidationSplit().value1.value;

    let limits = stateContract.risk();
    synth.collateralLimit = limits.value0;
    synth.positionCollateralMinimum = limits.value2;
    synth.interestRate = BigInt.fromI32(0);
  }

  return synth as Synth;
}
