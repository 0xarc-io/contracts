import 'jest';

import { Wallet } from 'ethers';

import arcDescribe from './arcDescribe';
import { ITestContext } from './arcDescribe';
import initializeArc from './initializeArc';

let ownerWallet: Wallet;
let otherWallet: Wallet;

jest.setTimeout(30000);

async function init(ctx: ITestContext): Promise<void> {
  await initializeArc(ctx);

  ownerWallet = ctx.wallets[0];
  otherWallet = ctx.wallets[1];
}

arcDescribe('StateV1', init, (ctx: ITestContext) => {
  describe('#onlyAdmin', () => {
    it('should not be able to set the oracle as non-admin');
    it('should not be able to set the interest setter as non-admin');
    it('should not be able to set the collateral ratio as non-admin');
    it('should not be able to set the synthetic ratio as non-admin');
    it('should not be able to set the liquidation spread as non-admin');
    it('should not be able to set the origination fee as non-admin');
    it('should not be able to set the earnings rate as non-admin');

    it('should be able to set the oracle as admin');
    it('should be able to set the interest setter as admin');
    it('should be able to set the collateral ratio as admin');
    it('should be able to set the synthetic ratio as admin');
    it('should be able to set the liquidation spread as admin');
    it('should be able to set the origination fee as admin');
    it('should be able to set the earnings rate as admin');
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
