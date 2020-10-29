import { D1TestArc } from '../../src/D1TestArc';
import { Wallet, providers } from 'ethers';
import { ethers } from '@nomiclabs/buidler';
import { generatedWallets } from '../../src/utils/generatedWallets';
import { EVM } from './EVM';
import { D2TestArc } from '../../src/D2TestArc';

export interface ITestContext {
  arc?: D2TestArc;
  wallets?: Wallet[];
  evm?: EVM;
}

export type initFunction = (ctx: ITestContext) => Promise<void>;
export type testsFunction = (ctx: ITestContext) => void;

const provider = ethers.provider;
const evm = new EVM(provider);

export default function d2ArcDescribe(
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
      ctx.wallets = generatedWallets(provider);
      ctx.evm = evm;
      ctx.arc = await D2TestArc.init(ctx.wallets[0]);

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
