import 'module-alias/register';

/**
 * The repay function does two things simulatenously. It allows a user to repay the STABLEx
 * debt or allows the user to withdraw their collateral deposited. This function and liquidate
 * make the credit proof optional since we never want to lock users from pulling out their funds.
 * Our front-end will always send the proof but in the case that it can't users can just withdraw
 * directly as well.
 */
describe('SapphireCore.repay()', () => {
  it('repays to increase the c-ratio', async () => {});

  it('repays (withdraw) to decrease the c-ratio', async () => {});

  it('repays to make the position collateralized', async () => {});

  it('repays (withdraw) more collateral with a valid score proof', async () => {});

  it('repays without a score proof even if one exists on-chain', async () => {});

  it('repays (deposit) someone elses position', async () => {});

  it(`repays (withdraw) someone else's position if called by an approved position operator`);

  it(`repays (withdraw) someone else's position if called by a global operator`);

  it(
    'repays (withdraw) the correct amount of collateral, given that collateral has a different number of decimals than 18',
  );

  it('updates the totalSupplied amount after a repay (withdraw)');

  it('updates the totalBorrowed after a repay');

  it('updates the vault borrow and colllateral amounts');

  it('should not withdraw if the end amount will go below the minimum c-ratio');

  it('should not repay if the oracle is not added');

  it('should not repay if the oracle price is 0');

  it('should not repay or withdraw to a vault that does not exist');

  it('should not repay with a score proof if no assesor is added', async () => {});

  it(`should not repay (withdraw) seomeone else's position`, async () => {});

  it('should not withdraw if under-collateralized', async () => {});

  it(`should not repay more than the vault's debt`);

  it('should not repay (withdraw) more collateral than the amount in the vault');

  it('should not repay if contract is paused');
});
