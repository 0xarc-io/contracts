import 'module-alias/register';
import { expect } from 'chai';
import { MockProvider } from 'ethereum-waffle';
import deployments from '../../deployments/mainnet/deployed.json';
import { OwnableFactory } from '@src/typings/OwnableFactory';
import { AdminableFactory } from '@src/typings';

/* eslint-disable @typescript-eslint/no-var-requires */
const hre = require('hardhat');

describe('Ownable contracts', () => {
  const expectedOwner = hre.config.networks.mainnet.users.eoaOwner;

  const provider = new MockProvider({
    ganacheOptions: {
      fork: 'https://eth-mainnet.alchemyapi.io/v2/HSgFSArdYblhAJVgM8F820KLd65jiFzc',
    },
  });

  describe('contracts have owner', () => {
    for (const deployment of deployments) {
      const shouldBeOwnable = (source: string) => {
        return [
          'StateV1',
          'KYF',
          'KYFV2',
          'SavingsRegistry',
          'SynthRegistry',
          'SynthRegistryV2',
          'AddressAccrual',
          'StakingRewardsAccrualCapped',
          'AdminRewards',
          'ArcxToken',
          'KYFToken',
          'SkillsetToken',
          'StaticSyntheticToken',
          // 'ArcUniswapV2Oracle',
        ].includes(source);
      };

      if (shouldBeOwnable(deployment.source)) {
        it(`${deployment.group} ${deployment.name} ${deployment.address}`, async () => {
          const owner = await OwnableFactory.connect(deployment.address, provider).owner();
          expect(owner.toLowerCase()).eq(expectedOwner);
        });
      }
    }
  });

  describe('contracts have admin', () => {
    const shouldBeAdminable = (source: string) => {
      return [
        'MozartCoreV1',
        'MozartCoreV2',
        'MozartSavingsV1',
        'MozartSavingsV2',
        'CoreV1',
        'CoreV2',
        'CoreV3',
        'CoreV4',
        'SkillsetMetadata',
        'RewardCampaign',
        'SyntheticTokenV1',
      ].includes(source);
    };

    for (const deployment of deployments) {
      if (shouldBeAdminable(deployment.source)) {
        it(`${deployment.group} ${deployment.name} ${deployment.address}`, async () => {
          const admin = await AdminableFactory.connect(deployment.address, provider).getAdmin();
          expect(admin).eq('0x0000000000000000000000000000000000000000');
        });
      } else if (['ArcProxy'].includes(deployment.source)) {
        it(`${deployment.group} ${deployment.name} ${deployment.address}`, async () => {
          const admin = await AdminableFactory.connect(deployment.address, provider).getAdmin();
          expect(admin.toLowerCase()).eq(expectedOwner);
        });
      }
    }
  });
});
