import { MAX_UINT256 } from '@src/constants';
import { SyntheticTokenV1Factory } from '@src/typings/SyntheticTokenV1Factory';
import { MozartV1Factory } from '@src/typings/MozartV1Factory';
import ArcDecimal from '@src/utils/ArcDecimal';

import {
  deployArcProxy,
  deployMockMozartCoreV1,
  deploySpritzCoreV4,
  deployMockOracle,
  deployMockSavingsV1,
  deploySyntheticTokenV1,
  deployTestToken,
  deploySpritzStateV1,
  deployStaticSynthetic,
  deploySpritzCoreV3,
} from './deployers';

import { Signer } from 'ethers';
import { ITestContext } from './context';
import { MozartTestArc } from '@src/MozartTestArc';
import { CoreV4 } from '@src/typings/CoreV4';
import { CoreV4Factory } from '@src/typings/CoreV4Factory';
import { SpritzTestArc } from '../../src/SpritzTestArc';

export async function mozartFixture(ctx: ITestContext) {
  const deployer: Signer = ctx.signers.admin;
  const deployerAddress = await deployer.getAddress();

  const coreImp = await deployMockMozartCoreV1(deployer);
  const syntheticImp = await deploySyntheticTokenV1(deployer);

  const collateral = await deployTestToken(deployer, 'Test', 'TEST');
  const oracle = await deployMockOracle(deployer);

  const coreProxy = await deployArcProxy(deployer, coreImp.address, deployerAddress, []);
  const syntheticProxy = await deployArcProxy(deployer, syntheticImp.address, deployerAddress, []);

  const coreV1 = await new MozartV1Factory(deployer).attach(coreProxy.address);
  await coreV1.init(
    collateral.address,
    syntheticProxy.address,
    oracle.address,
    deployerAddress,
    ArcDecimal.new(2),
    ArcDecimal.new(0),
    ArcDecimal.new(0),
  );

  const savingsV1 = await deployMockSavingsV1(deployer, coreProxy.address, syntheticProxy.address);

  const synthetic = await new SyntheticTokenV1Factory(deployer).attach(syntheticProxy.address);
  await synthetic.addMinter(coreV1.address, MAX_UINT256);
  await synthetic.addMinter(savingsV1.address, MAX_UINT256);

  ctx.contracts.mozart.coreV1 = coreV1;
  ctx.contracts.mozart.savingsV1 = savingsV1;
  ctx.contracts.collateral = collateral;
  ctx.contracts.synthetic.tokenV1 = synthetic;
  ctx.contracts.oracle = oracle;

  ctx.sdks.mozart = await MozartTestArc.init(deployer);
  await ctx.sdks.mozart.addSynths({ ETHX: coreV1.address });
}

export async function spritzFixture(ctx: ITestContext) {
  const deployer: Signer = ctx.signers.admin;
  const deployerAddress = await deployer.getAddress();

  const coreV3Imp = await deploySpritzCoreV3(deployer);
  const corev4Imp = await deploySpritzCoreV4(deployer);
  const coreProxy = await deployArcProxy(deployer, corev4Imp.address, deployerAddress, []);
  const core = await new CoreV4Factory(deployer).attach(coreProxy.address);

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
  ctx.contracts.spritz.coreV4 = corev4Imp;
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
