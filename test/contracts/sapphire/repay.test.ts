import 'module-alias/register';

/**
 * The repay function does two things simulatenously. It allows a user to repay the STABLEx
 * debt or allows the user to withdraw their collateral deposited. This function and liquidate
 * make the credit proof optional since we never want to lock users from pulling out their funds.
 * Our front-end will always send the proof but in the case that it can't users can just withdraw
 * directly as well.
 */
describe('SapphireCore.repay()', () => {
  it('should be able to repay to increase the c-ratio', async () => {});

  it('should be able to repay (withdraw) to decrease the c-ratio', async () => {});

  it('should be able to repay to make the position collateralized', async () => {});

  it('should be able to repay (withdraw) more collateral with a valid score proof', async () => {});

  it('should be able to repay without a score proof even if one exists on-chain', async () => {});

  it('should be able to repay (deposit) someone elses position', async () => {});

  it('should not be able to repay with a score proof if no assesor is added', async () => {});

  it('should not be able to repay (withdraw) seomeone elses position', async () => {});

  it('should not be able to withdraw if under-collateralized', async () => {});
});
