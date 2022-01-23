import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
  MockKermanRewards,
  MockKermanRewardsFactory,
  MockSablier,
  MockSablierFactory,
  MockKermanSocialMoney,
  MockKermanSocialMoneyFactory,
  TestToken,
  TestTokenFactory,
} from '@src/typings';
import createStream from '@test/helpers/createSablierStream';
import { expect } from 'chai';
import { BigNumber, BigNumberish, constants, utils } from 'ethers';
import { ethers } from 'hardhat';
import { generateContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { approve } from '@src/utils';

const STAKE_AMOUNT = utils.parseEther('100');
const REWARDS_AMOUNT = utils.parseEther('300');
const STREAM_DURATION = 100;
const INITIAL_STAKE_DEADLINE = 100;

describe.only('KermanRewards', () => {
  let kermanRewards: MockKermanRewards;
  let sablierContract: MockSablier;
  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let stakingToken: MockKermanSocialMoney;
  let rewardsToken: TestToken;
  let sablierId: BigNumber;

  async function init() {
    const signers = await ethers.getSigners();
    admin = signers[0];
    user1 = signers[1];
    user2 = signers[2];
  }

  async function setTimestamp(timestamp: BigNumberish) {
    await kermanRewards.setCurrentTimestamp(timestamp);
    await sablierContract.setCurrentTimestamp(timestamp);
  }

  before(async () => {
    await generateContext(sapphireFixture, init);
    stakingToken = await new MockKermanSocialMoneyFactory(admin).deploy(
      'ARCx',
      'ARCx',
      18,
      admin.address,
    );
    sablierContract = await new MockSablierFactory(admin).deploy();

    // prepare rewards token
    rewardsToken = await new TestTokenFactory(admin).deploy('ARCX', 'ARCX', 18);
    await rewardsToken.mintShare(admin.address, REWARDS_AMOUNT);

    // deploy KermanRewards contract
    const kermanRewardsImpl = await new MockKermanRewardsFactory(
      admin,
    ).deploy();
    const proxy = await new ArcProxyFactory(admin).deploy(
      kermanRewardsImpl.address,
      admin.address,
      [],
    );
    kermanRewards = MockKermanRewardsFactory.connect(proxy.address, admin);
    await kermanRewards
      .connect(admin)
      .init(
        sablierContract.address,
        stakingToken.address,
        rewardsToken.address,
        INITIAL_STAKE_DEADLINE,
      );
    await sablierContract.setCurrentTimestamp(0);

    // prepare stream id
    sablierId = await createStream(
      sablierContract,
      rewardsToken,
      kermanRewards.address,
      REWARDS_AMOUNT,
      STREAM_DURATION,
      INITIAL_STAKE_DEADLINE,
    );
    await kermanRewards.setSablierStreamId(sablierId);

    await approve(
      STAKE_AMOUNT,
      stakingToken.address,
      kermanRewards.address,
      user1,
    );
    await approve(
      STAKE_AMOUNT.mul(2),
      stakingToken.address,
      kermanRewards.address,
      user2,
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('Admin functions', () => {
    describe('#init', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          kermanRewards
            .connect(user1)
            .init(
              sablierContract.address,
              stakingToken.address,
              rewardsToken.address,
              INITIAL_STAKE_DEADLINE,
            ),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('reverts if called twice', async () => {
        await expect(
          kermanRewards.init(
            sablierContract.address,
            stakingToken.address,
            rewardsToken.address,
            INITIAL_STAKE_DEADLINE,
          ),
        ).to.be.revertedWith('Initializable: contract is already initialized');
      });

      describe('reverts if the staking token is not contract', async () => {
        let notInitalizedKermanRewards: MockKermanRewards;
        before(async () => {
          const kermanRewardsImpl = await new MockKermanRewardsFactory(
            admin,
          ).deploy();
          const proxy = await new ArcProxyFactory(admin).deploy(
            kermanRewardsImpl.address,
            admin.address,
            [],
          );
          notInitalizedKermanRewards = MockKermanRewardsFactory.connect(
            proxy.address,
            admin,
          );
        });

        it('address 0', async () => {
          await expect(
            notInitalizedKermanRewards
              .connect(admin)
              .init(
                sablierContract.address,
                constants.AddressZero,
                rewardsToken.address,
                INITIAL_STAKE_DEADLINE,
              ),
          ).to.be.revertedWith(
            'KermanRewards: staking token is not a contract',
          );
        });

        it('address of user', async () => {
          await expect(
            notInitalizedKermanRewards
              .connect(admin)
              .init(
                sablierContract.address,
                user1.address,
                rewardsToken.address,
                INITIAL_STAKE_DEADLINE,
              ),
          ).to.be.revertedWith(
            'KermanRewards: staking token is not a contract',
          );
        });

        it('sets init variables', async () => {
          expect(await kermanRewards.stakingToken()).to.eq(
            stakingToken.address,
          );
          expect(await kermanRewards.sablierContract()).to.eq(
            sablierContract.address,
          );
        });
      });
    });

    describe('#setSablierContract', () => {
      let otherSablier: MockSablier;

      before(async () => {
        otherSablier = await new MockSablierFactory(user1).deploy();
      });

      it('reverts if called by non-admin', async () => {
        await expect(
          kermanRewards.connect(user1).setSablierContract(otherSablier.address),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('sets the sablier contract if called the admin', async () => {
        expect(await kermanRewards.sablierContract()).to.eq(
          sablierContract.address,
        );

        await kermanRewards.setSablierContract(otherSablier.address);

        expect(await kermanRewards.sablierContract()).to.eq(
          otherSablier.address,
        );
      });
    });

    describe('#setStakeDeadline', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          kermanRewards.connect(user1).setStakeDeadline(11),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('sets the end date if called the admin', async () => {
        expect(await kermanRewards.stakeDeadline()).to.eq(
          INITIAL_STAKE_DEADLINE,
        );

        await kermanRewards.setStakeDeadline(11);

        expect(await kermanRewards.stakeDeadline()).to.eq(11);
      });
    });

    describe('#setSablierStreamId', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          kermanRewards.connect(user1).setSablierStreamId(21),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('reverts if setting an incorrect ID', async () => {
        await expect(kermanRewards.setSablierStreamId(21)).to.be.revertedWith(
          'stream does not exist',
        );
      });

      it('reverts if set stream ID, which is set', async () => {
        const sablierId = await kermanRewards.sablierStreamId();
        await expect(kermanRewards.setSablierStreamId(sablierId)).revertedWith(
          'KermanRewards: the same stream ID is already set',
        );
      });

      it('reverts if recipient of sablier stream is not contract', async () => {
        const sablierId = await createStream(
          sablierContract,
          rewardsToken,
          user1.address,
          REWARDS_AMOUNT,
          STREAM_DURATION,
        );
        await expect(kermanRewards.setSablierStreamId(sablierId)).revertedWith(
          'KermanRewards: recipient of stream is not current contract',
        );
      });

      it('sets the sablier stream ID', async () => {
        // We first initialize the kerman contract with the next stream id in the tests.
        // In reality it will not be like that, since we will first create the stream, then set the stream ID
        const streamId = await kermanRewards.sablierStreamId();
        const sablierId = await createStream(
          sablierContract,
          rewardsToken,
          kermanRewards.address,
          REWARDS_AMOUNT,
          STREAM_DURATION,
        );
        expect(sablierId).not.eq(streamId);

        await kermanRewards.setSablierStreamId(sablierId);

        expect(await kermanRewards.sablierStreamId()).to.eq(sablierId);
      });
    });
  });

  describe('#stake', async () => {
    it('revert if user do not have Staking Token', async () => {
      await expect(kermanRewards.connect(user1).stake()).revertedWith(
        'KermanRewards: balance of staking token is 0',
      );
    });

    it('revert if stake after end date', async () => {
      await stakingToken.mintShare(user1.address, STAKE_AMOUNT);

      await kermanRewards.setCurrentTimestamp(INITIAL_STAKE_DEADLINE + 1);
      await expect(kermanRewards.connect(user1).stake()).to.be.revertedWith(
        'KermanRewards: staking period finished',
      );
    });

    it('burns staking tokens', async () => {
      await stakingToken.mintShare(user1.address, STAKE_AMOUNT);

      const stakingSupply = await stakingToken.totalSupply();
      await kermanRewards.connect(user1).stake();
      expect(await stakingToken.totalSupply()).eq(
        stakingSupply.sub(STAKE_AMOUNT),
      );
      expect(await stakingToken.balanceOf(user1.address)).eq(0);
      expect(await stakingToken.balanceOf(kermanRewards.address)).eq(0);
      expect(await kermanRewards.earned(user1.address)).eq(0);
    });
  });

  describe('#claim', async () => {
    it('reverts if user did not stake', async () => {
      await expect(kermanRewards.connect(user1).claim()).revertedWith(
        'KermanRewards: user does not have staked balance',
      );
    });

    it('reverts if stake period is not finished', async () => {
      await stakingToken.mintShare(user1.address, STAKE_AMOUNT);
      await kermanRewards.connect(user1).stake();

      await expect(kermanRewards.connect(user1).claim()).revertedWith(
        'KermanRewards: stake period is not finished',
      );
    });

    it('claim from the sablier stream', async () => {
      expect(await stakingToken.balanceOf(kermanRewards.address)).to.eq(0);

      expect(
        await sablierContract.balanceOf(sablierId, kermanRewards.address),
      ).eq(0);

      await stakingToken.mintShare(user1.address, STAKE_AMOUNT);
      await kermanRewards.connect(user1).stake();

      await setTimestamp(INITIAL_STAKE_DEADLINE + STREAM_DURATION / 10);

      expect(
        await sablierContract.balanceOf(sablierId, kermanRewards.address),
      ).eq(REWARDS_AMOUNT.div(10));

      await kermanRewards.connect(user1).claim();

      expect(
        await sablierContract.balanceOf(sablierId, kermanRewards.address),
      ).eq(0);

      await setTimestamp(INITIAL_STAKE_DEADLINE + STREAM_DURATION);

      expect(
        await sablierContract.balanceOf(sablierId, kermanRewards.address),
      ).eq(REWARDS_AMOUNT.div(10).mul(9));

      await kermanRewards.claimStreamFunds();
      await expect(kermanRewards.claimStreamFunds()).not.to.be.reverted;
    });

    it('claim accumulated tokens in two steps', async () => {
      await stakingToken.mintShare(user1.address, STAKE_AMOUNT);
      await kermanRewards.connect(user1).stake();

      await setTimestamp(INITIAL_STAKE_DEADLINE + STREAM_DURATION / 2);

      expect(
        await sablierContract.balanceOf(sablierId, kermanRewards.address),
      ).eq(REWARDS_AMOUNT.div(2));

      const expectedRewards = await kermanRewards.earned(user1.address);
      expect(expectedRewards).eq(REWARDS_AMOUNT.div(2));

      await kermanRewards.connect(user1).claim();
      expect(await rewardsToken.balanceOf(user1.address)).eq(expectedRewards);

      expect(await kermanRewards.earned(user1.address)).eq(0);

      await setTimestamp(INITIAL_STAKE_DEADLINE + STREAM_DURATION);

      expect(
        await sablierContract.balanceOf(sablierId, kermanRewards.address),
      ).eq(REWARDS_AMOUNT.div(2));
      expect(await kermanRewards.earned(user1.address)).eq(
        REWARDS_AMOUNT.div(2),
      );
      await kermanRewards.connect(user1).claim();
      expect(await rewardsToken.balanceOf(user1.address)).eq(REWARDS_AMOUNT);
      expect(await kermanRewards.earned(user1.address)).eq(0);
    });

    it('claim at the end of the sablier stream', async () => {
      await stakingToken.mintShare(user1.address, STAKE_AMOUNT);
      await kermanRewards.connect(user1).stake();

      await setTimestamp(INITIAL_STAKE_DEADLINE + STREAM_DURATION + 1);

      const expectedRewards = await kermanRewards.earned(user1.address);
      expect(expectedRewards).eq(REWARDS_AMOUNT);

      await kermanRewards.connect(user1).claim();
      expect(await rewardsToken.balanceOf(user1.address)).eq(expectedRewards);
      expect(await kermanRewards.earned(user1.address)).eq(0);
    });
  });

  describe('Scenarios', () => {
    before(async () => {
      await stakingToken.mintShare(user1.address, STAKE_AMOUNT);
      await kermanRewards.connect(user1).stake();

      await stakingToken.mintShare(user2.address, STAKE_AMOUNT.mul(2));
      await kermanRewards.connect(user2).stake();
    });

    it('2 users participate for whole period of farm', async () => {
      await setTimestamp(INITIAL_STAKE_DEADLINE + STREAM_DURATION + 1);

      const expectedRewards = await kermanRewards.earned(user1.address);
      expect(expectedRewards).eq(REWARDS_AMOUNT.div(3));

      const expectedRewardsForSecondUser = await kermanRewards.earned(
        user2.address,
      );
      expect(expectedRewardsForSecondUser).eq(REWARDS_AMOUNT.div(3).mul(2));

      await kermanRewards.connect(user1).claim();
      expect(await rewardsToken.balanceOf(user1.address)).eq(expectedRewards);

      await kermanRewards.connect(user2).claim();
      expect(await rewardsToken.balanceOf(user2.address)).eq(
        expectedRewardsForSecondUser,
      );
    });

    it('One participate whole time, the second one 1/10 of the farm duration', async () => {
      await setTimestamp(INITIAL_STAKE_DEADLINE + (STREAM_DURATION / 10) * 9);

      const expectedRewards = await kermanRewards.earned(user1.address);
      expect(expectedRewards).eq(REWARDS_AMOUNT.div(10).mul(9).div(3));

      const expectedRewardsForSecondUser = await kermanRewards.earned(
        user2.address,
      );
      expect(expectedRewardsForSecondUser).eq(
        REWARDS_AMOUNT.div(10).mul(9).div(3).mul(2),
      );
      await kermanRewards.connect(user2).claim();
      expect(await rewardsToken.balanceOf(user2.address)).eq(
        expectedRewardsForSecondUser,
      );

      await setTimestamp(INITIAL_STAKE_DEADLINE + STREAM_DURATION + 1);

      await kermanRewards.connect(user1).claim();
      expect(await rewardsToken.balanceOf(user1.address)).eq(
        REWARDS_AMOUNT.div(3),
      );

      await kermanRewards.connect(user2).claim();
      expect(await rewardsToken.balanceOf(user2.address)).eq(
        REWARDS_AMOUNT.div(3).mul(2),
      );
    });

    it('Sablier starts after stake deadline with delay. One participate whole time, the second one 1/10 of the farm duration', async () => {
      const DELAY = 100;
      const sablierId = await createStream(
        sablierContract,
        rewardsToken,
        kermanRewards.address,
        REWARDS_AMOUNT,
        STREAM_DURATION,
        INITIAL_STAKE_DEADLINE + DELAY,
      );
      await kermanRewards.setSablierStreamId(sablierId);
      await setTimestamp(
        INITIAL_STAKE_DEADLINE + DELAY + (STREAM_DURATION / 10) * 9,
      );

      const expectedRewards = await kermanRewards.earned(user1.address);
      expect(expectedRewards).eq(REWARDS_AMOUNT.div(10).mul(9).div(3));

      const expectedRewardsForSecondUser = await kermanRewards.earned(
        user2.address,
      );
      expect(expectedRewardsForSecondUser).eq(
        REWARDS_AMOUNT.div(10).mul(9).div(3).mul(2),
      );
      await kermanRewards.connect(user2).claim();
      expect(await rewardsToken.balanceOf(user2.address)).eq(
        expectedRewardsForSecondUser,
      );

      await setTimestamp(INITIAL_STAKE_DEADLINE + DELAY + STREAM_DURATION + 1);

      await kermanRewards.connect(user1).claim();
      expect(await rewardsToken.balanceOf(user1.address)).eq(
        REWARDS_AMOUNT.div(3),
      );

      await kermanRewards.connect(user2).claim();
      expect(await rewardsToken.balanceOf(user2.address)).eq(
        REWARDS_AMOUNT.div(3).mul(2),
      );
    });

    it('Rewards are not divided by 3', async () => {
      const REWARDS_AMOUNT = utils.parseEther('200');
      const sablierId = await createStream(
        sablierContract,
        rewardsToken,
        kermanRewards.address,
        REWARDS_AMOUNT,
        STREAM_DURATION,
        INITIAL_STAKE_DEADLINE,
      );
      await kermanRewards.setSablierStreamId(sablierId);
      
      await setTimestamp(INITIAL_STAKE_DEADLINE + STREAM_DURATION + 1);

      const expectedRewards = await kermanRewards.earned(user1.address);
      expect(expectedRewards).eq(REWARDS_AMOUNT.div(3));

      const expectedRewardsForSecondUser = await kermanRewards.earned(
        user2.address,
        );

      expect(expectedRewardsForSecondUser).eq(REWARDS_AMOUNT.mul(2).div(3));

      await kermanRewards.connect(user1).claim();
      expect(await rewardsToken.balanceOf(user1.address)).eq(expectedRewards);
      
      await kermanRewards.connect(user2).claim();
      expect(await rewardsToken.balanceOf(user2.address)).eq(
        expectedRewardsForSecondUser,
      );
    });
  });
});
