describe('SapphirePool', () => {
  describe('Restricted functions', () => {
    describe('#approveCoreVaults', () => {
      it('reverts if set by non-admin');

      it('sets the limit for how many CR can be swapped in for tokens');
    });

    describe('#setTokenLimit', () => {
      it('reverts if called by non-admin');

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

      it('swaps the correct amount of requested tokens in exchange of CR');
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

    describe('#accumulatedRewardAmount', () => {
      it('returns the current reward amount for the given token');
    });
  });

  describe('Public functions', () => {
    describe('#deposit', () => {
      it('reverts user has not enough tokens');

      it('reverts if trying to deposit more than the limit');

      it('does not mint LP if the caller is an approved core');

      it('increases the current reward amount for the given token');

      it(
        'deposits the correct amount of tokens and mints the correct amount of LP tokens',
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

  describe('Scenarios', () => {
    it(
      '2 LPs deposit and withdraw at different times, while rewards are being added',
    );

    it('2 LPs with 2 cores interact with the pool');
  });
});
