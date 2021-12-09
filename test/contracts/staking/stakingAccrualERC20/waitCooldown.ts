import { BigNumberish } from '@ethersproject/bignumber';
import { StakingAccrualERC20, StakingAccrualERC20V5 } from '@src/typings';

async function waitCooldown(
  starcx: StakingAccrualERC20 | StakingAccrualERC20V5,
  cooldownDuration: BigNumberish,
) {
  const currentTimestamp = await starcx.currentTimestamp();
  await starcx.setCurrentTimestamp(currentTimestamp.add(cooldownDuration));
}

export default waitCooldown;
