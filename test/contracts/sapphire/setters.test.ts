describe('SapphireCore.setters', () => {
  describe('#constructor', () => {
    it('reverts if collateral address is 0')
    it('reverts if synthetic address is 0')
    it('reverts if oracle address is 0')
    it('reverts if interest setter is 0')
    it('reverts if low c-ratio or high c-ratios are 0')
    it('reverts high c-ratio is lower than the low c-ratio')
    it('reverts if liquidation user fee is 0')
    it('sets all the passed parameters')
    it('pauses the contract')
  })
  
  
  describe('#setCollateralRatios', () => {
    it('reverts if called by non-owner')
    it('reverts if low c-ratio is 0')
    it('reverts if high c-ratio is 0')
    it('reverts if high c-ratio is lower than the low c-ratio')
    it('sets the low and high collateral ratios')
    it('emits the CollateralRatiosUpdated event')
  })

  describe('#setcollateralRatioAssessor', () => {
    it('reverts if called by non-owner')
    it('reverts if set to address 0')
    it('sets the assessor address')
    it('emits the AssessorUpdated event')
  })
  
  describe('#setFeeCollector', () => {
    it('reverts if called by non-owner')
    it('reverts if set to address 0')
    it('reverts if set to the same fee collector')
    it('sets the fee collector address')
    it('emits the FeeCollectorUpdated event')
  })
  
  describe('#setPause', () => {
    it('reverts if called by non-owner')
    it('reverts if the contract is already paused or already unpaused')
    it('pauses and un-pauses the contract')
    it('emits the PauseStatusUpdated event')
  })

  describe('#setOracle', () => {
    it('reverts if called by non-owner')
    it('reverts if set to the same oracle')
    it('reverts if set to address 0')
    it('sets the oracle')
    it('emits the OracleUpdated event')
  })
  
  describe('#setInterestSetter', () => {
    it('reverts if called by non-owner')
    it('reverts if set to he same interest setter')
    it('reverts if set to the address 0')
    it('sets the interest setter')
    it('emits the InterestSetterUpdated event')
  })

  describe('#setFees', () => {
    it('reverts if called by non-owner')
    it('reverts if the liquidation user fee is 0')
    it('reverts if the fee is over 100%')
    it('reverts if the arc ratio is over 100%')
    it('sets the liquidation fee and the arc ratio')    
    it('emits the FeesUpdated event')
  })

  describe('#setLimits', () => {
    it('reverts if called by non-owner')
    it('sets the borrow limits')
  })
  
})
