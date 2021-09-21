import { MockProvider } from '@ethereum-waffle/provider';
import { Wallet } from '@ethersproject/wallet';
import {
  MockSapphireCoreV1,
  MockSapphireCoreV1__factory,
  MockSapphireOracle__factory,
  SapphireAssessor__factory,
  SapphireMapperLinear__factory,
  TestToken,
} from '@src/typings';
import { DEFAULT_MAX_CREDIT_SCORE } from '@test/helpers/sapphireDefaults';
import { expect } from 'chai';
import { createFixtureLoader } from 'ethereum-waffle';
import { constants, utils } from 'ethers';
import {
  deployArcProxy,
  deployMockSapphireCoreV1,
  deployMockSapphirePassportScores,
  deployTestToken,
} from '../deployers';

export async function setup([deployer, unauthorized]: Wallet[]): Promise<any> {
  const coreImp = await deployMockSapphireCoreV1(deployer);
  const coreProxy = await new ArcProxy__factory(deployer).deploy(
    coreImp.address,
    deployer.address,
    [],
  );
  const sapphireCore = MockSapphireCoreV1__factory.connect(
    coreProxy.address,
    deployer,
  );
  const collateral = await new TestToken__factory(deployer).deploy(
    'Collateral Token Name',
    'CTKN6',
    6,
  );
  const synthetic = await new TestToken__factory(deployer).deploy(
    'Synthetic Token Name',
    'STKN',
  );

  return { sapphireCore, deployer, unauthorized, collateral, synthetic };
}

describe('SapphireCore.init', () => {
  let sapphireCore: MockSapphireCoreV1;
  let deployer: Wallet;
  let unauthorized: Wallet;
  let collateral: TestToken;
  let synthetic: TestToken;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let init: (overrides?: any) => unknown;

  let defaultOptions;
  beforeEach(async () => {
    const provider = new MockProvider();
    ({
      sapphireCore,
      deployer,
      unauthorized,
      collateral,
      synthetic,
    } = await createFixtureLoader(provider.getWallets())(setup));

    const oracle = await new MockSapphireOracle__factory(deployer).deploy();
    const mapper = await new SapphireMapperLinear__factory(deployer).deploy();
    const creditScore = await deployMockSapphirePassportScores(deployer);
    await creditScore.init(
      '0x1111111111111111111111111111111111111111111111111111111111111111',
      Wallet.createRandom().address,
      Wallet.createRandom().address,
    );
    const assessor = await new SapphireAssessor__factory(deployer).deploy(
      mapper.address,
      creditScore.address,
      DEFAULT_MAX_CREDIT_SCORE,
    );

    defaultOptions = {
      collateralAddress: collateral.address,
      syntheticAddress: synthetic.address,
      oracle: oracle.address,
      interestSetter: Wallet.createRandom().address,
      assessor: assessor.address,
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

    expect(await sapphireCore.precisionScalar(), 'precisionScalar').eq(
      utils.parseUnits('1', 18 - decimals),
    );
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
