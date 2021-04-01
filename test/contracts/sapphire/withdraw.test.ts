/**
 * The withdraw function allows a user to withdraw collateral from a vault, partially or completely.
 * It does not require a credit score proof, but if provided, the user can potentially withdraw
 * more, depending on the amount of debt they have.
 */
describe('SapphireCore.withdraw()', () => {
  describe('without credit score', () => {
    it('withdraws the entire collateral amount if no debt is minted');

    it('withdraws to the limit');

    it('withdraws more collateral with a valid score proof', async () => {
      /**
       * Since the credit score is higher, the user can withdraw more because the minimum
       * c-ratio is lower
       */
    });

    it(
      'withdraws the correct amount of collateral, given that collateral has a different number of decimals than 18',
    );

    it('updates the totalSupplied amount after a withdraw');

    it('reverts if the resulting vault ends up below the minimum c-ratio', async () => {});

    it(`reverts if withdrawing from a vault that is not msg.sender's`);

    it('reverts if vault is undercollateralized');

    it('reverts if withdrawing more collateral than the amount in the vault');

    it('reverts if contract is paused');
  });
});
