import { MockProvider } from '@ethereum-waffle/provider';
import { Wallet } from '@ethersproject/wallet';
import { MockSapphireCoreV1, MockSapphireCoreV1Factory, TestToken } from '@src/typings';
import { expect } from 'chai';
import { createFixtureLoader } from 'ethereum-waffle';
import { constants } from 'ethers';
import { deployArcProxy, deployMockSapphireCoreV1, deployTestToken } from '../deployers';

export async function setup([deployer, unauthorized]: Wallet[]): Promise<any> {
  const coreImp = await deployMockSapphireCoreV1(deployer);
  const coreProxy = await deployArcProxy(deployer, coreImp.address, deployer.address, []);
  const sapphireCore = MockSapphireCoreV1Factory.connect(coreProxy.address, deployer);
  const collateral = await deployTestToken(deployer, 'Token Name', 'TKN');
  const synthetic = await deployTestToken(deployer, 'Token Name', 'TKN');

  return { sapphireCore, deployer, unauthorized, collateral, synthetic };
}

describe.only('SapphireCore.init', () => {
  let sapphireCore: MockSapphireCoreV1;
  let deployer: Wallet;
  let unauthorized: Wallet;
  let collateral: TestToken;
  let synthetic: TestToken;
  let init: Function;

  let defaultOptions;
  beforeEach(async () => {
    const provider = new MockProvider();
    ({ sapphireCore, deployer, unauthorized, collateral, synthetic } = await createFixtureLoader(
      provider.getWallets(),
    )(setup));

    defaultOptions = {
      collateralDecimals: 18,
      collateralAddress: collateral.address,
      syntheticAddress: synthetic.address,
      oracle: Wallet.createRandom().address,
      interestSetter: Wallet.createRandom().address,
      assessor: Wallet.createRandom().address,
      highCollateralRatio: constants.WeiPerEther.mul(2),
      lowCollateralRation: constants.WeiPerEther,
      liquidationUserFee: constants.WeiPerEther,
      liquidationArcFee: constants.WeiPerEther,
      executor: deployer,
    };

    init = (overrides) => {
      const options = {
        ...defaultOptions,
        ...overrides,
      };
      return sapphireCore
        .connect(options.executor)
        .init(
          options.collateralDecimals,
          options.collateralAddress,
          options.syntheticAddress,
          options.oracle,
          options.interestSetter,
          options.assessor,
          options.highCollateralRatio,
          options.lowCollateralRation,
          options.liquidationUserFee,
          options.liquidationArcFee,
        );
    };
  });

  it('reverts if collateral address is 0', async () => {
    await expect(init({ collateralAddress: constants.AddressZero })).to.be.revertedWith(
      'SapphireCoreV1: collateral is required',
    );
  });

  it('reverts if synthetic address is 0', async () => {
    await expect(init({ syntheticAddress: constants.AddressZero })).to.be.revertedWith(
      'SapphireCoreV1: synthetic is required',
    );
  });

  it('reverts if oracle address is 0', async () => {
    await expect(init({ oracle: constants.AddressZero })).to.be.revertedWith(
      'SapphireCoreV1: oracle is required',
    );
  });

  it('reverts if interest setter is 0', async () => {
    await expect(init({ interestSetter: constants.AddressZero })).to.be.revertedWith(
      'SapphireCoreV1: interest setter is required',
    );
  });

  it('reverts if low c-ratio is 0', async () => {
    await expect(init({ lowCollateralRatio: 0 })).to.be.revertedWith(
      'SapphireCoreV1: collateral ratio has to be greater than 0',
    );
  });

  it('reverts if high c-ratios is 0', async () => {
    await expect(init({ highCollateralRatio: 0 })).to.be.revertedWith(
      'SapphireCoreV1: collateral ratio has to be greater than 0',
    );
  });

  it('reverts high c-ratio is lower than the low c-ratio', async () => {
    await expect(
      init({
        highCollateralRatio: constants.WeiPerEther,
        lowCollateralRatio: constants.WeiPerEther.mul(2),
      }),
    ).to.be.revertedWith('SapphireCoreV1: high c-ratio is lower than the low c-ratio');
  });

  it('reverts if liquidation user fee is 0', async () => {
    await expect(init({ liquidationUserFee: 0 })).to.be.revertedWith(
      'SapphireCoreV1: liquidation user fee has to be greater than 0',
    );
  });

  it('sets all the passed parameters', async () => {
    await expect(init()).to.not.be.reverted;
    expect(await sapphireCore.paused()).to.be.true;
    expect(await sapphireCore.collateralAsset()).eq(defaultOptions.collateralAddress);
    expect(await sapphireCore.syntheticAsset()).eq(defaultOptions.syntheticAddress);
    expect(await sapphireCore.highCollateralRatio()).eq(defaultOptions.highCollateralRatio);
    expect(await sapphireCore.lowCollateralRatio()).eq(defaultOptions.lowCollateralRatio);
    expect(await sapphireCore.collateralRatioAssessor()).eq(defaultOptions.assessor);
    expect(await sapphireCore.liquidationUserFee()).eq(defaultOptions.liquidationUserFee);
    expect(await sapphireCore.liquidationArcFee()).eq(defaultOptions.liquidationArcFee);
  });

  it('revert if owner inits twice ', async () => {
    await init();
    await expect(init()).to.be.revertedWith('SapphireCoreV1: cannot re-initialize contract');
  });

  it('unauthorized cannot initialize', async () => {
    await expect(init({ executor: unauthorized })).to.be.revertedWith(
      'Ownable: caller is not the owner',
    );
  });
});
