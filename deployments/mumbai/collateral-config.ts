import { CollateralConfigMap } from '@deployments/types';
import { MockOracleFactory } from '@src/typings';
import { Signer, utils } from 'ethers';

const collateralConfig: CollateralConfigMap = {
  WMATIC: {
    collateralAddress: '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889',
    borrowPool: '0xb1fB649039F829Aa588bAc07411bb2D25A21E446',
    mintLimit: utils.parseEther('500000'),
    oracle: {
      source: 'MockOracle',
      getDeployTx: (signer: Signer) =>
        new MockOracleFactory(signer).getDeployTransaction(),
      constructorArguments: [],
    },
    borrowRatios: {
      highCRatio: utils.parseEther('2'),
      lowCRatio: utils.parseEther('1'),
    },
    fees: {
      liquidatorDiscount: utils.parseEther('0.1'),
      poolInterestFee: utils.parseEther('0.5'),
      liquidationArcFee: utils.parseEther('0.4'),
      borrowFee: utils.parseEther('0.005'),
    },
    limits: {
      vaultBorrowMax: utils.parseEther('100000'),
    },
    interestSettings: {
      interestRate: '1547125957',
    },
  },
};

export default collateralConfig;
