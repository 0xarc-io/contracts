import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address"
import { StakingAccrualERC20, StakingAccrualERC20Factory, TestToken, TestTokenFactory } from "@src/typings"
import { ethers } from "hardhat"

describe('StakingAccrualERC20', () => {
  let starcx: StakingAccrualERC20
  let stakingToken: TestToken

  let user0: SignerWithAddress
  let user1: SignerWithAddress
  
  before(async () => {
    const signers = await ethers.getSigners()
    const admin = signers[0]
    user0 = signers[1]
    user1 = signers[2]

    stakingToken = await new TestTokenFactory(admin).deploy('ARCx', 'ARCx', 18)
    starcx = await new StakingAccrualERC20Factory(admin).deploy('stARCx', 'stARCx', 18)
  })

  describe('Admin functions', () => {
    describe('#init', () => {
      it('reverts if called by non-admin')
      
      it('reverts if called twice')

      it('reverts if the staking token is address 0')

      it('sets the staking token and the staking cooldown')
    })
    
    describe('#setCooldownDuration', () => {
      it('reverts if called by non-admin')

      it('sets the cooldown duration')
    })
    
  })

  describe('View functions', () => {
    describe('#getUserBalance', () => {
      it('returns the user\'s staked balance')
    })

    describe('#getTotalBalance', () => {
      it('returns the total amount staked')
    })
  })

  describe('Mutating functions', () => {
    describe('#stake', () => {
      it('reverts if staking more than balance')

      it(`reverts if the user's cooldown timestamp is > 0`)
      
      it('stakes the staking token and mints an equal amount of stARCx')
    })

    describe('#startExitCooldown', () => {
      it('starts the unstaking cooldown')
      
      it('reverts if the unstaking cooldown is > 0')
    })
    

    describe('#exit', () => {
      it('reverts if the cooldown timestamp is not passed')
      
      /**
       * It reduces the user's balance to 0, burns the respective stARCx amount 
       * from the user and returns the original ARCx balance
       */
      it(`exits from the fund`)

      it('exits with MORE ARCx than initially if the contract has accumulated more tokens')

      it('exits with LESS ARCx than initially if the admnin had removed tokens')
    })

    describe('#claimFees', () => {
      it('claims fees for the caller')
    })
    
    describe('#claimFor', () => {
      it('does not claim anything if the amount to claim is 0 or negative')

      it('claims the extra fees to the user')

      it('calls updateFees()')
    })

    describe('#updateFees', () => {
      it('updates the accrued index and accrued balance')
    })
    
  })
})
