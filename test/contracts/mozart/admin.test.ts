import 'module-alias/register';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';

import { expect } from 'chai';
import { mozartFixture } from '../fixtures';
import { addSnapshotBeforeRestoreAfterEach } from '../../helpers/testingUtils';
import { generateContext, ITestContext } from '../context';
import { setupMozart } from '../setup';
import { MozartTestArc } from '@src/MozartTestArc';
import { TEN_PERCENT } from '@src/constants';
import { Signer } from '@ethersproject/abstract-signer';

const COLLATERAL_AMOUNT = ArcNumber.new(200);
const BORROW_AMOUNT = ArcNumber.new(50);

xdescribe('Mozart.admin', () => {
  let ctx: ITestContext;
  let arc: MozartTestArc;

  async function init(ctx: ITestContext): Promise<void> {
    await setupMozart(ctx, {
      oraclePrice: ArcDecimal.new(1).value,
      collateralRatio: ArcDecimal.new(2).value,
      interestRate: TEN_PERCENT,
    });
  }

  before(async () => {
    ctx = await generateContext(mozartFixture, init);
    arc = ctx.sdks.mozart;
    await arc.synth().collateral.mintShare(arc.coreAddress(), 100);
  });

  addSnapshotBeforeRestoreAfterEach();

  async function getCore(signer: Signer) {
    return await arc.getCore(arc.synth(), signer);
  }

  describe('#withdrawTokens', () => {
    it('should not be callable by any user', async () => {
      const contract = await getCore(ctx.signers.unauthorised);
      await expect(
        contract.withdrawTokens(
          arc.synth().collateral.address,
          ctx.signers.unauthorised.address,
          100,
        ),
      ).to.be.reverted;
    });

    it('should only be callable by the admin', async () => {
      const contract = await getCore(ctx.signers.admin);
      await contract.withdrawTokens(arc.synth().collateral.address, ctx.signers.admin.address, 100);
    });
  });

  describe('#setPause', () => {
    it('should not be callable by any user', async () => {
      const contract = await getCore(ctx.signers.unauthorised);
      expect(await contract.paused()).to.be.false;
      await expect(contract.setPause(true)).to.be.reverted;
    });

    it('should only be callable by the admin', async () => {
      const contract = await getCore(ctx.signers.admin);
      expect(await contract.paused()).to.be.false;
      await contract.setPause(true);
      expect(await contract.paused()).to.be.true;
    });

    it('should not be able to execute any action once paused', async () => {
      const contract = await getCore(ctx.signers.admin);
      expect(await contract.paused()).to.be.false;

      await arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.minter);
      await contract.setPause(true);
      await expect(arc.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, ctx.signers.minter)).to.be
        .reverted;
    });
  });
});
