import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  JointCampaign,
  JointCampaignFactory,
  LiquidityCampaign,
  LiquidityCampaignFactory,
  RewardCampaign,
  RewardCampaignFactory,
} from '@src/typings';

import ArcDecimal from '@src/utils/ArcDecimal';
import { utils } from 'ethers';

export default {
  'Pool-5': {
    type: 'RewardCampaign',
    source: 'RewardCampaign',
    stakingToken: '0x1bcce9e2fd56e8311508764519d28e6ec22d4a47',
    rewardsToken: 'ArcxToken',
    rewardsDurationSeconds: 2678400,
    coreContracts: ['yUSD-STABLEx', 'cUSDC-STABLEx'],
    getDeployTx: (signer: SignerWithAddress) =>
      new RewardCampaignFactory(signer).getDeployTransaction(),
    runInit: (
      contract: RewardCampaign,
      arcDao: string,
      ultimateOwner: string,
      rewardTokenAddress,
      stakingTokenAddress,
    ) => {
      const config = {
        daoAllocation: '330000000000000000',
        slasherCut: '100000000000000000',
        vestingEndDate: '1617829388',
        debtToStake: '1000000',
      };

      return contract.init(
        arcDao,
        ultimateOwner,
        rewardTokenAddress,
        stakingTokenAddress,
        { value: config.daoAllocation },
        { value: config.slasherCut },
        config.vestingEndDate,
        config.debtToStake,
      );
    },
  },
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
  'Pool-7': {
    source: 'JointCampaign',
    stakingToken: '0x6c0ffb49AD9072F253e254445CFD829BCb8A1b5d',
    rewardsToken: 'ArcxToken',
    rewardsDurationSeconds: 60 * 60 * 24 * 31, // 31 days
    contractFactory: JointCampaignFactory,
    getDeployTx: (signer: SignerWithAddress) =>
      new JointCampaignFactory(signer).getDeployTransaction(),
    runInit(
      contract: JointCampaign,
      arcDao: string,
      arcRewardsDistributor: string,
      arcTokenAddress: string,
    ) {
      const partnerRewardsDistributor =
        '0x6140182B2536AE7B6Cfcfb2d2bAB0f6Fe0D7b58E';
      const partnerTokenAddress = '0x5a98fcbea516cf06857215779fd812ca3bef1b32';
      const daoAllocation = ArcDecimal.new(0.4);
      const slashersCut = ArcDecimal.new(0.05);
      const stakeToDebtRatio = 2;
      const arcStateContract = '0xC466Ec062D554BEB42f1766488F7345261C63616';

      return contract.init(
        arcDao,
        arcRewardsDistributor,
        partnerRewardsDistributor,
        arcTokenAddress,
        partnerTokenAddress,
        this.stakingToken,
        daoAllocation,
        slashersCut,
        stakeToDebtRatio,
        arcStateContract,
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
