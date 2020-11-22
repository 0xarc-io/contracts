// // Buidler automatically injects the waffle version into chai
import { TestTokenFactory } from '../../src/typings';
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
