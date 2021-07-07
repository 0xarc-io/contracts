import { BigNumber } from '@ethersproject/bignumber';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  LiquidityCampaign,
  LiquidityCampaignFactory,
  LiquidityCampaignV2,
  LiquidityCampaignV2Factory,
  PassportCampaign,
  PassportCampaignFactory,
  RewardCampaign,
  RewardCampaignFactory,
} from '@src/typings';
import { utils } from 'ethers';

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
    stakingToken: '0x969850e65A62532a4Dde8a20dB67f9E860AAA515',
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
  SapphirePassportPool: {
    source: 'PassportCampaign',
    stakingToken: '',
    rewardsToken: 'ArcxTokenV2',
    rewardsDurationSeconds: 60 * 60 * 24 * 31, // 31 days
    contractFactory: PassportCampaignFactory,
    getDeployTx: (signer: SignerWithAddress) =>
      new PassportCampaignFactory(signer).getDeployTransaction(),
    runInit: (
      contract: PassportCampaign,
      arcDao: string,
      rewardsDistributor: string,
      rewardsTokenAddress: string,
      stakingTokenAddress: string,
    ) => {
      const daoAllocation = '400000000000000000';
      const creditScoreContractAddress =
        '0x78e4177619dc5B49bE33a26D1032C85458186c35';

      // Max 1000 stake amount
      const maxStakePerUser = utils.parseEther('1000');
      // Needs a minimum of 500 credit score to participate
      const creditScoreThreshold = 500;

      return contract.init(
        arcDao,
        rewardsDistributor,
        rewardsTokenAddress,
        stakingTokenAddress,
        creditScoreContractAddress,
        daoAllocation,
        maxStakePerUser,
        creditScoreThreshold,
      );
    },
  },
  ARCxPassportPool: {
    source: 'PassportCampaign',
    stakingToken: '0x5c9DbC786ed0b7dA9a4F1F5479794C1bc01F293e',
    rewardsToken: 'ArcxTokenV2',
    rewardsDurationSeconds: 60 * 60 * 24 * 31, // 31 days
    contractFactory: PassportCampaignFactory,
    getDeployTx: (signer: SignerWithAddress) =>
      new PassportCampaignFactory(signer).getDeployTransaction(),
    runInit: (
      contract: PassportCampaign,
      arcDao: string,
      rewardsDistributor: string,
      rewardsTokenAddress: string,
      stakingTokenAddress: string,
    ) => {
      const daoAllocation = '400000000000000000';
      const creditScoreContractAddress =
        '0x78e4177619dc5B49bE33a26D1032C85458186c35';

      // Max 1000 stake amount
      const maxStakePerUser = utils.parseEther('1000');
      // Needs a minimum of 500 credit score to participate
      const creditScoreThreshold = 500;

      return contract.init(
        arcDao,
        rewardsDistributor,
        rewardsTokenAddress,
        stakingTokenAddress,
        creditScoreContractAddress,
        daoAllocation,
        maxStakePerUser,
        creditScoreThreshold,
      );
    },
  },
  JointPassportPool: {
    source: 'JointPassportCampaign',
    arcRewardsDistributor: '',
    collabRewardsDistributor: '',
    stakingToken: '0x4239228CC7DEB4dFdc8273bFF5C421af0B92DC8A',
    collabRewardsToken: '0x1Cb19E2C7a2EFB90D4A2f9b370Fc691DBA873782',
    daoAllocation: utils.parseEther('0.4'),
    maxStakePerUser: 0,
    creditScoreThreshold: 500,
    rewardsDurationSeconds: 30 * 24 * 60 * 60,
  },
};
