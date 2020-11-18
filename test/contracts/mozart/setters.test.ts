import 'module-alias/register';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';

import { expect } from 'chai';
import { mozartFixture } from '../fixtures';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';
import { generateContext, ITestContext } from '../context';
import {
  deployArcProxy,
  deployMockMozartCoreV1,
  deployMockOracle,
  deployTestToken,
} from '../deployers';
import { MockMozartV1 } from '@src/typings/MockMozartV1';
import { MockMozartV1Factory } from '@src/typings/MockMozartV1Factory';
import { Signer } from '@ethersproject/abstract-signer';
import { BigNumber } from '@ethersproject/bignumber';

describe('MozartV1.setters', () => {
  let ctx: ITestContext;
  let core: MockMozartV1;

  async function init(ctx: ITestContext): Promise<void> {}

  before(async () => {
    ctx = await generateContext(init, init);

    const mockCore = await deployMockMozartCoreV1(ctx.signers.admin);
    const collateral = await deployTestToken(ctx.signers.admin, 'TestCollateral', 'TEST');
    const mockOracle = await deployMockOracle(ctx.signers.admin);
    const proxy = await deployArcProxy(
      ctx.signers.admin,
      mockCore.address,
      ctx.signers.admin.address,
      [],
    );

    core = await new MockMozartV1Factory(ctx.signers.admin).attach(proxy.address);
    await core.setInterestSetter(ctx.signers.interestSetter.address);

    ctx.contracts.mozart.coreV1 = core;
  });

  addSnapshotBeforeRestoreAfterEach();

  async function getCore(signer: Signer) {
    return await ctx.contracts.mozart.coreV1.connect(signer);
  }

  describe('#init', () => {
    it('should not be settable by any user', async () => {
      const contract = await getCore(ctx.signers.unauthorised);
      await expect(
        contract.init(
          ctx.signers.unauthorised.address,
          ctx.signers.unauthorised.address,
          ctx.signers.unauthorised.address,
          ctx.signers.interestSetter.address,
          { value: 2 },
          { value: 4 },
          { value: 5 },
        ),
      ).to.be.reverted;
    });

    it('should only be settable by the admin', async () => {
      const contract = await getCore(ctx.signers.admin);
      await contract.init(
        ctx.signers.unauthorised.address,
        ctx.signers.unauthorised.address,
        ctx.signers.unauthorised.address,
        ctx.signers.interestSetter.address,
        { value: 2 },
        { value: 4 },
        { value: 5 },
      );
      expect(await contract.getCollateralAsset()).to.equal(ctx.signers.unauthorised.address);
      expect(await contract.getSyntheticAsset()).to.equal(ctx.signers.unauthorised.address);
      expect(await contract.getCurrentOracle()).to.equal(ctx.signers.unauthorised.address);
      expect(await contract.getInterestSetter()).to.equal(ctx.signers.interestSetter.address);
    });
  });

  describe('#setInterestRate', () => {
    it('should not be settable by any user', async () => {
      const contract = await getCore(ctx.signers.unauthorised);
      await expect(contract.setRate(999)).to.be.reverted;
    });

    it('should only be settable by the setter', async () => {
      const contract = await getCore(ctx.signers.interestSetter);
      await contract.setRate(999);
      await expect(await contract.getInterestRate()).to.equal(BigNumber.from(999));
    });
  });

  describe('#setOracle', () => {
    it('should not be settable by any user', async () => {
      const contract = await getCore(ctx.signers.unauthorised);
      await expect(contract.setOracle(ctx.signers.admin.address)).to.be.reverted;
    });

    it('should only be settable by the admin', async () => {
      const contract = await getCore(ctx.signers.admin);
      await contract.setOracle(ctx.signers.admin.address);
      expect(await contract.getCurrentOracle()).to.equal(ctx.signers.admin.address);
    });
  });

  describe('#setCollateralRatio', () => {
    it('should not be settable by any user', async () => {
      const contract = await getCore(ctx.signers.unauthorised);
      await expect(contract.setCollateralRatio(ArcDecimal.new(5))).to.be.reverted;
    });

    it('should only be settable by the admin', async () => {
      const contract = await getCore(ctx.signers.admin);
      await contract.setCollateralRatio(ArcDecimal.new(5));
      expect(await (await contract.getCollateralRatio()).value).to.equal(ArcDecimal.new(5).value);
    });
  });

  describe('#setLiquidationFees', () => {
    it('should not be settable by any user', async () => {
      const contract = await getCore(ctx.signers.unauthorised);
      await expect(contract.setFees(ArcDecimal.new(5), ArcDecimal.new(5))).to.be.reverted;
    });

    it('should only be settable by the admin', async () => {
      const contract = await getCore(ctx.signers.admin);
      await contract.setFees(ArcDecimal.new(5), ArcDecimal.new(0.5));
      const fees = await contract.getFees();
      expect(fees._liquidationUserFee.value).to.equal(ArcDecimal.new(5).value);
      expect(fees._liquidationArcRatio.value).to.equal(ArcDecimal.new(0.5).value);
    });
  });

  describe('#setLimits', () => {
    it('should not be settable by any user', async () => {
      const contract = await getCore(ctx.signers.unauthorised);
      await expect(contract.setLimits(1, 2)).to.be.reverted;
    });

    it('should only be settable by the admin', async () => {
      const contract = await getCore(ctx.signers.admin);
      await contract.setLimits(1, 2);
      expect((await contract.getLimits())[0]).to.equal(BigNumber.from(1));
      expect((await contract.getLimits())[1]).to.equal(BigNumber.from(2));
    });
  });

  describe('#setInterestSetter', () => {
    it('should not be settable by any user', async () => {
      const contract = await getCore(ctx.signers.unauthorised);
      await expect(contract.setInterestSetter(ctx.signers.unauthorised.address)).to.be.reverted;
    });

    it('should only be settable by the admin', async () => {
      const contract = await getCore(ctx.signers.admin);
      await contract.setInterestSetter(ctx.signers.admin.address);
      expect(await contract.getInterestSetter()).to.equal(ctx.signers.admin.address);
    });
  });
});
