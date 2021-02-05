describe('LiquidityCampaign', () => {
  describe('View functions', () => {
    describe('#lastTimeRewardApplicable', () => {
      xit('should return the block timestamp if called before the reward period finished');

      xit('should return the period finish if called after reward period has finished');
    });

    describe('#balanceOfStaker', () => {
      xit('should return the correct balance');
    });

    describe('#rewardPerToken', () => {
      xit('should return the reward per token stored if the supply is 0');

      xit('should return the correct reward per token before anyone staked');

      xit('should return the correct reward per token after someone staked');

      xit(
        'should return the correct reward per token after some staked and the reward was updated',
      );
    });

    describe('#userAllocation', () => {
      xit('should return the correct user allocation', async () => {
        // Stake
        // Read user allocation
      });
    });

    describe('#earned', () => {
      xit('should return the correct amount earned over time', async () => {
        // Stake
        // Check amount earned (should be 0)
        // Advance time
        // Check amount earned
      });

      xit('should return the correct amount earned over time while another user stakes in between', async () => {
        // User A stakes
        // Check amount earned (should be 0)
        // Advance time
        // User B stakes
        // Advance time
        // Check amount earned
      });
    });

    describe('#getRewardForDuration', () => {
      xit('returns the correct reward for duration');
    });
  });

  describe('Mutative functions', () => {
    describe('#stake', () => {
      xit('should not be able to stake more than balance');

      xit('should be able to stake');

      xit('should update reward correctly after staking');
    });

    describe('#getReward', () => {
      xit('should not be able to get the reward if the tokens are not claimable');

      // TODO not clear
      xit('should not be able to claim more rewards past the end date');

      xit('should be able to claim rewards gradually over time');

      xit('should be able to claim the right amount of rewards given the number of participants');

      xit('should update reward correctly after staking');
    });

    describe('#withdraw', () => {
      xit('should not be able to withdraw more than the balance');

      xit('should withdraw the correct amount');

      xit('should update reward correctly after withdrawing');
    });

    describe('#exit', () => {
      xit('should be able to exit and get the right amount of staked tokens and rewards');
    });
  });

  describe('Admin functions', () => {
    describe('#init', () => {
      xit('should not be callable by anyone');

      xit('should only be callable by the contract owner');
    });

    describe('#notifyRewardAmount', () => {
      xit('should not be callable by anyone');

      xit('should only be callable by the rewards distributor');

      xit('should update rewards correctly after a new reward update');
    });

    describe('#setRewardsDistributor', () => {
      xit('should not be callable by non-admin');

      xit('should set rewardsDistributor if called by admin');
    });

    describe('#setRewardsDuration', () => {
      xit('should not be claimable by anyone');

      xit('should only be callable by the contract owner and set the right duration');
    });

    describe('#recoverERC20', () => {
      xit('should not be callable by anyone');

      xit('should not recover staking or reward token');

      xit('should let admin recover the erc20 on this contract');
    });

    describe('#setTokensClaimable', () => {
      xit('should not be claimable by anyone');

      xit('should only be callable by the contract owner');
    });
  });
});
