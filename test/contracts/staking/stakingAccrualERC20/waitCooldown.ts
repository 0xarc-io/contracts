import { BigNumberish } from '@ethersproject/bignumber';
import { StakingAccrualERC20, StakingAccrualERC20V4 } from '@src/typings';

async function waitCooldown(
  starcx: StakingAccrualERC20 | StakingAccrualERC20V4,
  cooldownDuration: BigNumberish,
) {
  const currentTimestamp = await starcx.currentTimestamp();
  await starcx.setCurrentTimestamp(currentTimestamp.add(cooldownDuration));
}

export default waitCooldown;
