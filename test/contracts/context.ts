import 'module-alias/register';

import { ethers } from 'hardhat';
import { Contracts, TestingSigners, SDKs } from '@arc-types/testing';
import { EVM } from '@test/helpers/EVM';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BigNumberish } from '@ethersproject/bignumber';

export interface ITestContext {
  signers: TestingSigners;
  contracts: Contracts;
  sdks: SDKs;
  evm: EVM;
  postInitSnapshotId?: string;
}

export interface ITestContextArgs {
  decimals: BigNumberish;
}

const provider = ethers.provider;
const evm = new EVM(provider);

export type fixtureFunction = (ctx: ITestContext, args?: ITestContextArgs) => Promise<void>;
export type initFunction = (ctx: ITestContext, args?: ITestContextArgs) => Promise<void>;

export async function generateContext(
  fixture: fixtureFunction,
  init: initFunction,
  args: ITestContextArgs = { decimals: 18 },
) {
  const signers = {} as TestingSigners;

  const retrievedSigners: SignerWithAddress[] = await ethers.getSigners();
  signers.admin = retrievedSigners[0];
  signers.minter = retrievedSigners[1];
  signers.interestSetter = retrievedSigners[2];
  signers.liquidator = retrievedSigners[3];
  signers.staker = retrievedSigners[4];
  signers.revenue = retrievedSigners[5];
  signers.globalOperator = retrievedSigners[6];
  signers.positionOperator = retrievedSigners[7];
  signers.unauthorised = retrievedSigners[8];

  const sdks = {} as SDKs;
  const contracts = {
    mozart: {},
    spritz: {},
    synthetic: {},
  } as Contracts;

  const ctx = { signers, sdks, contracts, evm } as ITestContext;

  await fixture(ctx, args);
  await init(ctx, args);

  ctx.postInitSnapshotId = await evm.snapshot();

  return ctx;
}
