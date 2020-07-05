import { TestArc } from '../src/TestArc';
import { Wallet, ethers } from 'ethers';
import { generatedWallets } from '../src/utils/generatedWallets';
import { Blockchain } from '../src/utils/Blockchain';

export interface ITestContext {
  arc?: TestArc;
  wallets?: Wallet[];
}

export type initFunction = (ctx: ITestContext) => Promise<void>;
export type testsFunction = (ctx: ITestContext) => void;

const provider = new ethers.providers.JsonRpcProvider();
const blockchain = new Blockchain(provider);

export default function arcDescribe(name: string, init: initFunction, tests: testsFunction): void {
  // Note that the function passed into describe() should not be async.
  describe(name, () => {
    const ctx: ITestContext = {};

    let preInitSnapshotId: string;
    let postInitSnapshotId: string;

    // Runs before any before() calls made within the arcDescribe() call.
    before(async () => {
      ctx.wallets = generatedWallets(provider);

      const arc = await TestArc.init(ctx.wallets[0]);
      await arc.deployTestArc();
      ctx.arc = arc;

      preInitSnapshotId = await blockchain.saveSnapshotAsync();

      await init(ctx);

      // force the index to update on the next call to the arc
      await blockchain.waitBlocksAsync(1);

      postInitSnapshotId = await blockchain.saveSnapshotAsync();
    });

    // Runs before any beforeEach() calls made within the arcDescribe() call.
    beforeEach(async () => {
      await blockchain.resetAsync(postInitSnapshotId);
    });

    // Runs before any after() calls made within the arcDescribe() call.
    after(async () => {
      await blockchain.resetAsync(preInitSnapshotId);
    });

    // Runs before any afterEach() calls made within the arcDescribe() call.
    afterEach(() => {
      // // Output the gas used in each test case.
      // for (const { gasUsed, name } of ctx.arc.contracts.getGasUsedByFunction()) {
      //   const label = `${name}:`.padEnd(20, ' ');
      //   printGasUsage(label, `${gasUsed}`.padStart(9, ' '));
      // }
    });

    tests(ctx);
  });
}

function printGasUsage(label: string, value: number | string): void {
  console.log(`\t\t\x1b[33m${label} \x1b[93m${value}\x1b[0m`);
}
