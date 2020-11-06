import 'module-alias/register';

import { Signer, Wallet } from 'ethers';

import d1ArcDescribe from '@test/helpers/d1ArcDescribe';
import { ITestContext } from '@test/helpers/d1ArcDescribe';
import { StateV1, MockOracle } from '@src/typings';
import { expectRevert } from '@src/utils/expectRevert';
import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';
import { getWaffleExpect, Account } from '../../helpers/testingUtils';

let ownerWallet: Account;
let otherWallet: Account;

const expect = getWaffleExpect();

async function init(ctx: ITestContext): Promise<void> {
  await ctx.arc.oracle.setPrice(ArcDecimal.new(400));

  ownerWallet = ctx.accounts[0];
  otherWallet = ctx.accounts[1];
}

d1ArcDescribe('StateV1', init, (ctx: ITestContext) => {
  describe('#setLimits', () => {
    it('should not be able to set limits as non-admin', async () => {
      const contract = await StateV1.at(otherWallet.signer, ctx.arc.state.address);
      await expectRevert(
        contract.setRiskParams({
          collateralLimit: '',
          syntheticLimit: '',
          positionCollateralMinimum: '',
        }),
      );
    });

    it('should be able to set limits as the admin', async () => {
      const contract = await StateV1.at(ownerWallet.signer, ctx.arc.state.address);
      const tx = await contract.setRiskParams({
        collateralLimit: '',
        syntheticLimit: '500',
        positionCollateralMinimum: '',
      });
    });
  });

  describe('#limits', () => {
    it('should not be able to mint less than the minimum position amount', async () => {
      await ctx.arc.state.setRiskParams({
        collateralLimit: ArcNumber.new(10000),
        syntheticLimit: ArcNumber.new(10000),
        positionCollateralMinimum: ArcNumber.new(300),
      });
      await expectRevert(
        ctx.arc._borrowSynthetic(ArcNumber.new(1), ArcNumber.new(200), ownerWallet.signer),
      );
    });

    it('should not be able to mint more than the collateral limit', async () => {
      await ctx.arc.state.setRiskParams({
        collateralLimit: ArcNumber.new(100),
        syntheticLimit: ArcNumber.new(10000),
        positionCollateralMinimum: ArcNumber.new(1),
      });

      await expectRevert(
        ctx.arc._borrowSynthetic(ArcNumber.new(1), ArcNumber.new(200), ownerWallet.signer),
      );
    });

    it('should be able to mint the synthetic limit', async () => {
      await ctx.arc.state.setRiskParams({
        collateralLimit: ArcNumber.new(1000),
        syntheticLimit: ArcNumber.new(1),
        positionCollateralMinimum: ArcNumber.new(1),
      });

      await expectRevert(
        ctx.arc._borrowSynthetic(ArcNumber.new(2), ArcNumber.new(500), ownerWallet.signer),
      );
    });
  });

  describe('#onlyAdmin', () => {
    it('should not be able to set the market params as non-admin', async () => {
      const state = await ctx.arc.getState(otherWallet.signer);
      await expectRevert(
        state.setMarketParams({
          collateralRatio: ArcDecimal.new(0),
          liquidationArcFee: ArcDecimal.new(0),
          liquidationUserFee: ArcDecimal.new(0),
        }),
      );
    });

    it('should be able to set the market as admin', async () => {
      const state = await ctx.arc.getState(ownerWallet.signer);

      await state.setMarketParams({
        collateralRatio: ArcDecimal.new(1),
        liquidationArcFee: ArcDecimal.new(1),
        liquidationUserFee: ArcDecimal.new(1),
      });

      const currentMarket = await state.market();
      expect(currentMarket.collateralRatio.value).to.equal(ArcNumber.new(1));
      expect(currentMarket.liquidationArcFee.value).to.equal(ArcNumber.new(1));
      expect(currentMarket.liquidationUserFee.value).to.equal(ArcNumber.new(1));
    });

    it('should not be able to set the risk params as non-admin', async () => {
      const state = await ctx.arc.getState(otherWallet.signer);
      await expectRevert(
        state.setRiskParams({
          syntheticLimit: ArcNumber.new(100),
          collateralLimit: ArcNumber.new(100),
          positionCollateralMinimum: ArcNumber.new(100),
        }),
      );
    });

    it('should be able to set the risk params as admin', async () => {
      const state = await ctx.arc.getState(ownerWallet.signer);
      await state.setRiskParams({
        syntheticLimit: ArcNumber.new(100),
        collateralLimit: ArcNumber.new(100),
        positionCollateralMinimum: ArcNumber.new(100),
      });

      const currentRisk = await state.risk();
      expect(currentRisk.syntheticLimit).to.equal(ArcNumber.new(100));
      expect(currentRisk.collateralLimit).to.equal(ArcNumber.new(100));
      expect(currentRisk.positionCollateralMinimum).to.equal(ArcNumber.new(100));
    });

    it('should not be able to set the oracle as non-admin', async () => {
      const state = await ctx.arc.getState(otherWallet.signer);
      await expectRevert(state.setOracle(await otherWallet.address));
    });

    it('should be able to set the oracle as admin', async () => {
      const state = await ctx.arc.getState(ownerWallet.signer);
      await state.setOracle(await ownerWallet.address);
      expect(await state.oracle()).to.equal(await ownerWallet.address);
    });
  });

  describe('#onlyCore', () => {
    let isolatedStateAddress: string;

    beforeEach(async () => {
      const ownerWalletAddress = await ownerWallet.address;
      const contract = await StateV1.deploy(
        ownerWallet.signer,
        ownerWalletAddress,
        ownerWalletAddress,
        ownerWalletAddress,
        ownerWalletAddress,
        {
          collateralRatio: ArcDecimal.new(1),
          liquidationUserFee: ArcDecimal.new(1),
          liquidationArcFee: ArcDecimal.new(1),
        },
        {
          syntheticLimit: 0,
          collateralLimit: 0,
          positionCollateralMinimum: 0,
        },
      );
      isolatedStateAddress = contract.address;
    });

    async function getIsolatedState(caller: Signer) {
      return StateV1.at(caller, isolatedStateAddress);
    }

    async function saveNewPosition(state: StateV1) {
      return await state.savePosition({
        owner: await ownerWallet.address,
        collateralAsset: 0,
        borrowedAmount: {
          sign: true,
          value: 0,
        },
        borrowedAsset: 0,
        collateralAmount: {
          sign: true,
          value: 0,
        },
      });
    }

    it('should not be able to save a new position as non-core', async () => {
      const state = await getIsolatedState(otherWallet.signer);
      await expectRevert(saveNewPosition(state));
    });

    it('should not be able to set the amount as non-core', async () => {
      const ownerState = await getIsolatedState(ownerWallet.signer);
      await saveNewPosition(ownerState);

      const otherState = await getIsolatedState(otherWallet.signer);
      await expectRevert(otherState.setAmount(0, 0, { sign: true, value: 0 }));
    });

    it('should not be able to update the position as non-core', async () => {
      const ownerState = await getIsolatedState(ownerWallet.signer);
      await saveNewPosition(ownerState);

      const otherState = await getIsolatedState(otherWallet.signer);
      await expectRevert(otherState.updatePositionAmount(0, 0, { sign: true, value: 0 }));
    });

    it('should not be able to set the supply balance as non-core', async () => {
      const state = await getIsolatedState(otherWallet.signer);
      await expectRevert(state.updateTotalSupplied(1));
    });

    it('should be able to save a new position as core', async () => {
      const state = await getIsolatedState(ownerWallet.signer);
      await saveNewPosition(state);
    });

    it('should be able to set the amount as core', async () => {
      const ownerState = await getIsolatedState(ownerWallet.signer);
      await saveNewPosition(ownerState);
      await ownerState.setAmount(0, 0, { sign: true, value: 0 });
    });

    it('should be able to update the position as core', async () => {
      const ownerState = await getIsolatedState(ownerWallet.signer);
      await saveNewPosition(ownerState);
      await ownerState.updatePositionAmount(0, 0, { sign: true, value: 0 });
    });

    it('should be able to set the supply balance as core', async () => {
      const state = await getIsolatedState(ownerWallet.signer);
      await state.updateTotalSupplied(1);
    });
  });
});
