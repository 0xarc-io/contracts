import { MAX_UINT256 } from '@src/constants';
import { SyntheticTokenV1Factory } from '@src/typings/SyntheticTokenV1Factory';
import { MozartCoreV1Factory } from '@src/typings/MozartCoreV1Factory';
import ArcDecimal from '@src/utils/ArcDecimal';

import {
  deployArcProxy,
  deploySpritzCoreV4,
  deployMockOracle,
  deploySyntheticTokenV1,
  deployTestToken,
  deploySpritzStateV1,
  deployStaticSynthetic,
  deploySpritzCoreV3,
  deployMockMozartCore,
  deployMockSavings,
} from './deployers';

import { Signer } from 'ethers';
import { ITestContext, ITestContextArgs } from './context';
import { MozartTestArc } from '@src/MozartTestArc';
import { CoreV4Factory } from '@src/typings/CoreV4Factory';
import { SpritzTestArc } from '../../src/SpritzTestArc';
import { MockMozartCoreV2Factory, MockMozartSavingsV2Factory } from '@src/typings';

export async function mozartFixture(ctx: ITestContext, args?: ITestContextArgs) {
  const deployer: Signer = ctx.signers.admin;
  const deployerAddress = await deployer.getAddress();

  const coreImp = await deployMockMozartCore(deployer);
  const syntheticImp = await deploySyntheticTokenV1(deployer);
  const savingsImp = await deployMockSavings(deployer);

  const collateral = await deployTestToken(deployer, 'Test', 'TEST', args?.decimals);
  const oracle = await deployMockOracle(deployer);

  const coreProxy = await deployArcProxy(deployer, coreImp.address, deployerAddress, []);
  const syntheticProxy = await deployArcProxy(deployer, syntheticImp.address, deployerAddress, []);
  const savingsProxy = await deployArcProxy(deployer, savingsImp.address, deployerAddress, []);

  const coreV2 = MockMozartCoreV2Factory.connect(coreProxy.address, deployer);
  await coreV2.init(
    args.decimals,
    collateral.address,
    syntheticProxy.address,
    oracle.address,
    deployerAddress,
    ArcDecimal.new(2),
    ArcDecimal.new(0),
    ArcDecimal.new(0),
  );

  const savingsV2 = MockMozartSavingsV2Factory.connect(savingsProxy.address, deployer);
  await savingsV2.init('TEST', 'TEST', syntheticProxy.address, { value: 0 });
  await savingsV2.setPaused(false);

  const synthetic = SyntheticTokenV1Factory.connect(syntheticProxy.address, deployer);
  await synthetic.addMinter(coreV2.address, MAX_UINT256);
  await synthetic.addMinter(savingsProxy.address, MAX_UINT256);

  ctx.contracts.mozart.core = coreV2;
  ctx.contracts.mozart.savings = savingsV2;
  ctx.contracts.collateral = collateral;
  ctx.contracts.synthetic.tokenV1 = synthetic;
  ctx.contracts.oracle = oracle;

  ctx.sdks.mozart = await MozartTestArc.init(deployer);
  await ctx.sdks.mozart.addSynths({ ETHX: coreV2.address });
}

export async function spritzFixture(ctx: ITestContext, args?: ITestContextArgs) {
  const deployer: Signer = ctx.signers.admin;
  const deployerAddress = await deployer.getAddress();

  const coreV3Imp = await deploySpritzCoreV3(deployer);
  const coreV4Imp = await deploySpritzCoreV4(deployer);
  const coreProxy = await deployArcProxy(deployer, coreV4Imp.address, deployerAddress, []);
  const core = CoreV4Factory.connect(coreProxy.address, deployer);

  const synth = await deployStaticSynthetic(deployer);
  const collateral = await deployTestToken(deployer, 'Test', 'TEST');
  const oracle = await deployMockOracle(deployer);

  const state = await deploySpritzStateV1(
    deployer,
    coreProxy.address,
    collateral.address,
    synth.address,
    oracle.address,
    ArcDecimal.new(2).value,
    ArcDecimal.new(0.05).value,
    ArcDecimal.new(0.05).value,
  );

  await core.init(state.address);
  await synth.addMinter(core.address);

  ctx.contracts.spritz.coreV3 = coreV3Imp;
  ctx.contracts.spritz.coreV4 = coreV4Imp;
  ctx.contracts.spritz.state = state;
  ctx.contracts.collateral = collateral;
  ctx.contracts.synthetic.static = synth;
  ctx.contracts.oracle = oracle;

  ctx.sdks.spritz = await SpritzTestArc.init(deployer, {
    core,
    state,
    syntheticAsset: synth,
    collateralAsset: collateral,
    oracle,
  });
}
