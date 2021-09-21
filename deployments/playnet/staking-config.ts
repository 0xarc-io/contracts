import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  LiquidityCampaign,
  LiquidityCampaign__factory,
  LiquidityCampaignV2,
  LiquidityCampaignV2__factory,
} from '@src/typings';

export default {
  'Pool-6': {
    source: 'LiquidityCampaign',
    stakingToken: '0x6c0ffb49AD9072F253e254445CFD829BCb8A1b5d',
    rewardsToken: 'ArcxToken',
    rewardsDurationSeconds: 60 * 60 * 24 * 31, // 31 days
    contractFactory: LiquidityCampaign__factory,
    getDeployTx: (signer: SignerWithAddress) =>
      new LiquidityCampaign__factory(signer).getDeployTransaction(),
    runInit: (
      contract: LiquidityCampaign,
      arcDao: string,
      rewardsDistributor: string,
      rewardsTokenAddress: string,
      stakingTokenAddress: string,
    ) => {
      const daoAllocation = '400000000000000000';

      return contract.init(
        arcDao,
        rewardsDistributor,
        rewardsTokenAddress,
        stakingTokenAddress,
        {
          value: daoAllocation,
        },
      );
    },
  },
  'Pool-6.1': {
    source: 'LiquidityCampaign',
    stakingToken: '0x6c0ffb49AD9072F253e254445CFD829BCb8A1b5d',
    rewardsToken: 'ArcxToken',
    rewardsDurationSeconds: 60 * 60 * 24 * 31, // 31 days
    contractFactory: LiquidityCampaign__factory,
    getDeployTx: (signer: SignerWithAddress) =>
      new LiquidityCampaign__factory(signer).getDeployTransaction(),
    runInit: (
      contract: LiquidityCampaign,
      arcDao: string,
      rewardsDistributor: string,
      rewardsTokenAddress: string,
      stakingTokenAddress: string,
    ) => {
      const daoAllocation = '400000000000000000';

      return contract.init(
        arcDao,
        rewardsDistributor,
        rewardsTokenAddress,
        stakingTokenAddress,
        {
          value: daoAllocation,
        },
      );
    },
  },
  'Pool-8': {
    source: 'LiquidityCampaignV2',
    stakingToken: 'todo: add fake arcx token v2',
    rewardsToken: 'ArcxTokenV2',
    rewardsDurationSeconds: 60 * 60 * 24 * 31, // 31 days
    contractFactory: LiquidityCampaignV2__factory,
    getDeployTx: (signer: SignerWithAddress) =>
      new LiquidityCampaignV2__factory(signer).getDeployTransaction(),
    runInit: (
      contract: LiquidityCampaignV2,
      arcDao: string,
      rewardsDistributor: string,
      rewardsTokenAddress: string,
      stakingTokenAddress: string,
    ) => {
      const daoAllocation = '400000000000000000';

      return contract.init(
        arcDao,
        rewardsDistributor,
        rewardsTokenAddress,
        stakingTokenAddress,
        {
          value: daoAllocation,
        },
      );
    },
  },
};
