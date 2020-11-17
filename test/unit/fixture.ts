import { MAX_UINT256 } from '../../src/constants';
import { SyntheticTokenV1Factory } from '../../src/typings';
import { MockOracle } from '../../src/typings/MockOracle';
import { MozartSavingsV1 } from '../../src/typings/MozartSavingsV1';
import { MozartV1 } from '../../src/typings/MozartV1';
import { MozartV1Factory } from '../../src/typings/MozartV1Factory';
import { SyntheticTokenV1 } from '../../src/typings/SyntheticTokenV1';
import { TestToken } from '../../src/typings/TestToken';
import ArcDecimal from '../../src/utils/ArcDecimal';

import {
  deployArcProxy,
  deployMockMozartCoreV1,
  deployMockOracle,
  deployMockSavingsV1,
  deploySyntheticTokenV1,
  deployTestToken,
} from '../deployers';

import { Signer } from 'ethers';

type UnitFixtureMozartReturnType = {
  coreV1: MozartV1;
  synthetic: SyntheticTokenV1;
  collateral: TestToken;
  oracle: MockOracle;
  savingsV1: MozartSavingsV1;
};

export async function unitFixtureMozart(signers: Signer[]): Promise<UnitFixtureMozartReturnType> {
  const deployer: Signer = signers[0];
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

  return { coreV1, synthetic, collateral, oracle, savingsV1 };
}
