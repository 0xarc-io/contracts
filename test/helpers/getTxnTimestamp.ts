import { ITestContext } from "@test/contracts/context";

export async function getTxnTimestamp(ctx: ITestContext, updateMerkleRootTxn): Promise<number> {
  const block = await ctx.signers.admin.provider.getBlock((await updateMerkleRootTxn).blockHash);
  return block.timestamp;
}
