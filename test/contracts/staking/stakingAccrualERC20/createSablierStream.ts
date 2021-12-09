import { BigNumberish } from '@ethersproject/bignumber';
import {
  MockSablier,
  StakingAccrualERC20,
  StakingAccrualERC20V4,
  TestToken,
} from '@src/typings';

async function createStream(
  sablierContract: MockSablier,
  stakingToken: TestToken,
  starcx: StakingAccrualERC20 | StakingAccrualERC20V4,
  stakeAmount: BigNumberish,
  streamDuration: BigNumberish,
  setStreamId = false,
) {
  const sablierId = await sablierContract.nextStreamId();
  await stakingToken.mintShare(
    await sablierContract.signer.getAddress(),
    stakeAmount,
  );
  await stakingToken.approve(sablierContract.address, stakeAmount);
  await sablierContract.createStream(
    starcx.address,
    stakeAmount,
    stakingToken.address,
    0,
    streamDuration,
  );

  if (setStreamId) {
    await starcx.setSablierStreamId(sablierId);
  }

  return sablierId;
}

export default createStream;
