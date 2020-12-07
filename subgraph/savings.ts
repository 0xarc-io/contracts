import { SavingsAdded } from '../generated/SavingsRegistry/SavingsRegistry';
import {
  IndexUpdated,
  SavingsRateUpdated,
  ArcFeeUpdated,
  Paused,
} from '../generated/templates/MozartSavingsV1/MozartSavingsV1';
import {
  BaseERC20 as BaseERC20Template,
  MozartSavingsV1 as MozartSavingsV1Template,
} from '../generated/templates';
import { Address } from '@graphprotocol/graph-ts';
import { MozartSavingsV1 } from '../generated/templates/MozartSavingsV1/MozartSavingsV1';
import { Saving } from '../generated/schema';
import { BaseERC20 } from '../generated/templates/MozartV1/BaseERC20';

export function savingsAdded(event: SavingsAdded): void {
  let savings = event.params.savings;
  BaseERC20Template.create(savings);
  MozartSavingsV1Template.create(savings);
}

export function indexUpdated(event: IndexUpdated): void {
  let savings = createOrLoadSavings(event.address);
  savings.indexLastUpdate = event.params.updateTime;
  savings.savingsIndex = event.params.newIndex;

  let savingsContract = MozartSavingsV1.bind(event.address);
  savings.totalSupplied = savingsContract.totalSupplied();

  savings.save();
}

export function savingsRateUpdated(event: SavingsRateUpdated): void {
  let savings = createOrLoadSavings(event.address);
  savings.savingsRate = event.params.newRate;
  savings.save();
}

export function arcFeeUpdated(event: ArcFeeUpdated): void {
  let savings = createOrLoadSavings(event.address);
  savings.arcFee = event.params.feeUpdated;
  savings.save();
}

export function paused(event: Paused): void {
  let savings = createOrLoadSavings(event.address);
  savings.paused = event.params.newStatus;
  savings.save();
}

export function createOrLoadSavings(address: Address): Saving {
  let savings = Saving.load(address.toHexString());

  let savingsToken = BaseERC20.bind(address);
  let savingsContract = MozartSavingsV1.bind(address);

  if (savings == null) {
    savings = new Saving(address.toHex());
    savings.name = savingsToken.name();
    savings.symbol = savingsToken.symbol();
    savings.paused = savingsContract.paused();
    savings.indexLastUpdate = savingsContract.indexLastUpdate();
    savings.savingsRate = savingsContract.savingsRate();
    savings.savingsIndex = savingsContract.exchangeRate();
    savings.syntheticAddress = savingsContract.synthetic();
    savings.totalSupplied = savingsContract.totalSupplied();
  }

  return savings as Saving;
}
