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
      it('reverts if called twice')

      it('reverts if the staking token is address 0')

      it('sets the staking token and the staking cooldown')
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

      it('stakes the staking token and mints an equal amount of stARCx')
    })

    describe('#notifyUnstakeIntent', () => {
      it('reverts if the unstaking cooldown is not elapsed')

      it('starts the unstaking cooldown')

      it('starts the unstaking cooldown again if the previous one had elapsed')
    })
    

    describe('#unstake', () => {
      it('reverts if the unstaking cooldown is not elapsed')
      
      it('reverts if trying to unstake more than the balance of stARCx')

      it('unstakes their deposit amount')

      it('unstakes more if more fees were added by the admin')

      it('unstakes less than original deposit if admin removed some tokens')
      
      /**
       * TODO: what happens if:
       * 1. user stakes
       * 2. user notifies unstake intent
       * 3. user unstakes after the cooldown
       * 4. User stakes again
       * 5. Can they now unstake at will?
       */
    })

    describe('#claimFees', () => {
      it('claims fees for the caller')
    })
    
    describe('#claimFor', () => {
      it('reverts if the amount to claim is 0 or negative')

      it('claims the extra fees to the user')

      it('calls updateFees()')
    })

    describe('#updateFees', () => {
      it('updates the accrued index and accrued balance')
    })
    
  })
})
