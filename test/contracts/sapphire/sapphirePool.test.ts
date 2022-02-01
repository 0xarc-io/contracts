describe('SapphirePool', () => {
  describe('Restricted functions', () => {
    describe('#approveCoreVaults', () => {
      it('reverts if set by non-admin');

      it('sets the limit for how many CR can be swapped in for tokens');
    });

    describe('#setTokenLimit', () => {
      it('reverts if called by non-admin');

      it('reverts if an oracle is not set for the given token');

      it('sets the limit for how many stablecoins can be deposited');

      it(
        'if limit is > 0, adds the token to the list of tokens that can be deposited',
      );

      it(
        'if limit is 0, removes the token from the list of tokens that can be deposited',
      );
    });


    describe('#swap', () => {
      it('reverts if called by a non-approved core');

      it('reverts if there are not enough requested coins');

      it('swaps the correct amount if the requested token is 1:1 with the CR');

    });
  });

  describe('View functions', () => {
    describe('#getTokenUtilization', () => {
      it(
        'returns the token utilization (amt deposited and limit) for the given token',
      );
    });


    describe('#totalSupply', () => {
      it('returns the total supply of the LP token');
    });

    describe('#rewardAvailable', () => {
      it('returns the amount of reward available to be claimed');
    });
  });

  describe('Public functions', () => {
    describe('#deposit', () => {
      it('reverts user has not enough tokens');

      it('reverts if trying to deposit more than the limit');

      it(
        'deposits the correct amount of tokens and mints the correct amount of stablecoins',
      );
    });

    describe('#withdraw', () => {
      it(
        'reverts if trying to withdraw more than the amount available for the given token',
      );

      it(
        'withdraws the correct amount of tokens, in addition to the proportional reward',
      );
    });
  });
});
