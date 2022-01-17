import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
  MockKermanRewards,
  MockKermanRewardsFactory,
  MockSablier,
  MockSablierFactory,
  MockKermanSocialMoney,
  MockKermanSocialMoneyFactory,
} from '@src/typings';
import createStream from '@test/helpers/createSablierStream';
import { expect } from 'chai';
import { constants, utils } from 'ethers';
import { ethers } from 'hardhat';
import { generateContext } from '../context';
import { sapphireFixture } from '../fixtures';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { approve } from '@src/utils';

const STAKE_AMOUNT = utils.parseEther('100');
const STREAM_DURATION = 10;
const INITIAL_STAKE_DEADLINE = 100;
const INITIAL_CLAIM_DEADLINE = 200;

describe.only('KermanRewards', () => {
  let kermanRewards: MockKermanRewards;
  let sablierContract: MockSablier;
  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  //   let user2: SignerWithAddress;
  let stakingToken: MockKermanSocialMoney;

  async function init() {
    const signers = await ethers.getSigners();
    admin = signers[0];
    user1 = signers[1];
    // user2 = signers[2];
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

    // deploy KermanRewards contract
    const kermanRewardsImpl = await new MockKermanRewardsFactory(admin).deploy();
    const proxy = await new ArcProxyFactory(admin).deploy(
      kermanRewardsImpl.address,
      admin.address,
      [],
    );
    kermanRewards = MockKermanRewardsFactory.connect(proxy.address, admin);
    await kermanRewards
      .connect(admin)
      .init(sablierContract.address, stakingToken.address, INITIAL_STAKE_DEADLINE, INITIAL_CLAIM_DEADLINE);
    await sablierContract.setCurrentTimestamp(0);

    await approve(
      STAKE_AMOUNT,
      stakingToken.address,
      kermanRewards.address,
      user1,
    );
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('Admin functions', () => {
    describe('#init', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          kermanRewards
            .connect(user1)
            .init(sablierContract.address, stakingToken.address, INITIAL_STAKE_DEADLINE, INITIAL_CLAIM_DEADLINE),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('reverts if called twice', async () => {
        await expect(
          kermanRewards.init(sablierContract.address, stakingToken.address, INITIAL_STAKE_DEADLINE, INITIAL_CLAIM_DEADLINE),
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
              .init(sablierContract.address, constants.AddressZero, INITIAL_STAKE_DEADLINE, INITIAL_CLAIM_DEADLINE),
          ).to.be.revertedWith(
            'KermanRewards: staking token is not a contract',
          );
        });

        it('address of user', async () => {
          await expect(
            notInitalizedKermanRewards
              .connect(admin)
              .init(sablierContract.address, user1.address, INITIAL_STAKE_DEADLINE, INITIAL_CLAIM_DEADLINE),
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

      beforeEach(async () => {
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

      it('reverts if claim deadline is less than stake deadline', async () => {
        await expect(
          kermanRewards.connect(user1).setStakeDeadline(300),
        ).to.be.revertedWith('KermanRewards: claim deadline should be greater than stake deadline');
      });

      it('sets the end date if called the admin', async () => {
        expect(await kermanRewards.stakeDeadline()).to.eq(INITIAL_STAKE_DEADLINE);

        await kermanRewards.setStakeDeadline(11);

        expect(await kermanRewards.stakeDeadline()).to.eq(11);
      });
    });

    describe('#setClaimDeadline', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          kermanRewards.connect(user1).setClaimDeadline(11),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('reverts if claim deadline is less than stake deadline', async () => {
        await expect(
          kermanRewards.connect(user1).setClaimDeadline(10),
        ).to.be.revertedWith('KermanRewards: claim deadline should be greater than stake deadline');
      });

      it('sets the end date if called the admin', async () => {
        expect(await kermanRewards.stakeDeadline()).to.eq(INITIAL_STAKE_DEADLINE);

        await kermanRewards.setClaimDeadline(11);

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
        expect(await kermanRewards.sablierStreamId()).to.eq(0);
        const sablierId = await createStream(
          sablierContract,
          stakingToken,
          user1.address,
          STAKE_AMOUNT,
          STREAM_DURATION,
        );
        await expect(kermanRewards.setSablierStreamId(sablierId)).revertedWith(
          'KermanRewards: reciepient of stream is not current contract',
        );
      });

      it('sets the sablier stream ID', async () => {
        // We first initialize the kerman contract with the next stream id in the tests.
        // In reality it will not be like that, since we will first create the stream, then set the stream ID
        expect(await kermanRewards.sablierStreamId()).to.eq(0);
        const sablierId = await createStream(
          sablierContract,
          stakingToken,
          kermanRewards.address,
          STAKE_AMOUNT,
          STREAM_DURATION,
        );

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

      await kermanRewards.setCurrentTimestamp(INITIAL_STAKE_DEADLINE + 1)
      await expect(kermanRewards.connect(user1).stake()).to.be.revertedWith('KermanRewards: period of staking finished')
    })

    it('withdraw from the sablier stream')

    it('staking tokens are transfered to kermansRewards', async () => {
      await stakingToken.mintShare(user1.address, STAKE_AMOUNT);

      // const stakingSupply = await stakingToken.totalSupply();
      await kermanRewards.connect(user1).stake();
      // expect(await stakingToken.totalSupply()).eq(
      //   stakingSupply.sub(STAKE_AMOUNT),
      // );
      expect(await stakingToken.balanceOf(user1.address)).eq(0);
      expect(await stakingToken.balanceOf(kermanRewards.address)).eq(STAKE_AMOUNT);
      expect(await kermanRewards.connect(user1).earned()).eq(0)
    });
  });

  describe('#claim', async () => {
    it('reverts if user did not stake', async () => {
      await expect(kermanRewards.connect(user1).claim()).revertedWith(
        'KermanRewards: user does not have staked balance',
      );
    });

    it('reverts if stake period is not finished')

    it('reverts if claim period is not finished')

    it('claim the funds')

    it('claim from the sablier stream')

    it('claim accumulated tokens')

    it('claim at the end of the sablier stream')
  });

  it('Scenarios')
});
