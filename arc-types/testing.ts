import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { CoreV1 } from '@src/typings/CoreV1';
import { CoreV2 } from '@src/typings/CoreV2';
import { CoreV3 } from '@src/typings/CoreV3';
import { CoreV4 } from '@src/typings/CoreV4';
import { StateV1 } from '@src/typings/StateV1';

import { MockContract } from 'ethereum-waffle';
import { StaticSyntheticToken } from '@src/typings/StaticSyntheticToken';
import { SyntheticTokenV1 } from '@src/typings/SyntheticTokenV1';
import { RewardCampaign } from '@src/typings/RewardCampaign';
import { TokenStakingAccrual } from '@src/typings/TokenStakingAccrual';
import { AdminRewards } from '@src/typings/AdminRewards';
import { AddressAccrual } from '@src/typings/AddressAccrual';
import { MockOracle } from '@src/typings/MockOracle';

import { TestToken } from '@src/typings/TestToken';
import { SpritzTestArc } from '@src/SpritzTestArc';
import { MozartTestArc } from '@src/MozartTestArc';
import { MockMozartSavingsV2 } from '@src/typings';
import { MockMozartCoreV1 } from '@src/typings/MockMozartCoreV1';

export interface TestingSigners {
  admin: SignerWithAddress;
  minter: SignerWithAddress;
  interestSetter: SignerWithAddress;
  liquidator: SignerWithAddress;
  staker: SignerWithAddress;
  revenue: SignerWithAddress;
  globalOperator: SignerWithAddress;
  positionOperator: SignerWithAddress;
  unauthorised: SignerWithAddress;
}

export interface SDKs {
  spritz?: SpritzTestArc;
  mozart?: MozartTestArc;
}

export interface Contracts {
  spritz: {
    coreV1: CoreV1;
    coreV2: CoreV2;
    coreV3: CoreV3;
    coreV4: CoreV4;
    state: StateV1;
  };
  mozart: {
    core: MockMozartCoreV1;
    savings: MockMozartSavingsV2;
  };
  synthetic: {
    static: StaticSyntheticToken;
    tokenV1: SyntheticTokenV1;
  };
  staking: {
    addressAccrual: AddressAccrual;
    adminRewards: AdminRewards;
    rewardCampaign: RewardCampaign;
    tokenStakingAccrual: TokenStakingAccrual;
  };
  collateral: TestToken;
  oracle: MockOracle;
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
