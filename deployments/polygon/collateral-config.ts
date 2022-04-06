import { CollateralConfigMap } from '@deployments/types';
import { ChainLinkOracleFactory } from '@src/typings';
import { Signer, utils } from 'ethers';

const collateralConfig: CollateralConfigMap = {
  WETH: {
    collateralAddress: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    borrowPool: '0x59b8a21A0B0cE87E308082Af6fFC4205b5dC932C',
    mintLimit: utils.parseEther('500000'),
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
};

export default collateralConfig;
