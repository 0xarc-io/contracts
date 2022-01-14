import { BigNumberish } from '@ethersproject/bignumber';
import {
  MockKermanSocialMoney,
  MockSablier,
  TestToken,
} from '@src/typings';

export async function createStream(
  sablierContract: MockSablier,
  stakingToken: TestToken | MockKermanSocialMoney,
  contractAddress: string,
  stakeAmount: BigNumberish,
  streamDuration: BigNumberish,
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
    0,
    streamDuration,
  );

  return sablierId;
}

export default createStream;
