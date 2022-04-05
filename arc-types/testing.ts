import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { MockContract } from 'ethereum-waffle';
import { AddressAccrual } from '@src/typings/AddressAccrual';

import { TestToken } from '@src/typings/TestToken';
import {
  MockSapphireCoreV1,
  MockSapphirePassportScores,
  SapphireAssessor,
  SapphireMapperLinear,
  SapphirePool,
} from '@src/typings';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { MockSapphireOracle } from '@src/typings/MockSapphireOracle';

export interface TestingSigners {
  admin: SignerWithAddress;
  borrower: SignerWithAddress;
  interestSetter: SignerWithAddress;
  merkleRootUpdater: SignerWithAddress;
  liquidator: SignerWithAddress;
  staker: SignerWithAddress;
  feeCollector: SignerWithAddress;
  globalOperator: SignerWithAddress;
  positionOperator: SignerWithAddress;
  unauthorized: SignerWithAddress;
  scoredBorrower: SignerWithAddress;
  pauseOperator: SignerWithAddress;
}

export interface SDKs {
  sapphire?: SapphireTestArc;
}

export interface Contracts {
  sapphire: {
    core: MockSapphireCoreV1;
    passportScores: MockSapphirePassportScores;
    linearMapper: SapphireMapperLinear;
    assessor: SapphireAssessor;
    oracle: MockSapphireOracle;
    pool: SapphirePool;
  };
  staking: {
    addressAccrual: AddressAccrual;
  };
  stablecoin: TestToken;
  collateral: TestToken;
}

export interface Stubs {
  staking: {
    addressAccrual: MockContract;
    adminRewards: MockContract;
    rewardCampaign: MockContract;
    tokenStakingAccrual: MockContract;
  };
  oracle: MockContract;
}
