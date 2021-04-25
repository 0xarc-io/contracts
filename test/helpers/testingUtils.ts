// // Buidler automatically injects the waffle version into chai
import { MockSapphireCreditScore, TestTokenFactory } from '../../src/typings';
import { BigNumberish, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { EVM } from './EVM';
import { asyncForEach } from '../../src/utils/asyncForEach';
import Token from '../../src/utils/Token';

// And this is our test sandboxing. It snapshots and restores between each test.
// Note: if a test suite uses fastForward at all, then it MUST also use these snapshots,
// otherwise it will update the block time of the EVM and future tests that expect a
// starting timestamp will fail.
export const addSnapshotBeforeRestoreAfterEach = () => {
  const provider = ethers.provider;
  const evm = new EVM(provider);

  beforeEach(async () => {
    await evm.snapshot();
  });

  afterEach(async () => {
    await evm.evmRevert();
  });
};

export async function setStartingBalances(
  collateral: string,
  core: string,
  signers: Signer[],
  balance: BigNumberish,
) {
  await asyncForEach(signers, async (signer) => {
    const testToken = await new TestTokenFactory(signer).attach(collateral);
    await testToken.mintShare(signer.address, balance);
    await Token.approve(collateral, signer, core, balance);
  });
}

export async function immediatelyUpdateMerkleRoot(
  creditScoreContract: MockSapphireCreditScore,
  targetCurrentRoot: string,
  targetUpcomingRoot?: string,
) {
  // advance time if merkle root was recently updated
  const lastUpdate = await creditScoreContract.lastMerkleRootUpdate();
  const delayDuration = await creditScoreContract.merkleRootDelayDuration();
  const now = await creditScoreContract.currentTimestamp();
  if (now < lastUpdate.add(delayDuration)) {
    await advanceEpoch(creditScoreContract);
  }

  await creditScoreContract.updateMerkleRoot(targetCurrentRoot);

  await advanceEpoch(creditScoreContract);
  // intended root set as current one
  await creditScoreContract.updateMerkleRoot(targetUpcomingRoot || targetCurrentRoot);
}

export async function advanceEpoch(creditScoreContract: MockSapphireCreditScore) {
  const initTimestamp = await creditScoreContract.currentTimestamp();
  const merkleRootDelay = await creditScoreContract.merkleRootDelayDuration();

  const changedTimestamp = initTimestamp.add(merkleRootDelay);
  const { wait } = await creditScoreContract.setCurrentTimestamp(changedTimestamp);
  wait();
  return changedTimestamp;
}
