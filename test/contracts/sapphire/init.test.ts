import { MockProvider } from '@ethereum-waffle/provider';
import { Wallet } from '@ethersproject/wallet';
import {
  MockSapphireCoreV1,
  MockSapphireCoreV1Factory,
  MockSapphireOracleFactory,
  SapphireAssessorFactory,
  SapphireMapperLinearFactory,
  TestToken,
} from '@src/typings';
import { DEFAULT_MAX_CREDIT_SCORE } from '@test/helpers/sapphireDefaults';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { createFixtureLoader } from 'ethereum-waffle';
import { constants, utils } from 'ethers';
import {
  deployArcProxy,
  deployMockSapphireCoreV1,
  deployMockSapphirePassportScores,
  deploySapphirePool,
  deployTestToken,
} from '../deployers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setup([deployer, unauthorized]: Wallet[]): Promise<any> {
  const coreImp = await deployMockSapphireCoreV1(deployer);
  const coreProxy = await deployArcProxy(
    deployer,
    coreImp.address,
    deployer.address,
    [],
  );
  const sapphireCore = MockSapphireCoreV1Factory.connect(
    coreProxy.address,
    deployer,
  );
  const collateral = await deployTestToken(
    deployer,
    'Collateral Token Name',
    'CTKN6',
    6,
  );
  const synthetic = await deployTestToken(
    deployer,
    'Synthetic Token Name',
    'STKN',
  );

  const stableCoin = await deployTestToken(
    deployer,
    'Test stablecoin',
    'TEST_USDC',
    6,
  );

  return {
    sapphireCore,
    deployer,
    unauthorized,
    collateral,
    synthetic,
    stableCoin,
  };
}

