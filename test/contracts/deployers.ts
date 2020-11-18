import { Signer } from 'ethers';
import { ethers } from 'hardhat';

import ArcDecimal from '@src/utils/ArcDecimal';

import { MockOracleFactory } from '@src/typings/MockOracleFactory';
import { TestTokenFactory } from '@src/typings/TestTokenFactory';
import { ArcProxyFactory } from '@src/typings/ArcProxyFactory';
import { MockMozartV1 } from '@src/typings/MockMozartV1';
import { SyntheticTokenV1 } from '@src/typings/SyntheticTokenV1';
import { MockMozartSavingsV1 } from '@src/typings/MockMozartSavingsV1';

export async function deployMockMozartCoreV1(deployer: Signer) {
  const MockMozartV1 = await ethers.getContractFactory('MockMozartV1', deployer);
  const mozartCoreV1 = await MockMozartV1.deploy();
  return mozartCoreV1 as MockMozartV1;
}

export async function deploySyntheticTokenV1(deployer: Signer) {
  const SyntheticTokenV1 = await ethers.getContractFactory('SyntheticTokenV1', deployer);
  const syntheticTokenV1 = await SyntheticTokenV1.deploy();
  return syntheticTokenV1 as SyntheticTokenV1;
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
  const MockMozartSavingsV1 = await ethers.getContractFactory('MockMozartSavingsV1', deployer);
  const savingsV1 = await MockMozartSavingsV1.deploy(
    core,
    stakeToken,
    await deployer.getAddress(),
    ArcDecimal.new(0),
  );
  return savingsV1 as MockMozartSavingsV1;
}
