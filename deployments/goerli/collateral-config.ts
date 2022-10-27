import { CollateralConfigMap } from '@deployments/types';
import { MockSapphireOracleFactory } from '@src/typings';
import { Signer, utils } from 'ethers';

const collateralConfig: CollateralConfigMap = {
  WETH: {
    collateralAddress: '0x8572246B238f286C455525232e6a73468fCdEFe9',
    borrowPool: '0xFbD34A5f9Fe89bD0d76bD317457fe5BAcD1320a7',
    oracle: {
      source: 'MockSapphireOracle',
      getDeployTx: (signer: Signer) =>
        new MockSapphireOracleFactory(signer).getDeployTransaction(),
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
