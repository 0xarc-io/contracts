describe('LiquidityCampaign', () => {
  describe('#stake', () => {
    xit('should not be able to stake more than balance')

    xit('should be able to stake')
  })

  describe('#getReward', () => {
    xit('should not be able to get the reward if the tokens are not claimable')
    
    xit('should not be able to claim more rewards past the end date')

    xit('should be able to claim rewards gradually over time')

    xit('should be able to claim the right amount of rewards given the number of participants')
  })

  describe('#withdraw', () => {
    xit('should be able to withdraw')
  })
  
  describe('#exit', () => {
    xit('should be able to exit and get the right amount of staked tokens and rewards')
  })

  describe('#notifyRewardAmount', () => {
    xit('should not be callable by anyone')

    xit('should only be callable by the rewards distributor')
  })

  describe('#recoverERC20', () => {
    xit('should not be callable by anyone')
    
    xit('should not recover staking or reward token')
    
    xit('should let admin recover the erc20 on this contract')
  })

  describe('#setTokensClaimable', () => {
    xit('should not be claimable by anyone')

    xit('should only be callable by the contract owner')
  })

  describe('#setRewardsDuration', () => {
    xit('should not be claimable by anyone')

    xit('should only be callable by the contract owner and set the right duration')
  })
  

  describe('#init', () => {
    xit('should not be callable by anyone')

    xit('should only be callable by the contract owner')
  })

  describe('#setRewardsDistributor', () => {
    xit('should not be callable by non-admin')

    xit('should set rewardsDistributor if called by admin')
  })
  
  describe('#actualRewardPerToken', () => {
    xit('should return the rewardPerTokenStored if the supply is 0')

    xit('should return the correct actual reward per token if a reward update HAS NOT not been made')

    xit('should return the correct actual reward per token if a reward update HAS been made')
  })
  
})
