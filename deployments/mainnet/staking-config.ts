import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  LiquidityCampaign,
  LiquidityCampaignFactory,
  RewardCampaign,
  RewardCampaignFactory,
} from '@src/typings';
import ArcDecimal from '@src/utils/ArcDecimal';

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

      return contract.init(arcDao, rewardsDistributor, rewardsTokenAddress, stakingTokenAddress, {
        value: daoAllocation,
      });
    },
  },
};
