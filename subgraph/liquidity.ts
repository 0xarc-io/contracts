import { Address, BigInt } from '@graphprotocol/graph-ts';
import {
  Add_liquidityCall,
  Remove_liquidity_one_coinCall,
} from '../generated/CurvePool/ICurveZapDeposit';
import { LiquidityAction } from '../generated/schema';
import { Burn, Mint } from '../generated/UniswapPool/IUniswapPool';

export function addCurveLiquidity(addLiquidityCall: Add_liquidityCall): void {
  if (
    addLiquidityCall.inputs.value0.notEqual(
      Address.fromString('0x6c0ffb49ad9072f253e254445cfd829bcb8a1b5d'),
    )
  )
    return;

  let liquidityAction = new LiquidityAction(addLiquidityCall.transaction.hash.toHexString());
  liquidityAction.timestamp = addLiquidityCall.block.timestamp;
  liquidityAction.account = addLiquidityCall.from;
  liquidityAction.pool = addLiquidityCall.inputs.value0;
  liquidityAction.amount = addLiquidityCall.inputs.value1.reduce<BigInt>(
    (prev: BigInt, cur: BigInt, index) => {
      if (index < 2) {
        return prev.plus(cur);
      } else {
        return prev.plus(cur.times(BigInt.fromI32(10).pow(12)));
      }
    },
    BigInt.fromI32(0),
  );
  liquidityAction.type = 'Deposit';
  liquidityAction.save();
}

export function removeSingleCurveLiquidity(addLiquidityCall: Remove_liquidity_one_coinCall): void {
  if (
    addLiquidityCall.inputs.value0.notEqual(
      Address.fromString('0x6c0ffb49ad9072f253e254445cfd829bcb8a1b5d'),
    )
  )
    return;
  let liquidityAction = new LiquidityAction(addLiquidityCall.transaction.hash.toHexString());
  liquidityAction.timestamp = addLiquidityCall.block.timestamp;
  liquidityAction.account = addLiquidityCall.from;
  liquidityAction.pool = addLiquidityCall.inputs.value0;
  liquidityAction.amount = addLiquidityCall.inputs.value1;
  liquidityAction.type = 'Withdraw';
  liquidityAction.save();
}

export function addUniswapLiquidity(event: Mint): void {
  let liquidityAction = new LiquidityAction(event.transaction.hash.toHexString());
  liquidityAction.timestamp = event.block.timestamp;
  liquidityAction.account = event.transaction.from;
  liquidityAction.pool = event.address;
  liquidityAction.amount = event.params.amount0
    .times(BigInt.fromI32(10).pow(12))
    .plus(event.params.amount1);
  liquidityAction.type = 'Deposit';
  liquidityAction.save();
}

export function removeUniswapLiquidity(event: Burn): void {
  let liquidityAction = new LiquidityAction(event.transaction.hash.toHexString());
  liquidityAction.timestamp = event.block.timestamp;
  liquidityAction.account = event.transaction.from;
  liquidityAction.pool = event.address;
  liquidityAction.amount = event.params.amount0
    .times(BigInt.fromI32(10).pow(12))
    .plus(event.params.amount1);
  liquidityAction.type = 'Withdraw';
  liquidityAction.save();
}
