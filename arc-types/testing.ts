import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { MockContract } from 'ethereum-waffle';
import { AddressAccrual } from '@src/typings/AddressAccrual';

import { TestToken } from '@src/typings/TestToken';
import {
  MockSapphireCoreV1,
  MockSapphireCreditScore,
  MockSapphirePassportScores,
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
  merkleRootUpdater: SignerWithAddress;
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
  sapphire?: SapphireTestArc;
}

export interface Contracts {
  sapphire: {
    core: MockSapphireCoreV1;
    creditScore: MockSapphireCreditScore;
    passportScores: MockSapphirePassportScores;
    linearMapper: SapphireMapperLinear;
    assessor: SapphireAssessor;
    oracle: MockSapphireOracle;
  };
  synthetic: {
    tokenV2: SyntheticTokenV2;
  };
  staking: {
    addressAccrual: AddressAccrual;
  };
  collateral: TestToken;
}

export interface Stubs {
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
