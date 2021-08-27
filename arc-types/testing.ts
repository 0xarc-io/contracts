import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { MockContract } from 'ethereum-waffle';
import { AddressAccrual } from '@src/typings/AddressAccrual';
import { MockOracle } from '@src/typings/MockOracle';

import { TestToken } from '@src/typings/TestToken';
import { SpritzTestArc } from '@src/SpritzTestArc';
import { MozartTestArc } from '@src/MozartTestArc';
import {
  MockMozartCoreV2,
  MockMozartSavingsV2,
  MockSapphireCoreV1,
  MockSapphireCreditScore,
  SapphireAssessor,
  SapphireMapperLinear,
  SyntheticTokenV2,
} from '@src/typings';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { MockSapphireOracle } from '@src/typings/MockSapphireOracle';

export interface TestingSigners {
  admin: SignerWithAddress;
  minter: SignerWithAddress;
  interestSetter: SignerWithAddress;
  liquidator: SignerWithAddress;
  staker: SignerWithAddress;
  feeCollector: SignerWithAddress;
  globalOperator: SignerWithAddress;
  positionOperator: SignerWithAddress;
  unauthorized: SignerWithAddress;
  scoredMinter: SignerWithAddress;
  pauseOperator: SignerWithAddress;
}

export interface SDKs {
  spritz?: SpritzTestArc;
  mozart?: MozartTestArc;
  sapphire?: SapphireTestArc;
}

export interface Contracts {
  spritz: {
    coreV1: CoreV1;
    coreV2: CoreV2;
    coreV3: CoreV3;
    coreV4: CoreV4;
    state: StateV1;
    oracle: MockOracle;
  };
  mozart: {
    core: MockMozartCoreV2;
    savings: MockMozartSavingsV2;
    oracle: MockOracle;
  };
  sapphire: {
    core: MockSapphireCoreV1;
    creditScore: MockSapphireCreditScore;
    linearMapper: SapphireMapperLinear;
    assessor: SapphireAssessor;
    oracle: MockSapphireOracle;
  };
  synthetic: {
    static: StaticSyntheticToken;
    tokenV1: SyntheticTokenV1;
    tokenV2: SyntheticTokenV2;
  };
  staking: {
    addressAccrual: AddressAccrual;
    adminRewards: AdminRewards;
    rewardCampaign: RewardCampaign;
    tokenStakingAccrual: TokenStakingAccrual;
  };
  collateral: TestToken;
}

export interface Stubs {
  spritz: {
    coreV1: MockContract;
    coreV2: MockContract;
    coreV3: MockContract;
    coreV4: MockContract;
    state: MockContract;
  };
  mozart: {
    coreV1: MockContract;
    savingsV1: MockContract;
  };
  synthetic: {
    static: MockContract;
    tokenV1: MockContract;
  };
  staking: {
    addressAccrual: MockContract;
    adminRewards: MockContract;
    rewardCampaign: MockContract;
    tokenStakingAccrual: MockContract;
  };
  oracle: MockContract;
}
