import 'jest';

import { Wallet } from 'ethers';

import arcDescribe from './helpers/arcDescribe';
import { ITestContext } from './helpers/arcDescribe';
import initializeArc from './helpers/initializeArc';
import { StateV1 } from '@src/typings';
import { expectRevert } from '../src/utils/expectRevert';

let ownerWallet: Wallet;
let otherWallet: Wallet;

jest.setTimeout(30000);

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);

  ownerWallet = ctx.wallets[0];
  otherWallet = ctx.wallets[1];
}

arcDescribe('StateV1', init, (ctx: ITestContext) => {
  describe('#setLimits', () => {
    it('should not be able to set limits as non-admin', async () => {
      const contract = await StateV1.at(otherWallet, ctx.arc.state.address);
      await expectRevert(
        contract.setRiskParams({
          collateralLimit: '',
          syntheticLimit: '',
          positionCollateralMinimum: '',
        }),
      );
    });

    it('should be able to set limits as the admin', async () => {
      const contract = await StateV1.at(ownerWallet, ctx.arc.state.address);
      await contract.setRiskParams({
        collateralLimit: '',
        syntheticLimit: '',
        positionCollateralMinimum: '',
      });
    });
  });

  describe('#limits', () => {
    it('should not be able to mint less than the minimum position amount', async () => {});

    it('should not be able to mint more than the limit', async () => {});

    it('should be able to mint the maximum amount', async () => {});
  });

  describe('#onlyAdmin', () => {
    it('should not be able to set the global params as non-admin');
    it('should be able to set the global as admin');

    it('should not be able to set the risk params as non-admin');
    it('should be able to set the risk params as admin');

    it('should not be able to set the oracle as non-admin');
    it('should be able to set the oracle as admin');
  });

  describe('#onlyCore', () => {
    it('should not be able to save a new position as non-core');
    it('should not be able to set the amount as non-core');
    it('should not be able to update the position as non-core');
    it('should not be able to set the supply balance as non-core');
    it('should not be able to update the total par as non-core');

    it('should be able to save a new position as core');
    it('should be able to set the amount as core');
    it('should be able to update the position as core');
    it('should be able to set the supply balance as core');
    it('should be able to update the total par as core');
  });
});
