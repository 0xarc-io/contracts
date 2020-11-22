import { Address, BigInt } from '@graphprotocol/graph-ts';
import { Transfer } from '../generated/templates/BaseERC20/BaseERC20';
import { AccountBalance } from '../generated/schema';

enum ModifyOperation {
  plus,
  minus,
}

export function transfer(event: Transfer): void {
  let asset = event.address;
  let value = event.params.value;
  modifyBalance(event.params.from, asset, value, ModifyOperation.minus);
  modifyBalance(event.params.to, asset, value, ModifyOperation.plus);
}

function modifyBalance(
  account: Address,
  asset: Address,
  value: BigInt,
  operation: ModifyOperation,
): void {
  if (account.toHexString() !== '0x0000000000000000000000000000000000000000') {
    let accountBalance = getOrCreateAccountBalance(account, asset);
    accountBalance.balance =
      operation === ModifyOperation.plus
        ? accountBalance.balance.plus(value)
        : accountBalance.balance.minus(value);
    accountBalance.save();
  }
}

function getOrCreateAccountBalance(account: Address, asset: Address): AccountBalance {
  let index = account.toHexString() + '-' + asset.toHexString();
  let accountBalance = AccountBalance.load(index);
  if (!accountBalance) {
    accountBalance = new AccountBalance(index);
    accountBalance.account = account;
    accountBalance.asset = asset;
    accountBalance.balance = BigInt.fromI32(0);
  }
  return accountBalance as AccountBalance;
}
