import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  LiquidityCampaign,
  LiquidityCampaignFactory,
  LiquidityCampaignV2,
  LiquidityCampaignV2Factory,
  RewardCampaign,
  RewardCampaignFactory,
} from '@src/typings';

export default {
  'TestPool-1': {
    type: 'RewardCampaign',
    source: 'RewardCampaign',
    stakingToken: '',
    rewardsToken: 'ArcxToken',
    rewardsDurationSeconds: 604800,
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
  'TestPool-2': {
    source: 'LiquidityCampaign',
    stakingToken: '',
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
  PermittablePool: {
    source: 'LiquidityCampaignV2',
    stakingToken: '',
    rewardsToken: 'ArcxTokenV2',
    rewardsDurationSeconds: 60 * 60 * 24 * 31, // 31 days
    contractFactory: LiquidityCampaignV2Factory,
    getDeployTx: (signer: SignerWithAddress) =>
      new LiquidityCampaignV2Factory(signer).getDeployTransaction(),
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
