import chai from 'chai';

import { D1TestArc } from '../../src/D1TestArc';
import { ethers } from '@nomiclabs/buidler';
import { EVM } from './EVM';
import { Account, getAccounts } from './testingUtils';
import { solidity } from 'ethereum-waffle';

chai.use(solidity);
export interface ITestContext {
  arc?: D1TestArc;
  accounts?: Account[];
  evm?: EVM;
}

export type initFunction = (ctx: ITestContext) => Promise<void>;
export type testsFunction = (ctx: ITestContext) => void;

const provider = ethers.provider;
const evm = new EVM(provider);

export default function d1ArcDescribe(
  name: string,
  init: initFunction,
  tests: testsFunction,
): void {
  // Note that the function passed into describe() should not be async.
  describe(name, () => {
    const ctx: ITestContext = {};

    let preInitSnapshotId: string;
    let postInitSnapshotId: string;

    // Runs before any before() calls made within the d1ArcDescribe() call.
    before(async () => {
      ctx.accounts = await getAccounts();

      ctx.evm = evm;
      ctx.arc = await D1TestArc.init(ctx.accounts[0].wallet);

      await ctx.arc.deployTestArc();

      preInitSnapshotId = await evm.snapshot();

      await init(ctx);

      await evm.mineAvgBlock();

      postInitSnapshotId = await evm.snapshot();
    });

    // Runs before any beforeEach() calls made within the d1ArcDescribe() call.
    beforeEach(async () => {
      await evm.resetEVM(postInitSnapshotId);
    });

    // Runs before any after() calls made within the d1ArcDescribe() call.
    afterEach(async () => {
      await evm.resetEVM(postInitSnapshotId);
    });

    tests(ctx);
  });
}
