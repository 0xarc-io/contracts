import { Signer } from 'ethers';

import {
  ArcProxyFactory,
  MockOracleFactory,
  SyntheticTokenV1Factory,
  TestTokenFactory,
} from '@src/typings';
import { MockMozartV1Factory } from '@src/typings/MockMozartV1Factory';
import { MockMozartSavingsV1Factory } from '@src/typings/MockMozartSavingsV1Factory';
import ArcDecimal from '@src/utils/ArcDecimal';

export async function deployMockMozartCoreV1(deployer: Signer) {
  const mozartCoreV1 = await new MockMozartV1Factory(deployer).deploy();
  return mozartCoreV1;
}

export async function deploySyntheticTokenV1(deployer: Signer) {
  const syntheticTokenV1 = await new SyntheticTokenV1Factory(deployer).deploy();
  return syntheticTokenV1;
}

export async function deployMockOracle(deployer: Signer) {
  const oracle = await new MockOracleFactory(deployer).deploy();
  return oracle;
}

export async function deployTestToken(deployer: Signer, name: string, symbol: string) {
  const testToken = await new TestTokenFactory(deployer).deploy(name, symbol);
  return testToken;
}

export async function deployArcProxy(deployer: Signer, logic: string, admin: string, data: any[]) {
  const arcProxy = await new ArcProxyFactory(deployer).deploy(logic, admin, data);
  return arcProxy;
}

export async function deployMockSavingsV1(deployer: Signer, core: string, stakeToken: string) {
  const savingsV1 = await new MockMozartSavingsV1Factory(deployer).deploy(
    core,
    stakeToken,
    await deployer.getAddress(),
    ArcDecimal.new(0),
  );
  return savingsV1;
}
