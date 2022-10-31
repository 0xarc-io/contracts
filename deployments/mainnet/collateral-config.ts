import { CoreConfig } from '@deployments/types';
import { ChainLinkOracleFactory } from '@src/typings';
import { Signer, utils } from 'ethers';

const config: Record<string, CoreConfig> = {
  'WETH-A': {
    collateralAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    borrowPool: '0x3acd681eBB2b71422d6359Ded59EaC71a1f613d7',
    oracle: {
      source: 'ChainLinkOracle',
      getDeployTx: (signer: Signer) =>
        new ChainLinkOracleFactory(signer).getDeployTransaction(
          '0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419',
        ),
      constructorArguments: ['0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419'],
    },
    borrowRatios: {
      highCRatio: utils.parseEther('1.25'),
      lowCRatio: utils.parseEther('1.111111111111111111'),
    },
    fees: {
      borrowFee: utils.parseEther('0.001'),
      liquidationArcFee: utils.parseEther('0.5'),
      liquidatorDiscount: utils.parseEther('0.1'),
      poolInterestFee: utils.parseEther('0.9'),
    },
    limits: {
      vaultBorrowMax: utils.parseEther('100000'),
      defaultBorrowLimit: '0',
    },
    interestSettings: {
      interestRate: '937303470',
    },
  },
  'WETH-B': {
    collateralAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    borrowPool: '0x3B094f5fE47998d43f3D55f7F5f455098de2f3C8',
    oracle: '0xb45608C38291971f0B790e6B0e5D64033eA61F53',
    borrowRatios: {
      highCRatio: utils.parseEther('1.3336889837'),
      lowCRatio: utils.parseEther('1.0526315789'),
    },
    fees: {
      borrowFee: utils.parseEther('0.0025'),
      liquidationArcFee: utils.parseEther('0.2'),
      liquidatorDiscount: utils.parseEther('0.05'),
      poolInterestFee: utils.parseEther('0.9'),
    },
    limits: {
      vaultBorrowMax: utils.parseEther('100000'),
      defaultBorrowLimit: '0',
    },
    interestSettings: {
      interestRate: '627937192',
    },
    creditLimitProofProtocol: 'arcx.limit.137.weth.b',
  },
  'WETH-C': {
    collateralAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    borrowPool: '0xD9c4d6e97e4A2cFCc5b569AB857E75C25F58c385',
    oracle: '0xb45608C38291971f0B790e6B0e5D64033eA61F53',
    borrowRatios: {
      highCRatio: utils.parseEther('1.6700206248'),
      lowCRatio: utils.parseEther('1'),
    },
    fees: {
      borrowFee: utils.parseEther('0.005'),
      liquidationArcFee: utils.parseEther('0'),
      liquidatorDiscount: utils.parseEther('0.05'),
      poolInterestFee: utils.parseEther('0.9'),
    },
    limits: {
      vaultBorrowMax: utils.parseEther('100000'),
      defaultBorrowLimit: '0',
    },
    interestSettings: {
      interestRate: '315522921',
    },
    creditLimitProofProtocol: 'arcx.limit.137.weth.c',
  },
};

export default config;
