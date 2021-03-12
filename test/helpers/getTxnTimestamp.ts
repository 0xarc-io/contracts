import { ITestContext } from "@test/contracts/context";

export async function getTxnTimestamp(ctx: ITestContext, transaction): Promise<number> {
  const block = await ctx.signers.admin.provider.getBlock((await transaction).blockHash);
  return block.timestamp;
}
