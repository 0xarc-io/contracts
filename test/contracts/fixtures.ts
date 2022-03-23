import { MAX_UINT256 } from '@src/constants';
import {
  MockSapphireCoreV1Factory,
  SapphireAssessorFactory,
  SapphireMapperLinearFactory,
} from '@src/typings';

import {
  deployArcProxy,
  deployTestToken,
  deployMockSapphireCoreV1,
  deployMockSapphireOracle,
  deployMockSapphirePassportScores,
  deploySapphirePool,
} from './deployers';

import { Signer } from 'ethers';
import { ITestContext, ITestContextArgs } from './context';
import { SapphireTestArc } from '@src/SapphireTestArc';
import {
  DEFAULT_COLLATERAL_DECIMALS,
  DEFAULT_HIGH_C_RATIO,
  DEFAULT_LOW_C_RATIO,
  DEFAULT_MAX_CREDIT_SCORE,
  DEFAULT_STABLECOIN_DECIMALS,
} from '@test/helpers/sapphireDefaults';

export async function distributorFixture(ctx: ITestContext) {
  ctx.contracts.collateral = await deployTestToken(
    ctx.signers.admin,
    'ARC GOVERNANCE',
    'ARCX',
    18,
  );
}

export async function sapphireFixture(
  ctx: ITestContext,
  args?: ITestContextArgs,
) {
  const deployer: Signer = ctx.signers.admin;
  const deployerAddress = await deployer.getAddress();

  ctx.contracts.collateral = await deployTestToken(
    deployer,
    'Test collateral',
    'COLL',
    args?.collateralDecimals ?? DEFAULT_COLLATERAL_DECIMALS,
  );

  ctx.contracts.stablecoin = await deployTestToken(
    deployer,
    'Test stablecoin',
    'TEST_USDC',
    args?.stablecoinDecimals ?? DEFAULT_STABLECOIN_DECIMALS,
  );

  ctx.contracts.sapphire.oracle = await deployMockSapphireOracle(deployer);

  const coreImp = await deployMockSapphireCoreV1(deployer);
  const coreProxy = await deployArcProxy(
    deployer,
    coreImp.address,
    deployerAddress,
    [],
  );

  ctx.contracts.sapphire.pool = await deploySapphirePool(deployer);
  await ctx.contracts.sapphire.pool.init('Creds', 'CR');

  ctx.contracts.sapphire.linearMapper = await new SapphireMapperLinearFactory(
    deployer,
  ).deploy();

  ctx.contracts.sapphire.passportScores = await deployMockSapphirePassportScores(
    deployer,
  );

  await ctx.contracts.sapphire.passportScores.init(
    '0x1111111111111111111111111111111111111111111111111111111111111111',
    ctx.signers.merkleRootUpdater.address,
    ctx.signers.pauseOperator.address,
    0,
  );

  await ctx.contracts.sapphire.passportScores
    .connect(ctx.signers.pauseOperator)
    .setPause(false);

  ctx.contracts.sapphire.assessor = await new SapphireAssessorFactory(
    deployer,
  ).deploy(
    ctx.contracts.sapphire.linearMapper.address,
    ctx.contracts.sapphire.passportScores.address,
    DEFAULT_MAX_CREDIT_SCORE,
  );

  ctx.contracts.sapphire.core = MockSapphireCoreV1Factory.connect(
    coreProxy.address,
    deployer,
  );
  await ctx.contracts.sapphire.core.init(
    ctx.contracts.collateral.address,
    ctx.contracts.sapphire.oracle.address,
    ctx.signers.interestSetter.address,
    ctx.signers.pauseOperator.address,
    ctx.contracts.sapphire.assessor.address,
    ctx.signers.feeCollector.address,
    DEFAULT_HIGH_C_RATIO,
    DEFAULT_LOW_C_RATIO,
  );

  await ctx.contracts.sapphire.core.setBorrowPool(
    ctx.contracts.sapphire.pool.address,
  );

  await ctx.contracts.sapphire.core
    .connect(ctx.signers.pauseOperator)
    .setPause(false);

  ctx.sdks.sapphire = SapphireTestArc.new(deployer);
  await ctx.sdks.sapphire.addCores({ sapphireCore: coreProxy.address });
}
