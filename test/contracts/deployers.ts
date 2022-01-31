import { BigNumberish, BytesLike, Signer } from 'ethers';
import { ethers } from 'hardhat';

import { TestTokenFactory } from '@src/typings/TestTokenFactory';
import { ArcProxyFactory } from '@src/typings/ArcProxyFactory';
import { AddressAccrual } from '@src/typings/AddressAccrual';
import { TokenStakingAccrual } from '@src/typings/TokenStakingAccrual';
import { MockOracle } from '@src/typings/MockOracle';
import {
  MockSapphireCoreV1Factory,
  MockSapphirePassportScoresFactory,
} from '@src/typings';
import { MerkleDistributor } from '@src/typings/MerkleDistributor';
import { SyntheticTokenV2 } from '@src/typings/SyntheticTokenV2';
import { MockSapphireOracle } from '@src/typings/MockSapphireOracle';
import { DefiPassportFactory } from '@src/typings/DefiPassportFactory';

export async function deploySyntheticTokenV2(
  deployer: Signer,
  name: string,
  version: string,
) {
  const Contract = await ethers.getContractFactory(
    'SyntheticTokenV2',
    deployer,
  );
  const syntheticTokenV2 = await Contract.deploy(name, version);
  return syntheticTokenV2 as SyntheticTokenV2;
}

export async function deployMockOracle(deployer: Signer) {
  const Contract = await ethers.getContractFactory('MockOracle', deployer);
  const mockOracle = await Contract.deploy();
  return mockOracle as MockOracle;
}

export async function deployMockSapphireOracle(deployer: Signer) {
  const Contract = await ethers.getContractFactory(
    'MockSapphireOracle',
    deployer,
  );
  const mockOracle = await Contract.deploy();
  return mockOracle as MockSapphireOracle;
}

export async function deployTestToken(
  deployer: Signer,
  name: string,
  symbol: string,
  decimals: BigNumberish = 18,
) {
  const testToken = await new TestTokenFactory(deployer).deploy(
    name,
    symbol,
    decimals,
  );
  return testToken;
}

export async function deployArcProxy(
  deployer: Signer,
  logic: string,
  admin: string,
  data: BytesLike,
) {
  const arcProxy = await new ArcProxyFactory(deployer).deploy(
    logic,
    admin,
    data,
  );
  return arcProxy;
}

export async function deployAddressAccrual(
  deployer: Signer,
  rewardToken: string,
) {
  const Contract = await ethers.getContractFactory('AddressAccrual', deployer);
  const addressAccrual = await Contract.deploy(rewardToken);
  return addressAccrual as AddressAccrual;
}

export async function deployTokenStakingAccrual(
  deployer: Signer,
  stakingToken: string,
  rewardToken: string,
) {
  const Contract = await ethers.getContractFactory(
    'TokenStakingAccrual',
    deployer,
  );
  const tokenStakingAccrual = await Contract.deploy(stakingToken, rewardToken);
  return tokenStakingAccrual as TokenStakingAccrual;
}

export async function deployMerkleDistributor(
  deployer: Signer,
  token: string,
  merkleRoot: string,
) {
  const merkleDistributorFactory = await ethers.getContractFactory(
    'MerkleDistributor',
    deployer,
  );
  const distributor = await merkleDistributorFactory.deploy(token, merkleRoot);
  return distributor as MerkleDistributor;
}

export async function deployMockSapphirePassportScores(deployer: Signer) {
  const creditScoreImp = await new MockSapphirePassportScoresFactory(
    deployer,
  ).deploy();

  const proxy = await deployArcProxy(
    deployer,
    creditScoreImp.address,
    await deployer.getAddress(),
    [],
  );
  return MockSapphirePassportScoresFactory.connect(proxy.address, deployer);
}

export function deployMockSapphireCoreV1(deployer: Signer) {
  return new MockSapphireCoreV1Factory(deployer).deploy();
}

export async function deployDefiPassport(deployer: Signer) {
  const defiPassportImpl = await new DefiPassportFactory(deployer).deploy();

  const proxy = await deployArcProxy(
    deployer,
    defiPassportImpl.address,
    await deployer.getAddress(),
    [],
  );

  return DefiPassportFactory.connect(proxy.address, deployer);
}
