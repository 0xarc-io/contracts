import { CollateralConfigMap } from '@deployments/types';
import { ChainLinkOracleFactory } from '@src/typings';
import { Signer, utils } from 'ethers';

const collateralConfig: CollateralConfigMap = {
  WETH: {
    collateralAddress: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    borrowPool: '0x59b8a21A0B0cE87E308082Af6fFC4205b5dC932C',
    oracle: {
      source: 'ChainLinkOracle',
      getDeployTx: (signer: Signer) =>
        new ChainLinkOracleFactory(signer).getDeployTransaction(
          '0xF9680D99D6C9589e2a93a78A04A279e509205945',
        ),
      constructorArguments: ['0xF9680D99D6C9589e2a93a78A04A279e509205945'],
    },
    borrowRatios: {
      highCRatio: utils.parseEther('2'),
      lowCRatio: utils.parseEther('1.4285714285'),
    },
    fees: {
      liquidatorDiscount: utils.parseEther('0.1'),
      poolInterestFee: utils.parseEther('0.5'),
      liquidationArcFee: utils.parseEther('0.4'),
      borrowFee: utils.parseEther('0.0005'),
    },
    limits: {
      vaultBorrowMax: utils.parseEther('100000'),
      defaultBorrowLimit: utils.parseEther('5000'),
    },
    interestSettings: {
      interestRate: '1547125957',
    },
  },
  'WETH-B': {
    collateralAddress: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    borrowPool: '0x1321f1f1aa541A56C31682c57b80ECfCCd9bB288',
    oracle: '0x45e3875E434043670f8760e5e27cF170BE3BAFdf',
    borrowRatios: {
      highCRatio: utils.parseEther('1.4285714285'), // 70%
      lowCRatio: utils.parseEther('1.0526315789'), // 95% LTV
    },
    fees: {
      liquidatorDiscount: utils.parseEther('0.1'),
      poolInterestFee: utils.parseEther('0.5'),
      liquidationArcFee: utils.parseEther('0.5'),
      borrowFee: utils.parseEther('0.0005'),
    },
    limits: {
      vaultBorrowMax: utils.parseEther('100000'),
      defaultBorrowLimit: 0,
    },
    interestSettings: {
      interestRate: '937303470', // 3%
    },
  },
  'WETH-C': {
    collateralAddress: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    borrowPool: '0x69b37541d1C00c949B530ccd3d23437188767160',
    oracle: '0x45e3875E434043670f8760e5e27cF170BE3BAFdf',
    borrowRatios: {
      highCRatio: utils.parseEther('1.4285714285'), // 70%
      lowCRatio: utils.parseEther('1'), // 100% LTV
    },
    fees: {
      liquidatorDiscount: utils.parseEther('0.1'),
      poolInterestFee: utils.parseEther('0.5'),
      liquidationArcFee: utils.parseEther('0.5'),
      borrowFee: utils.parseEther('0.0005'),
    },
    limits: {
      vaultBorrowMax: utils.parseEther('100000'),
      defaultBorrowLimit: 0,
    },
    interestSettings: {
      interestRate: '315522921', // 1%
    },
  },
};

export default collateralConfig;
