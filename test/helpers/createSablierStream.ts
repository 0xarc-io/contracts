import { BigNumberish } from '@ethersproject/bignumber';
import {
  MockKermanSocialMoney,
  MockSablier,
  TestToken,
} from '@src/typings';
import { BigNumber } from 'ethers';

export async function createStream(
  sablierContract: MockSablier,
  stakingToken: TestToken | MockKermanSocialMoney,
  contractAddress: string,
  stakeAmount: BigNumberish,
  streamDuration: BigNumberish,
  startTime: BigNumberish = 0,
) {
  const sablierId = await sablierContract.nextStreamId();
  await stakingToken.mintShare(
    await sablierContract.signer.getAddress(),
    stakeAmount,
  );
  await stakingToken.approve(sablierContract.address, stakeAmount);
  await sablierContract.createStream(
    contractAddress,
    stakeAmount,
    stakingToken.address,
    startTime,
    BigNumber.from(startTime).add(streamDuration),
  );

  return sablierId;
}

export default createStream;
