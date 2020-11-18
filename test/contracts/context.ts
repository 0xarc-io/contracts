import { ethers } from 'hardhat';
import { Contracts, Stubs, TestingSigners, SDKs } from '@arc-types/testing';
import { EVM } from '@test/helpers/EVM';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

export interface ITestContext {
  signers: TestingSigners;
  contracts: Contracts;
  sdks: SDKs;
  evm: EVM;
  postInitSnapshotId?: string;
}

const provider = ethers.provider;
const evm = new EVM(provider);

export type fixtureFunction = (ctx: ITestContext) => Promise<void>;
export type initFunction = (ctx: ITestContext) => Promise<void>;

export async function generateContext(fixture: fixtureFunction, init: initFunction) {
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

  await fixture(ctx);
  await init(ctx);

  ctx.postInitSnapshotId = await evm.snapshot();

  return ctx;
}
