import {
  SapphireAssessorFactory,
  SapphireCoreV1,
  TestTokenFactory,
} from '@src/typings';
import {
  DEFAULT_MAX_CREDIT_SCORE,
  DEFAULT_PROOF_PROTOCOL,
} from '@test/helpers/sapphireDefaults';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { fail } from 'assert';
import { expect } from 'chai';
import { constants, utils, Wallet } from 'ethers';
import { generateContext, ITestContext } from '../context';
import { deployMockSapphireOracle } from '../deployers';
import { sapphireFixture } from '../fixtures';
import { setupSapphire } from '../setup';

describe('SapphireCore.setters', () => {
  let ctx: ITestContext;
  let sapphireCore: SapphireCoreV1;

  let randomAddress: string;

  before(async () => {
    ctx = await generateContext(sapphireFixture, (ctx) =>
      setupSapphire(ctx, {}),
    );
    sapphireCore = ctx.contracts.sapphire.core;
    randomAddress = Wallet.createRandom().address;
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('#setCollateralRatios', () => {
    const lowRatio = constants.WeiPerEther.mul(3);
    const highRatio = constants.WeiPerEther.mul(5);

    it('reverts if called by non-owner', async () => {
      await expect(
        sapphireCore
          .connect(ctx.signers.unauthorized)
          .setCollateralRatios(lowRatio, highRatio),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('reverts if low c-ratio is 0', async () => {
      await expect(
        sapphireCore.setCollateralRatios(0, highRatio),
      ).to.be.revertedWith(
        'SapphireCoreV1: collateral ratio has to be at least 1',
      );
    });

    it('reverts if low c-ratio is 0.999..99', async () => {
      await expect(
        sapphireCore.setCollateralRatios(
          constants.WeiPerEther.sub(1),
          highRatio,
        ),
      ).to.be.revertedWith(
        'SapphireCoreV1: collateral ratio has to be at least 1',
      );
    });

    it('reverts if high c-ratio is 0', async () => {
      await expect(
        sapphireCore.setCollateralRatios(lowRatio, 0),
      ).to.be.revertedWith(
        'SapphireCoreV1: high c-ratio is lower than the low c-ratio',
      );
    });

    it('reverts if high c-ratio is lower than the low c-ratio', async () => {
      await expect(
        sapphireCore.setCollateralRatios(highRatio, lowRatio),
      ).to.be.revertedWith(
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

  describe('#setAssessor', () => {
    let newAssessorAddress: string;

    before(async () => {
      const newAssessor = await new SapphireAssessorFactory(
        ctx.signers.admin,
      ).deploy(
        ctx.contracts.sapphire.linearMapper.address,
        ctx.contracts.sapphire.passportScores.address,
        DEFAULT_MAX_CREDIT_SCORE,
      );

      newAssessorAddress = newAssessor.address;
    });

    it('reverts if called by non-owner', async () => {
      await expect(
        sapphireCore
          .connect(ctx.signers.unauthorized)
          .setAssessor(newAssessorAddress),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('sets the assessor address', async () => {
      await expect(sapphireCore.setAssessor(newAssessorAddress))
        .to.emit(sapphireCore, 'AssessorUpdated')
        .withArgs(newAssessorAddress);
      expect(await sapphireCore.assessor()).eq(newAssessorAddress);
    });
  });

  describe('#setFeeCollector', () => {
    it('reverts if called by non-admin', async () => {
      await expect(
        sapphireCore
          .connect(ctx.signers.unauthorized)
          .setFeeCollector(randomAddress),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('sets the fee collector address', async () => {
      await expect(sapphireCore.setFeeCollector(randomAddress))
        .to.emit(sapphireCore, 'FeeCollectorUpdated')
        .withArgs(randomAddress);
      expect(await sapphireCore.feeCollector()).eq(randomAddress);
    });
  });

  describe('#setPauseOperator', () => {
    it('reverts if called by non-admin', async () => {
      await expect(
        sapphireCore
          .connect(ctx.signers.unauthorized)
          .setPauseOperator(ctx.signers.unauthorized.address),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('sets the pause operator', async () => {
      let pauseOperatorAddy = await sapphireCore.pauseOperator();
      expect(pauseOperatorAddy).to.eq(ctx.signers.pauseOperator.address);

      await expect(sapphireCore.setPauseOperator(ctx.signers.admin.address))
        .to.emit(sapphireCore, 'PauseOperatorUpdated')
        .withArgs(ctx.signers.admin.address);

      pauseOperatorAddy = await sapphireCore.pauseOperator();
      expect(pauseOperatorAddy).to.eq(ctx.signers.admin.address);
    });
  });

  describe('#setPause', () => {
    it('reverts if called by non-pauseOperator', async () => {
      await expect(
        sapphireCore.connect(ctx.signers.unauthorized).setPause(true),
      ).to.be.revertedWith('SapphireCoreV1: caller is not the pause operator');
    });

    it('pauses and un-pauses the contract', async () => {
      const initialPaused = await sapphireCore.paused();
      const pauseControllerCore = sapphireCore.connect(
        ctx.signers.pauseOperator,
      );

      await expect(pauseControllerCore.setPause(!initialPaused))
        .to.emit(pauseControllerCore, 'PauseStatusUpdated')
        .withArgs(!initialPaused);
      expect(await pauseControllerCore.paused()).eq(!initialPaused);

      await expect(pauseControllerCore.setPause(initialPaused))
        .to.emit(pauseControllerCore, 'PauseStatusUpdated')
        .withArgs(initialPaused);
      expect(await pauseControllerCore.paused()).eq(initialPaused);
    });
  });

  describe('#setOracle', () => {
    let newOracleAddress: string;

    before(async () => {
      const newOracle = await deployMockSapphireOracle(ctx.signers.admin);
      newOracleAddress = newOracle.address;
    });

    it('reverts if called by non-owner', async () => {
      await expect(
        sapphireCore
          .connect(ctx.signers.unauthorized)
          .setOracle(newOracleAddress),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('sets the oracle', async () => {
      await expect(sapphireCore.setOracle(newOracleAddress))
        .to.emit(sapphireCore, 'OracleUpdated')
        .withArgs(newOracleAddress);
      expect(await sapphireCore.oracle()).eq(newOracleAddress);
    });
  });

  describe('#setInterestSetter', () => {
    it('reverts if called by non-owner', async () => {
      await expect(
        sapphireCore
          .connect(ctx.signers.unauthorized)
          .setInterestSetter(randomAddress),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('sets the interest setter', async () => {
      await expect(sapphireCore.setInterestSetter(randomAddress))
        .to.emit(sapphireCore, 'InterestSetterUpdated')
        .withArgs(randomAddress);
      expect(await sapphireCore.interestSetter()).eq(randomAddress);
    });
  });

  describe('#setInterestRate', () => {
    const maxInterestRate = 21820606488;

    it('reverts if called by unauthorized', async () => {
      await expect(
        sapphireCore.connect(ctx.signers.unauthorized).setInterestRate(1),
      ).to.be.revertedWith('SapphireCoreV1: caller is not interest setter');
    });

    it('reverts if called by owner', async () => {
      await expect(
        sapphireCore.connect(ctx.signers.admin).setInterestRate(1),
      ).to.be.revertedWith('SapphireCoreV1: caller is not interest setter');
    });

    it('sets the interest setter', async () => {
      await expect(
        sapphireCore
          .connect(ctx.signers.interestSetter)
          .setInterestRate(maxInterestRate + 1),
      ).to.be.revertedWith(
        'SapphireCoreV1: interest rate cannot be more than 99% - 21820606489',
      );
    });

    it('sets the interest setter', async () => {
      await expect(
        sapphireCore
          .connect(ctx.signers.interestSetter)
          .setInterestRate(maxInterestRate),
      )
        .to.emit(sapphireCore, 'InterestRateUpdated')
        .withArgs(maxInterestRate);
      expect(await sapphireCore.interestRate()).eq(maxInterestRate);
    });
  });

  describe('#setFees', () => {
    const userFee = utils.parseEther('0.1');
    const arcFee = utils.parseEther('0.05');

    it('reverts if called by non-owner', async () => {
      await expect(
        sapphireCore.connect(ctx.signers.unauthorized).setFees(userFee, arcFee),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it.skip('sets the liquidation fee, the arc ratio and the borrow fee', async () => {
      await expect(sapphireCore.setFees(userFee, arcFee))
        .to.emit(sapphireCore, 'LiquidationFeesUpdated')
        .withArgs(userFee, arcFee);
      expect(await sapphireCore.liquidationUserRatio()).eq(userFee);
      expect(await sapphireCore.liquidationArcRatio()).eq(arcFee);
      fail('borrow fee not implemented');
    });
  });

  describe('#setLimits', () => {
    const vaultBorrowMaximum = utils.parseEther('1000');
    const vaultBorrowMinimum = utils.parseEther('100');

    it('reverts if called by non-owner', async () => {
      await expect(
        sapphireCore
          .connect(ctx.signers.unauthorized)
          .setLimits(vaultBorrowMinimum, vaultBorrowMaximum),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('reverts if max limit is lower than the min limit', async () => {
      await expect(
        sapphireCore.setLimits(vaultBorrowMaximum, vaultBorrowMinimum),
      ).to.be.revertedWith(
        'SapphireCoreV1: required condition is vaultMin <= vaultMax',
      );
    });

    it.skip('sets the borrow limits', async () => {
      await expect(
        sapphireCore.setLimits(vaultBorrowMinimum, vaultBorrowMaximum),
      )
        .to.emit(sapphireCore, 'LimitsUpdated')
        .withArgs(vaultBorrowMinimum, vaultBorrowMaximum);
      expect(await sapphireCore.vaultBorrowMaximum()).eq(vaultBorrowMaximum);
      expect(await sapphireCore.vaultBorrowMinimum()).eq(vaultBorrowMinimum);

      fail('default borrow limit not implemented');
    });
  });

  describe('#setProofProtocol', () => {
    it('reverts if called by non-owner', async () => {
      await expect(
        sapphireCore
          .connect(ctx.signers.unauthorized)
          .setProofProtocol(utils.formatBytes32String('test')),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('sets the proof protocol', async () => {
      expect(await sapphireCore.getProofProtocol()).to.eq(
        DEFAULT_PROOF_PROTOCOL,
      );
      expect(await sapphireCore.getAdmin()).to.eq(ctx.signers.admin.address);

      await sapphireCore
        .connect(ctx.signers.admin)
        .setProofProtocol(utils.formatBytes32String('test'));

      expect(await sapphireCore.getProofProtocol()).to.eq('test');
    });
  });

  describe('#setBorrowPool', () => {
    it('reverts if called by non-admin', async () => {
      await expect(
        sapphireCore
          .connect(ctx.signers.unauthorized)
          .setBorrowPool(ctx.contracts.sapphire.pool.address),
      ).to.be.revertedWith('Adminable: caller is not admin');
    });

    it('sets the address of the borrow pool', async () => {
      expect(await sapphireCore.borrowPool()).to.eq(
        ctx.contracts.sapphire.pool.address,
      );

      await sapphireCore.setBorrowPool(ctx.contracts.sapphire.oracle.address);

      expect(await sapphireCore.borrowPool()).to.eq(
        ctx.contracts.sapphire.oracle.address,
      );
    });
  });

  describe('#getSupportedAssets', () => {
    it('gets the supported assets from the pool', async () => {
      const testDai = await new TestTokenFactory(ctx.signers.admin).deploy(
        'DAI',
        'DAI',
        18,
      );

      expect(await sapphireCore.getSupportedBorrowAssets()).to.deep.eq([
        ctx.contracts.stableCoin.address,
      ]);

      await ctx.contracts.sapphire.pool.setDepositLimit(
        testDai.address,
        utils.parseEther('100'),
      );
      expect(await sapphireCore.getSupportedBorrowAssets()).to.deep.eq([
        ctx.contracts.stableCoin.address,
        testDai.address,
      ]);

      await ctx.contracts.sapphire.pool.setDepositLimit(
        ctx.contracts.stableCoin.address,
        0,
      );
      expect(await sapphireCore.getSupportedBorrowAssets()).to.deep.eq([
        testDai.address,
      ]);
    });
  });
});
