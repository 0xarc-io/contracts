import { SapphireCoreV1 } from '@src/typings';
import { expect } from 'chai';
import { constants, utils, Wallet } from 'ethers';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

describe.only('SapphireCore.setters', () => {
  let ctx: ITestContext;
  let sapphireCore: SapphireCoreV1;

  let randomAddress: string;

  before(async () => {
    ctx = await generateContext(sapphireFixture, (ctx) => setupSapphire(ctx, {}));
    sapphireCore = ctx.contracts.sapphire.core;
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
        'SapphireCoreV1: collateral ratio has to be at least 1',
      );
    });

    it('reverts if low c-ratio is 0.999..99', async () => {
      await expect(
        sapphireCore.setCollateralRatios(constants.WeiPerEther.sub(1), highRatio),
      ).to.be.revertedWith('SapphireCoreV1: collateral ratio has to be at least 1');
    });

    it('reverts if high c-ratio is 0', async () => {
      await expect(sapphireCore.setCollateralRatios(lowRatio, 0)).to.be.revertedWith(
        'SapphireCoreV1: collateral ratio has to be at least 1',
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

    it('sets the fee collector address', async () => {
      await expect(sapphireCore.setFeeCollector(randomAddress))
        .to.emit(sapphireCore, 'FeeCollectorUpdated')
        .withArgs(randomAddress);
      expect(await sapphireCore.feeCollector()).eq(randomAddress);
    });
  });

  describe('#setPause', () => {
    it('reverts if called by non-owner', async () => {
      await expect(
        sapphireCore.connect(ctx.signers.unauthorised).setPause(true),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

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
    it('reverts if called by non-owner', async () => {
      await expect(
        sapphireCore.connect(ctx.signers.unauthorised).setOracle(randomAddress),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('sets the oracle', async () => {
      await expect(sapphireCore.setFeeCollector(randomAddress))
        .to.emit(sapphireCore, 'OracleUpdated')
        .withArgs(randomAddress);
      expect(await sapphireCore.oracle()).eq(randomAddress);
    });
  });

  describe('#setInterestSetter', () => {
    it('reverts if called by non-owner', async () => {
      await expect(
        sapphireCore.connect(ctx.signers.unauthorised).setInterestSetter(randomAddress),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('sets the interest setter', async () => {
      await expect(sapphireCore.setInterestSetter(randomAddress))
        .to.emit(sapphireCore, 'InterestSetterUpdated')
        .withArgs(randomAddress);
    });
  });

  describe('#setFees', () => {
    const userFee = constants.WeiPerEther.mul(10);
    const arcFee = constants.WeiPerEther.mul(5);

    it('reverts if called by non-owner', async () => {
      await expect(
        sapphireCore.connect(ctx.signers.unauthorised).setFees(userFee, arcFee),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('reverts if fee sum is over 100%', async () => {
      await expect(
        sapphireCore.setFees(utils.parseEther('60'), utils.parseEther('40').add(1)),
      ).to.be.revertedWith('SapphireCoreV1: fee sum has to be no more than 100%');

      await expect(sapphireCore.setFees(utils.parseEther('100'), '1')).to.be.revertedWith(
        'SapphireCoreV1: fee sum has to be no more than 100%',
      );
    });

    it('sets the liquidation fee and the arc ratio', async () => {
      await expect(sapphireCore.setFees(userFee, arcFee))
        .to.emit(sapphireCore, 'LiquidationFeesUpdated')
        .withArgs(userFee, arcFee);
      expect(await sapphireCore.liquidationUserFee()).eq(userFee);
      expect(await sapphireCore.liquidationArcFee()).eq(arcFee);
    });
  });

  describe('#setLimits', () => {
    const totalBorrowLimit = utils.parseEther('1000000');
    const vaultBorrowMaximum = utils.parseEther('1000');
    const vaultBorrowMinimum = utils.parseEther('100');

    it('reverts if called by non-owner', async () => {
      await expect(
        sapphireCore
          .connect(ctx.signers.unauthorised)
          .setLimits(totalBorrowLimit, vaultBorrowMinimum, vaultBorrowMaximum),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('reverts if max limit is lower than the min limit', async () => {
      await expect(
        sapphireCore.setLimits(totalBorrowLimit, vaultBorrowMaximum, vaultBorrowMinimum),
      ).to.be.revertedWith(
        'SapphireCoreV1: limits condition is unfulfilled (vaultBorrowMinimum  <= vaultBorrowMaximum <= totalBorrowLimit)',
      );
      await expect(
        sapphireCore.setLimits(vaultBorrowMinimum, totalBorrowLimit, vaultBorrowMaximum),
      ).to.be.revertedWith(
        'SapphireCoreV1: limits condition is unfulfilled (vaultBorrowMinimum  <= vaultBorrowMaximum <= totalBorrowLimit)',
      );
      await expect(
        sapphireCore.setLimits(vaultBorrowMaximum, vaultBorrowMinimum, totalBorrowLimit),
      ).to.be.revertedWith(
        'SapphireCoreV1: limits condition is unfulfilled (vaultBorrowMinimum  <= vaultBorrowMaximum <= totalBorrowLimit)',
      );
    });

    it('sets the borrow limits', async () => {
      await expect(sapphireCore.setLimits(totalBorrowLimit, vaultBorrowMinimum, vaultBorrowMaximum))
        .to.emit(sapphireCore, 'SapphireCoreV1')
        .withArgs(totalBorrowLimit, vaultBorrowMinimum, vaultBorrowMaximum);
      expect(await sapphireCore.totalBorrowLimit()).eq(totalBorrowLimit);
      expect(await sapphireCore.vaultBorrowMaximum()).eq(vaultBorrowMaximum);
      expect(await sapphireCore.vaultBorrowMinimum()).eq(vaultBorrowMinimum);
    });
  });
});
