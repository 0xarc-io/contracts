import { SapphireCoreV1 } from '@src/typings';
import { expect } from 'chai';
import { constants, Wallet } from 'ethers';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

describe('SapphireCore.setters', () => {
  let ctx: ITestContext;
  let sapphireCore: SapphireCoreV1;

  let randomAddress: string;

  before(async () => {
    ctx = await generateContext(sapphireFixture, (ctx) => setupSapphire(ctx, {}));
    randomAddress = Wallet.createRandom().address;
  });

  describe('#setCollateralRatios', () => {
    const lowRatio = constants.WeiPerEther.mul(3);
    const highRatio = constants.WeiPerEther.mul(5);

    it('reverts if called by non-owner', async () => {
      await expect(
        sapphireCore.connect(ctx.signers.unauthorised).setCollateralRatios(lowRatio, highRatio),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('reverts if low c-ratio is 0', async () => {
      await expect(sapphireCore.setCollateralRatios(0, highRatio)).to.be.revertedWith(
        'SapphireCoreV1: collateral ratio has to be greater than 0',
      );
    });

    it('reverts if high c-ratio is 0', async () => {
      await expect(sapphireCore.setCollateralRatios(lowRatio, 0)).to.be.revertedWith(
        'SapphireCoreV1: collateral ratio has to be greater than 0',
      );
    });

    it('reverts if high c-ratio is lower than the low c-ratio', async () => {
      await expect(sapphireCore.setCollateralRatios(highRatio, lowRatio)).to.be.revertedWith(
        'SapphireCoreV1: high c-ratio is lower than the low c-ratio',
      );
    });

    it('sets the low and high collateral ratios', async () => {
      expect(await sapphireCore.highCollateralRatio()).not.eq(highRatio);
      expect(await sapphireCore.lowCollateralRatio()).not.eq(lowRatio);

      await expect(sapphireCore.setCollateralRatios(lowRatio, highRatio))
        .to.emit(sapphireCore, 'CollateralRatiosUpdated')
        .withArgs(lowRatio, highRatio);

      expect(await sapphireCore.highCollateralRatio()).eq(highRatio);
      expect(await sapphireCore.lowCollateralRatio()).eq(lowRatio);
    });
  });

  describe('#setCollateralRatioAssessor', () => {
    it('reverts if called by non-owner', async () => {
      await expect(
        sapphireCore.connect(ctx.signers.unauthorised).setCollateralRatioAssessor(randomAddress),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('reverts if set to address 0', async () => {
      await expect(
        sapphireCore.setCollateralRatioAssessor(constants.AddressZero),
      ).to.be.revertedWith('SapphireCoreV1: assessor is required');
    });

    it('sets the assessor address', async () => {
      await expect(sapphireCore.setCollateralRatioAssessor(randomAddress))
        .to.emit(sapphireCore, 'AssessorUpdated')
        .withArgs(randomAddress);
      expect(await sapphireCore.collateralRatioAssessor()).eq(randomAddress);
    });
  });

  describe('#setFeeCollector', () => {
    it('reverts if called by non-owner', async () => {
      await expect(
        sapphireCore.connect(ctx.signers.unauthorised).setFeeCollector(randomAddress),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('reverts if set to address 0', async () => {
      await expect(sapphireCore.setFeeCollector(constants.AddressZero)).to.be.revertedWith(
        'SapphireCoreV1: fee collector is required',
      );
    });

    it('reverts if set to the same fee collector');

    it('sets the fee collector address', async () => {
      await expect(sapphireCore.setFeeCollector(randomAddress))
        .to.emit(sapphireCore, 'FeeCollectorUpdated')
        .withArgs(randomAddress);
    });
  });

  describe('#setPause', () => {
    it('reverts if called by non-owner', async () => {
      await expect(
        sapphireCore.connect(ctx.signers.unauthorised).setPause(true),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('reverts if the contract is already paused or already unpaused');

    it('pauses and un-pauses the contract', async () => {
      const initialPaused = await sapphireCore.paused();

      await expect(sapphireCore.setPause(!initialPaused))
        .to.emit(sapphireCore, 'PauseStatusUpdated')
        .withArgs(!initialPaused);
      expect(await sapphireCore.paused()).eq(!initialPaused);

      await expect(sapphireCore.setPause(initialPaused))
        .to.emit(sapphireCore, 'PauseStatusUpdated')
        .withArgs(initialPaused);
      expect(await sapphireCore.paused()).eq(initialPaused);
    });
  });

  describe('#setOracle', () => {
    it('reverts if called by non-owner');
    it('reverts if set to the same oracle');
    it('reverts if set to address 0');
    it('sets the oracle');
    it('emits the OracleUpdated event');
  });

  describe('#setInterestSetter', () => {
    it('reverts if called by non-owner');
    it('reverts if set to he same interest setter');
    it('reverts if set to the address 0');
    it('sets the interest setter');
    it('emits the InterestSetterUpdated event');
  });

  describe('#setFees', () => {
    it('reverts if called by non-owner');
    it('reverts if the liquidation user fee is 0');
    it('reverts if the fee is over 100%');
    it('reverts if the arc ratio is over 100%');
    it('sets the liquidation fee and the arc ratio');
    it('emits the FeesUpdated event');
  });

  describe('#setLimits', () => {
    it('reverts if called by non-owner');
    it('sets the borrow limits');
  });
});
