import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  JointCampaign,
  JointCampaignFactory,
  LiquidityCampaign,
  LiquidityCampaignFactory,
} from '@src/typings';
import ArcDecimal from '@src/utils/ArcDecimal';

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

      return contract.init(arcDao, rewardsDistributor, rewardsTokenAddress, stakingTokenAddress, {
        value: daoAllocation,
      });
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
      const stEthRewardsDistributor = '';
      const stEthTokenAddress = '0xae7ab96520de3a18e5e111b5eaab095312d7fe84';
      const daoAllocation = ArcDecimal.new(0.4);
      const slashersCut = ArcDecimal.new(0.3);
      const stakeToDebtRatio = 2;
      const arcStateContract = '';

      return contract.init(
        arcDao,
        arcRewardsDistributor,
        stEthRewardsDistributor,
        arcTokenAddress,
        stEthTokenAddress,
        this.stakingToken,
        daoAllocation,
        slashersCut,
        stakeToDebtRatio,
        arcStateContract,
      );
    },
  },
};