describe('SapphireCore.init', () => {
  let sapphireCore: MockSapphireCoreV1;
  let deployer: Wallet;
  let unauthorized: Wallet;
  let collateral: TestToken;
  let synthetic: TestToken;
  let stableCoin: TestToken;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let init: (overrides?: any) => unknown;

  let defaultOptions;

  before(async () => {
    const provider = new MockProvider();
    ({
      sapphireCore,
      deployer,
      unauthorized,
      collateral,
      synthetic,
      stableCoin,
    } = await createFixtureLoader(provider.getWallets())(setup));

    const oracle = await new MockSapphireOracleFactory(deployer).deploy();
    const mapper = await new SapphireMapperLinearFactory(deployer).deploy();
    const creditScore = await deployMockSapphirePassportScores(deployer);
    await creditScore.init(
      '0x1111111111111111111111111111111111111111111111111111111111111111',
      Wallet.createRandom().address,
      Wallet.createRandom().address,
      0,
    );
    const assessor = await new SapphireAssessorFactory(deployer).deploy(
      mapper.address,
      creditScore.address,
      DEFAULT_MAX_CREDIT_SCORE,
    );
    const pool = await deploySapphirePool(deployer);

    defaultOptions = {
      collateralAddress: collateral.address,
      syntheticAddress: synthetic.address,
      stableCoinAddress: stableCoin.address,
      oracle: oracle.address,
      interestSetter: Wallet.createRandom().address,
      assessor: assessor.address,
      borrowPool: pool.address,
      pauseOperator: Wallet.createRandom().address,
      highCollateralRatio: constants.WeiPerEther.mul(2),
      lowCollateralRatio: constants.WeiPerEther,
      liquidationUserRatio: utils.parseEther('0.1'),
      liquidationArcRatio: utils.parseEther('0.2'),
      executor: deployer,
      feeCollector: Wallet.createRandom().address,
    };

    init = (overrides) => {
      const options = {
        ...defaultOptions,
        ...overrides,
      };

      return sapphireCore
        .connect(options.executor)
        .init(
          options.collateralAddress,
          options.syntheticAddress,
          options.stableCoinAddress,
          options.oracle,
          options.interestSetter,
          options.pauseOperator,
          options.assessor,
          options.feeCollector,
          options.highCollateralRatio,
          options.lowCollateralRatio,
          options.liquidationUserRatio,
          options.liquidationArcRatio,
        );
    };
  });

  addSnapshotBeforeRestoreAfterEach();

  it('reverts if collateral address is 0', async () => {
    await expect(
      init({ collateralAddress: constants.AddressZero }),
    ).to.be.revertedWith('SapphireCoreV1: collateral is required');
  });

  it('reverts if synthetic address is 0', async () => {
    await expect(
      init({ syntheticAddress: constants.AddressZero }),
    ).to.be.revertedWith('SapphireCoreV1: synthetic is required');
  });

  it('reverts if low c-ratio is 0', async () => {
    await expect(init({ lowCollateralRatio: 0 })).to.be.revertedWith(
      'SapphireCoreV1: collateral ratio has to be at least 1',
    );
  });

  it('reverts if high c-ratio is 0', async () => {
    await expect(init({ highCollateralRatio: 0 })).to.be.revertedWith(
      'SapphireCoreV1: high c-ratio is lower than the low c-ratio',
    );
  });

  it('reverts high c-ratio is lower than the low c-ratio', async () => {
    await expect(
      init({
        highCollateralRatio: constants.WeiPerEther,
        lowCollateralRatio: constants.WeiPerEther.mul(2),
      }),
    ).to.be.revertedWith(
      'SapphireCoreV1: high c-ratio is lower than the low c-ratio',
    );
  });

  it('reverts if liquidation user fee is 0', async () => {
    await expect(
      init({ liquidationUserRatio: utils.parseEther('101') }),
    ).to.be.revertedWith('SapphireCoreV1: fees cannot be more than 100%');
  });

  it('sets all the passed parameters', async () => {
    await expect(init()).to.not.be.reverted;

    const decimals = await collateral.decimals();
    expect(decimals).eq(6);

    expect(
      await sapphireCore.precisionScalars(defaultOptions.collateralAddress),
      'precisionScalar',
    ).eq(utils.parseUnits('1', 18 - decimals));
    expect(await sapphireCore.paused()).to.be.true;
    expect(await sapphireCore.feeCollector()).eq(
      defaultOptions.feeCollector,
      'feeCollector',
    );
    expect(await sapphireCore.oracle()).eq(defaultOptions.oracle, 'oracle');
    expect(await sapphireCore.collateralAsset()).eq(
      defaultOptions.collateralAddress,
      'collateralAsset',
    );
    expect(await sapphireCore.syntheticAsset()).eq(
      defaultOptions.syntheticAddress,
      'syntheticAsset',
    );
    expect(await sapphireCore.highCollateralRatio()).eq(
      defaultOptions.highCollateralRatio,
      'highCollateralRatio',
    );
    expect(await sapphireCore.lowCollateralRatio()).eq(
      defaultOptions.lowCollateralRatio,
      'lowCollateralRatio',
    );
    expect(await sapphireCore.assessor()).eq(
      defaultOptions.assessor,
      'assessor',
    );
    expect(await sapphireCore.liquidationUserRatio()).eq(
      defaultOptions.liquidationUserRatio,
      'liquidationUserRatio',
    );
    expect(await sapphireCore.liquidationArcRatio()).eq(
      defaultOptions.liquidationArcRatio,
      'liquidationArcRatio',
    );
    expect(await sapphireCore.interestSetter()).eq(
      defaultOptions.interestSetter,
      'interest setter',
    );
    expect(await sapphireCore.pauseOperator()).eq(
      defaultOptions.pauseOperator,
      'pauseOperator',
    );
    expect(await sapphireCore.borrowIndex()).eq(
      constants.WeiPerEther,
      'borrowIndex',
    );
    expect(await sapphireCore.getSupportedBorrowAssets()).deep.eq(
      [defaultOptions.stableCoinAddress],
      'supportedBorrowAssets',
    );
    expect(await sapphireCore.borrowPool()).to.eq(
      defaultOptions.borrowPool,
      'borrowPool',
    );
  });

  it('revert if owner inits twice ', async () => {
    await init();
    await expect(init()).to.be.revertedWith(
      'SapphireCoreV1: cannot re-initialize contract',
    );
  });

  it('unauthorized cannot initialize', async () => {
    await expect(init({ executor: unauthorized })).to.be.revertedWith(
      'Adminable: caller is not admin',
    );
  });

  it('reverts if collateral has more than 18 decimals');
});
