import { Address, BigInt } from '@graphprotocol/graph-ts';
import { Synth } from '../generated/schema';
import { StateV1 } from '../generated/templates/StateV1/StateV1';
import { MozartV1 } from '../generated/templates/MozartV1/MozartV1';
import { BaseERC20 } from '../generated/templates/BaseERC20/BaseERC20';

export function createOrLoadV1Synth(address: Address): Synth {
  let stateContract = StateV1.bind(address);
  let syntheticToken = BaseERC20.bind(stateContract.syntheticAsset());

  let coreAddress = stateContract.core();
  let synth = Synth.load(coreAddress.toHex());

  if (synth == null) {
    synth = new Synth(coreAddress.toHex());
    synth.name = syntheticToken.symbol();
    synth.collateralAddress = stateContract.collateralAsset();
    synth.syntheticAddress = stateContract.syntheticAsset();
    synth.oracle = stateContract.oracle();
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

export function createOrLoadV2Synth(address: Address): Synth {
  let synth = Synth.load(address.toHexString());

  let core = MozartV1.bind(address);
  let syntheticAddress = core.getSyntheticAsset();
  let syntheticToken = BaseERC20.bind(syntheticAddress);

  if (synth == null) {
    synth = new Synth(address.toHexString());
    synth.name = syntheticToken.symbol();
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
