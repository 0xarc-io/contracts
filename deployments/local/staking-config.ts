import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { LiquidityCampaign, LiquidityCampaignFactory } from '@src/typings';

import { utils } from 'ethers';

export default {
  'Pool-6': {
    source: 'LiquidityCampaign',
    stakingToken: '0x6c0ffb49AD9072F253e254445CFD829BCb8A1b5d',
    rewardsToken: 'ArcxToken',
    rewardsDurationSeconds: 60 * 60 * 24 * 31, // 31 days
    contractFactory: LiquidityCampaignFactory,
    getDeployTx: (signer: SignerWithAddress) =>
      new LiquidityCampaignFactory(signer).getDeployTransaction(),
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
    contractFactory: LiquidityCampaignFactory,
    getDeployTx: (signer: SignerWithAddress) =>
      new LiquidityCampaignFactory(signer).getDeployTransaction(),
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
  JointPassportPool: {
    source: 'JointPassportCampaign',
    arcRewardsDistributor: '',
    collabRewardsDistributor: '',
    stakingToken: '0x1dC4c1cEFEF38a777b15aA20260a54E584b16C48',
    rewardsToken: 'ArcxTokenV2',
    collabRewardsToken: '0x1dC4c1cEFEF38a777b15aA20260a54E584b16C48',
    daoAllocation: utils.parseEther('0.4'),
    maxStakePerUser: 0,
    creditScoreThreshold: 500,
    rewardsDurationSeconds: 30 * 24 * 60 * 60,
  },
};
