import 'module-alias/register';
import { expect } from 'chai';
import { MockProvider } from 'ethereum-waffle';
import mainnetDeployments from '../../deployments/mainnet/deployed.json';
import polygonDeployments from '../../deployments/polygon/deployed.json';
import { OwnableFactory } from '@src/typings/OwnableFactory';
import { AdminableFactory } from '@src/typings';
import { loadContract } from '../../deployments/src';

/* eslint-disable @typescript-eslint/no-var-requires */
const hre = require('hardhat');

describe('Ownable contracts (mainnet)', () => {
  const {
    eoaOwner: expectedOwner,
    multisigOwner,
    guardian,
    // arcxDeployer,
  } = hre.config.networks.mainnet.users;

  const provider = new MockProvider({
    ganacheOptions: {
      fork: process.env.MAINNET_ALCHEMY,
    },
  });

  describe('contracts owned by the eoa owner', () => {
    for (const deployment of mainnetDeployments) {
      const shouldBeOwnable = (source: string) => {
        return [
          'StateV1',
          'KYF',
          'KYFV2',
          'SavingsRegistry',
          'SynthRegistry',
          'SynthRegistryV2',
          'StakingRewardsAccrualCapped',
          'AdminRewards',
          'KYFToken',
          'SkillsetToken',
          'StaticSyntheticToken',
          // 'ArcUniswapV2Oracle',
        ].includes(source);
      };

      if (shouldBeOwnable(deployment.source)) {
        it(`${deployment.group} ${deployment.name} ${deployment.address}`, async () => {
          const owner = await OwnableFactory.connect(
            deployment.address,
            provider,
          ).owner();
          expect(owner.toLowerCase()).to.eq(expectedOwner);
        });
      }
    }
  });

  describe('contracts owned by the ARCx Protocol DAO', () => {
    for (const deployment of mainnetDeployments) {
      const shouldBeOwnable = (source: string) => {
        return ['ArcxTokenV2', 'AddressAccrual'].includes(source);
      };

      if (shouldBeOwnable(deployment.source)) {
        it(`${deployment.group} ${deployment.name} ${deployment.address}`, async () => {
          const owner = await OwnableFactory.connect(
            deployment.address,
            provider,
          ).owner();
          expect(owner.toLowerCase()).to.eq(multisigOwner);
        });
      }
    }
  });

  it('ArcxToken is owned by ArcxTokenV2', async () => {
    const arcx = loadContract({
      network: 'mainnet',
      name: 'ArcxToken',
      source: 'ArcxToken',
      type: 'global',
    });

    const arcxV2 = loadContract({
      network: 'mainnet',
      name: 'ArcxToken',
      source: 'ArcxTokenV2',
      type: 'global',
    });

    const arcxOwner = await OwnableFactory.connect(
      arcx.address,
      provider,
    ).owner();

    expect(arcxOwner).to.eq(arcxV2.address);
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

    for (const deployment of mainnetDeployments) {
      if (shouldBeAdminable(deployment.source)) {
        it(`${deployment.group} ${deployment.name} ${deployment.address}`, async () => {
          const admin = await AdminableFactory.connect(
            deployment.address,
            provider,
          ).getAdmin();
          expect(admin).eq('0x0000000000000000000000000000000000000000');
        });
      } else if (['ArcProxy'].includes(deployment.source)) {
        it(`${deployment.group} ${deployment.name} ${deployment.address}`, async () => {
          const admin = await AdminableFactory.connect(
            deployment.address,
            provider,
          ).getAdmin();
          expect(admin.toLowerCase()).to.be.oneOf(
            [
              expectedOwner,
              multisigOwner,
              guardian,
              // arcxDeployer,
            ].map((address) => address.toLowerCase()),
          );
        });
      }
    }
  });
});

describe('Ownable contracts (polygon)', () => {
  const {
    multisigOwner,
    guardian,
    arcxDeployer,
  } = hre.config.networks.polygon.users;

  const provider = new MockProvider({
    ganacheOptions: {
      fork: process.env.POLYGON_ALCHEMY,
    },
  });

  describe('Proxy contracts', () => {
    const contractsInfo = polygonDeployments.filter(
      ({ source }) => source === 'ArcProxy',
    );

    for (const contractInfo of contractsInfo) {
      it(`${contractInfo.name} ${contractInfo.address}`, async () => {
        const admin = await AdminableFactory.connect(
          contractInfo.address,
          provider,
        ).getAdmin();
        expect(admin.toLowerCase()).to.be.oneOf(
          [multisigOwner, guardian].map((address) => address.toLowerCase()),
        );
      });
    }
  });

  describe('Non-proxy contracts', () => {
    const excludedContracts = [
      'SapphirePassportScores',
      'SapphirePool',
      'SapphireMapperLinear',
      'SapphireCore',
      'ChainlinkOracleETH',
      'FlashLiquidator',
    ];

    const contractsInfo = polygonDeployments.filter(
      ({ name, source }) =>
        source !== 'ArcProxy' && !excludedContracts.includes(name),
    );

    for (const contractInfo of contractsInfo) {
      it(`${contractInfo.name} ${contractInfo.address}`, async () => {
        const owner = await OwnableFactory.connect(
          contractInfo.address,
          provider,
        ).owner();
        expect(owner.toLowerCase()).to.be.oneOf(
          [multisigOwner, guardian, arcxDeployer].map((address) =>
            address.toLowerCase(),
          ),
        );
      });
    }
  });
});
