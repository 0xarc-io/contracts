import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BASE } from '@src/constants';
import {
  ArcProxyFactory,
  StakingAccrualERC20,
  StakingAccrualERC20Factory,
  TestToken,
  TestTokenFactory,
} from '@src/typings';
import { expect } from 'chai';
import { BigNumber, constants, utils } from 'ethers';
import { ethers } from 'hardhat';
import { constant } from 'lodash';

const STAKE_AMOUNT = utils.parseEther('100');
const COOLDOWN_DURATION = 60;

describe('StakingAccrualERC20', () => {
  let starcx: StakingAccrualERC20;
  let stakingToken: TestToken;

  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  let user1starcx: StakingAccrualERC20;
  let user2starcx: StakingAccrualERC20;

  async function _deployContract() {
    if (starcx) {
      throw Error('Contract already set up');
    }

    const starcxImpl = await new StakingAccrualERC20Factory(admin).deploy();
    const proxy = await new ArcProxyFactory(admin).deploy(
      starcxImpl.address,
      admin.address,
      [],
    );

    starcx = StakingAccrualERC20Factory.connect(proxy.address, admin);
    await starcx.init(
      'stARCx',
      'stARCx',
      18,
      stakingToken.address,
      COOLDOWN_DURATION,
    );
  }

  before(async () => {
    const signers = await ethers.getSigners();
    admin = signers[0];
    user1 = signers[1];
    user2 = signers[2];

    stakingToken = await new TestTokenFactory(admin).deploy('ARCx', 'ARCx', 18);

    await _deployContract();

    user1starcx = starcx.connect(user1);
    user2starcx = starcx.connect(user2);

    await stakingToken.mintShare(user1.address, STAKE_AMOUNT);
    await stakingToken.mintShare(user2.address, STAKE_AMOUNT);

    await stakingToken.connect(user1).approve(starcx.address, STAKE_AMOUNT);
    await stakingToken.connect(user2).approve(starcx.address, STAKE_AMOUNT);
  });

  describe('Admin functions', () => {
    describe('#init', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          user1starcx.init(
            'asdf',
            'asdf',
            18,
            stakingToken.address,
            COOLDOWN_DURATION,
          ),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('reverts if called twice', async () => {
        await expect(
          starcx.init(
            'asdf',
            'asdf',
            18,
            stakingToken.address,
            COOLDOWN_DURATION,
          ),
        ).to.be.revertedWith('Initializable: contract is already initialized');
      });

      it('reverts if the staking token is address 0', async () => {
        const starcxImpl = await new StakingAccrualERC20Factory(admin).deploy();
        const proxy = await new ArcProxyFactory(admin).deploy(
          starcxImpl.address,
          admin.address,
          [],
        );

        const starcxProxy = StakingAccrualERC20Factory.connect(
          proxy.address,
          admin,
        );

        await expect(
          starcxProxy.init(
            'asdf',
            'qwer',
            18,
            constants.AddressZero,
            COOLDOWN_DURATION,
          ),
        ).to.be.revertedWith(
          'StakingAccrualERC20: staking token is not a contract',
        );
        await expect(
          starcxProxy.init(
            'asdf',
            'qwer',
            18,
            user1.address,
            COOLDOWN_DURATION,
          ),
        ).to.be.revertedWith(
          'StakingAccrualERC20: staking token is not a contract',
        );
      });

      it('sets the staking token and the staking cooldown', async () => {
        expect(await starcx.stakingToken()).to.eq(stakingToken.address);
      });
    });

    describe('#setCooldownDuration', () => {
      it('reverts if called by non-admin', async () => {
        await expect(user1starcx.setCooldownDuration(21)).to.be.revertedWith(
          'Adminable: caller is not admin',
        );
      });

      it('sets the cooldown duration', async () => {
        expect(await starcx.cooldownDuration()).to.eq(0);

        await starcx.setCooldownDuration(21);

        expect(await starcx.cooldownDuration()).to.eq(21);
      });
    });

    describe('#recoverTokens', () => {
      it('reverts if called by non-admin');

      it('reverts if trying to recover more tokens than the supply');

      it('recovers the staked tokens');
    });
  });

  describe('Mutating functions', () => {
    describe('#stake', () => {
      it('reverts if staking more than balance', async () => {
        await expect(user1starcx.stake(STAKE_AMOUNT.add(1))).to.be.revertedWith(
          'StakingAccrualERC20: cannot stake more than balance',
        );
      });

      it(`reverts if the user's cooldown timestamp is > 0`, async () => {
        await user1starcx.startExitCooldown();

        await expect(user1starcx.stake(STAKE_AMOUNT)).to.be.revertedWith(
          'StakingAccrualERC20: cannot stake during cooldown period',
        );
      });

      it('stakes the staking token and mints an equal amount of stARCx', async () => {
        expect(await starcx.balanceOf(user1.address)).to.eq(0);

        await user1starcx.stake(STAKE_AMOUNT);

        expect(await starcx.balanceOf(user1.address)).to.eq(STAKE_AMOUNT);
      });
    });

    // describe('#stakeWithPermit', () => {
    // })

    describe('#startExitCooldown', () => {
      it('reverts if user has 0 balance', async () => {
        await expect(user1starcx.startExitCooldown()).to.be.revertedWith(
          'StakingAccrualERC20: user has 0 balance',
        );
      });

      it('starts the exit cooldown', async () => {
        expect(await starcx.exitCooldowns(user1.address)).to.eq(0);

        await starcx.setCurrentTimestamp(10);
        await user1starcx.stake(STAKE_AMOUNT);

        await user1starcx.startExitCooldown();

        expect(await starcx.exitCooldowns(user1.address)).to.eq(10);
      });

      it('reverts if the exit cooldown is > 0', async () => {
        await starcx.setCurrentTimestamp(10);
        await user1starcx.stake(STAKE_AMOUNT);
        await user1starcx.startExitCooldown();

        await expect(user1starcx.startExitCooldown()).to.be.revertedWith(
          'StakingAccrualERC20: exit cooldown already started',
        );
      });
    });

    describe('#exit', () => {
      it('reverts if user has 0 balance', async () => {
        await expect(user1starcx.exit()).to.be.revertedWith(
          'StakingAccrualERC20: user has 0 balance',
        );
      });

      it('reverts if the cooldown timestamp is not passed', async () => {
        await user1starcx.stake(STAKE_AMOUNT);
        await user1starcx.startExitCooldown();

        await expect(user1starcx.exit()).to.be.revertedWith(
          'StakingAccrualERC20: exit cooldown not elapsed',
        );
      });

      /**
       * It reduces the user's balance to 0, burns the respective stARCx amount
       * from the user and returns the original ARCx balance
       */
      it(`exits from the fund`, async () => {
        await user1starcx.stake(STAKE_AMOUNT);
        await user1starcx.startExitCooldown();

        await user1starcx.setTimestamp(COOLDOWN_DURATION);

        expect(await starcx.exitCooldowns(user1.address)).to.eq(
          COOLDOWN_DURATION,
        );
        expect(await starcx.balanceOf(user1.address)).to.eq(STAKE_AMOUNT);
        expect(await stakingToken.balanceOf(user1.address)).to.eq(0);

        await user1starcx.exit();

        expect(await starcx.exitCooldowns(user1.address)).to.eq(0);
        expect(await starcx.balanceOf(user1.address)).to.eq(0);
        expect(await stakingToken.balanceOf(user1.address)).to.eq(STAKE_AMOUNT);
      });

      it('exits with MORE ARCx than initially if the contract has accumulated more tokens', async () => {
        await user1starcx.stake(STAKE_AMOUNT);
        await user2starcx.stake(STAKE_AMOUNT);

        await user1starcx.startExitCooldown();

        await stakingToken.mintShare(starcx.address, STAKE_AMOUNT);

        await user1starcx.exit();

        expect(await starcx.balanceOf(user1.address)).to.eq(0);
        expect(await stakingToken.balanceOf(user1.address)).to.eq(
          STAKE_AMOUNT.mul(1.5),
        );
      });

      it('exits with LESS ARCx than initially if the admin had removed tokens', async () => {
        await user1starcx.stake(STAKE_AMOUNT);
        await user2starcx.stake(STAKE_AMOUNT);

        await user1starcx.startExitCooldown();

        await starcx.recoverTokens(STAKE_AMOUNT);

        await user1starcx.exit();

        expect(await starcx.balanceOf(user1.address)).to.eq(0);
        expect(await stakingToken.balanceOf(user1.address)).to.eq(
          STAKE_AMOUNT.div(2),
        );
      });
    });

    describe('#claimFees', () => {
      it('claims fees for the caller', async () => {
        await user1starcx.stake(STAKE_AMOUNT);
        await user2starcx.stake(STAKE_AMOUNT);

        await stakingToken.mintShare(starcx.address, STAKE_AMOUNT);

        expect(await stakingToken.balanceOf(user1.address)).to.eq(0);

        await user1starcx.claimFees();

        expect(await stakingToken.balanceOf(user1.address)).to.eq(
          STAKE_AMOUNT.div(2),
        );
      });
    });

    describe('#claimFor', () => {
      it('does not claim anything if the amount to claim is 0 or negative', async () => {
        await user1starcx.stake(STAKE_AMOUNT);

        expect(await stakingToken.balanceOf(user1.address)).to.eq(0);

        await user1starcx.claimFor(user1.address);

        expect(await stakingToken.balanceOf(user1.address)).to.eq(0);

        await starcx.recoverTokens(STAKE_AMOUNT);

        await user1starcx.claimFor(user1.address);

        expect(await stakingToken.balanceOf(user1.address)).to.eq(0);
      });

      it('claims fees for the caller', async () => {
        await user1starcx.stake(STAKE_AMOUNT);
        await user2starcx.stake(STAKE_AMOUNT);

        await stakingToken.mintShare(starcx.address, STAKE_AMOUNT);

        expect(await stakingToken.balanceOf(user1.address)).to.eq(0);

        await user1starcx.claimFees();

        expect(await stakingToken.balanceOf(user1.address)).to.eq(
          STAKE_AMOUNT.div(2),
        );
      });

      it('calls updateFees()', async () => {
        await user1starcx.stake(STAKE_AMOUNT);

        await starcx.updateFees();

        await stakingToken.mintShare(starcx.address, STAKE_AMOUNT);

        expect(await starcx.supplyIndex(user1.address)).to.eq(0);
        expect(await starcx.accruedIndex()).to.eq(utils.parseEther('1'));
        expect(await starcx.accruedBalance(user1.address)).to.eq(STAKE_AMOUNT);

        await user2starcx.claimFor(user1.address);

        expect(await starcx.supplyIndex(user1.address)).to.eq(
          utils.parseEther('2'),
        );
        expect(await starcx.accruedIndex(user1.address)).to.eq(
          utils.parseEther('2'),
        );
        expect(await starcx.accruedBalance()).to.eq(STAKE_AMOUNT);
      });
    });

    describe('#updateFees', () => {
      it('updates the accrued index and accrued balance', async () => {
        await starcx.updateFees();

        expect(await starcx.accruedIndex()).to.eq(0);
        expect(await starcx.accruedBalance()).to.eq(0);

        await user1starcx.stake(STAKE_AMOUNT);

        await starcx.updateFees();

        expect(await starcx.accruedIndex()).to.eq(utils.parseEther('1'));
        expect(await starcx.accruedBalance()).to.eq(STAKE_AMOUNT);

        await user2starcx.stake(STAKE_AMOUNT);
        await starcx.updateFees();

        expect(await starcx.accruedIndex()).to.eq(utils.parseEther('1.5'));
        expect(await starcx.accruedBalance()).to.eq(STAKE_AMOUNT.mul(2));

        await stakingToken.mintShare(starcx.address, STAKE_AMOUNT);
        await starcx.updateFees();

        expect(await starcx.accruedIndex()).to.eq(utils.parseEther('2'));
        expect(await starcx.accruedBalance()).to.eq(STAKE_AMOUNT.mul(2));
      });
    });
  });

  describe('View functions', () => {
    describe('#getUserBalance', () => {
      it("returns the user's staked balance", async () => {
        expect(await starcx.getUserBalance()).to.eq(0);

        await user1starcx.stake(STAKE_AMOUNT);

        expect(await starcx.getUserBalance()).to.eq(STAKE_AMOUNT);
      });
    });

    describe('#getTotalBalance', () => {
      it('returns the total amount staked', async () => {
        expect(await starcx.getTotalBalance()).to.eq(0);

        await user1starcx.stake(STAKE_AMOUNT);
        expect(await starcx.getTotalBalance()).to.eq(STAKE_AMOUNT);

        await user2starcx.stake(STAKE_AMOUNT);
        expect(await starcx.getTotalBalance()).to.eq(STAKE_AMOUNT.mul(2));

        await stakingToken.mintShare(starcx.address, STAKE_AMOUNT);
        expect(await starcx.getTotalBalance()).to.eq(STAKE_AMOUNT.mul(2));

        await user1starcx.startExitCooldown();
        await starcx.setCurrentTimestamp(COOLDOWN_DURATION);
        await user1starcx.exit();

        expect(await starcx.getTotalBalance()).to.eq(STAKE_AMOUNT);

        await user2starcx.claimFees();
        expect(await starcx.getTotalBalance()).to.eq(STAKE_AMOUNT);
      });
    });
  });
});
