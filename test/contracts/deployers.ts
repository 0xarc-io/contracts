import { BigNumberish, Signer } from 'ethers';
import { ethers } from 'hardhat';

import ArcDecimal from '@src/utils/ArcDecimal';

import { MockOracleFactory } from '@src/typings/MockOracleFactory';
import { TestTokenFactory } from '@src/typings/TestTokenFactory';
import { ArcProxyFactory } from '@src/typings/ArcProxyFactory';
import { MockMozartV1 } from '@src/typings/MockMozartV1';
import { SyntheticTokenV1 } from '@src/typings/SyntheticTokenV1';
import { MockMozartSavingsV1 } from '@src/typings/MockMozartSavingsV1';
import { CoreV4 } from '@src/typings/CoreV4';
import { StateV1 } from '@src/typings/StateV1';
import { StaticSyntheticToken } from '@src/typings/StaticSyntheticToken';
import { CoreV3 } from '@src/typings/CoreV3';
import { AddressAccrual } from '@src/typings/AddressAccrual';
import { MockRewardCampaign } from '@src/typings/MockRewardCampaign';
import { TokenStakingAccrual } from '@src/typings/TokenStakingAccrual';
import { Kyfv2 } from '@src/typings/Kyfv2';

export async function deployMockMozartCoreV1(deployer: Signer) {
  const MockMozartV1 = await ethers.getContractFactory('MockMozartV1', deployer);
  const mozartCoreV1 = await MockMozartV1.deploy();
  return mozartCoreV1 as MockMozartV1;
}

export async function deploySpritzCoreV3(deployer: Signer) {
  const CoreV3 = await ethers.getContractFactory('CoreV3', deployer);
  const coreV3 = await CoreV3.deploy();
  return coreV3 as CoreV3;
}

export async function deploySpritzCoreV4(deployer: Signer) {
  const CoreV4 = await ethers.getContractFactory('CoreV4', deployer);
  const coreV4 = await CoreV4.deploy();
  return coreV4 as CoreV4;
}

export async function deploySpritzStateV1(
  deployer: Signer,
  core: string,
  collateral: string,
  synthetic: string,
  oracle: string,
  collateralRatio: BigNumberish,
  liquidationArcFee: BigNumberish,
  liquidationUserFee: BigNumberish,
) {
  const StateV1 = await ethers.getContractFactory('StateV1', deployer);
  // new StateV1Factory().deploy()
  const coreV4 = await StateV1.deploy(
    core,
    collateral,
    synthetic,
    oracle,
    {
      collateralRatio: { value: collateralRatio },
      liquidationArcFee: { value: liquidationArcFee },
      liquidationUserFee: { value: liquidationUserFee },
    },
    {
      collateralLimit: 0,
      syntheticLimit: 0,
      positionCollateralMinimum: 0,
    },
  );
  return coreV4 as StateV1;
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

export async function deployStaticSynthetic(deployer: Signer) {
  const StaticSyntheticToken = await ethers.getContractFactory('StaticSyntheticToken', deployer);
  const staticSyntheticToken = await StaticSyntheticToken.deploy('Synth', 'SYNTHUS');
  return staticSyntheticToken as StaticSyntheticToken;
}

export async function deployAddressAccrual(deployer: Signer, rewardToken: string) {
  const AddressAccrual = await ethers.getContractFactory('AddressAccrual', deployer);
  const addressAccrual = await AddressAccrual.deploy(rewardToken);
  return addressAccrual as AddressAccrual;
}

export async function deployMockRewardCampaign(
  deployer: Signer,
  dao: string,
  distributor: string,
  rewardToken: string,
  stakingToken: string,
) {
  const MockRewardCampaign = await ethers.getContractFactory('MockRewardCampaign', deployer);
  const mockRewardCampaign = await MockRewardCampaign.deploy(
    dao,
    distributor,
    rewardToken,
    stakingToken,
  );
  return mockRewardCampaign as MockRewardCampaign;
}

export async function deployTokenStakingAccrual(
  deployer: Signer,
  stakingToken: string,
  rewardToken: string,
) {
  const TokenStakingAccrual = await ethers.getContractFactory('TokenStakingAccrual', deployer);
  const tokenStakingAccrual = await TokenStakingAccrual.deploy(stakingToken, rewardToken);
  return tokenStakingAccrual as TokenStakingAccrual;
}

export async function deployKyfV2(deployer: Signer) {
  const KYFV2 = await ethers.getContractFactory('KYFV2');
  const kyfv2 = await KYFV2.deploy();
  return kyfv2 as Kyfv2;
}
