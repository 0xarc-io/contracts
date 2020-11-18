// // Buidler automatically injects the waffle version into chai
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { EVM } from './EVM';

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

// const provider = ethers.provider;

// export type Account = {
//   address: string;
//   signer: Signer;
// };

// export const getAccounts = async (): Promise<Account[]> => {
//   const accounts: Account[] = [];

//   const signers = await getSigners();
//   for (let i = 0; i < signers.length; i++) {
//     accounts.push({
//       signer: signers[i],
//       address: await signers[i].getAddress(),
//     });
//   }

//   return accounts;
// };

// export const getSigners = async (): Promise<Signer[]> => {
//   return await ethers.getSigners();
// };
