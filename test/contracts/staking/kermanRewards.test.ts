import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
  KermanRewards,
  KermanRewardsFactory,
  MockSablier,
  MockSablierFactory,
  TestToken,
  TestTokenFactory,
} from '@src/typings';
import { expect } from 'chai';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import { generateContext } from '../context';
import { sapphireFixture } from '../fixtures';

describe('KermanRewards', () => {
  let kermanRewards: KermanRewards;
  let sablierContract: MockSablier;
  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  //   let user2: SignerWithAddress;
  let stakingToken: TestToken;

  async function init() {
    const signers = await ethers.getSigners();
    admin = signers[0];
    user1 = signers[1];
    // user2 = signers[2];
  }

  before(async () => {
    await generateContext(sapphireFixture, init);
    stakingToken = await new TestTokenFactory(admin).deploy('ARCx', 'ARCx', 18);
    sablierContract = await new MockSablierFactory(admin).deploy();

    // deploy KermanRewards contract
    const kermanRewardsImpl = await new KermanRewardsFactory(admin).deploy();
    const proxy = await new ArcProxyFactory(admin).deploy(
      kermanRewardsImpl.address,
      admin.address,
      [],
    );
    kermanRewards = KermanRewardsFactory.connect(proxy.address, admin);
    await kermanRewards
      .connect(admin)
      .init(sablierContract.address, stakingToken.address);
  });

  describe('Admin functions', () => {
    describe('#init', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          kermanRewards
            .connect(user1)
            .init(sablierContract.address, stakingToken.address),
        ).to.be.revertedWith('Adminable: caller is not admin');
      });

      it('reverts if called twice', async () => {
        await expect(
          kermanRewards.init(sablierContract.address, stakingToken.address),
        ).to.be.revertedWith('Initializable: contract is already initialized');
      });

      describe('reverts if the staking token is not contract', async () => {
        let notInitalizedKermanRewards: KermanRewards;
        before(async () => {
          const kermanRewardsImpl = await new KermanRewardsFactory(
            admin,
          ).deploy();
          const proxy = await new ArcProxyFactory(admin).deploy(
            kermanRewardsImpl.address,
            admin.address,
            [],
          );
          notInitalizedKermanRewards = KermanRewardsFactory.connect(
            proxy.address,
            admin,
          );
        });

        it('address 0', async () => {
          await expect(
            notInitalizedKermanRewards
              .connect(admin)
              .init(sablierContract.address, constants.AddressZero),
          ).to.be.revertedWith(
            'KermanRewards: staking token is not a contract',
          );
        });

        it('address of user', async () => {
          await expect(
            notInitalizedKermanRewards
              .connect(admin)
              .init(sablierContract.address, user1.address),
          ).to.be.revertedWith(
            'KermanRewards: staking token is not a contract',
          );
        });

        it('sets init variables', async () => {
            expect(await kermanRewards.stakingToken()).to.eq(stakingToken.address)
            expect(await kermanRewards.sablierContract()).to.eq(sablierContract.address)
        });
      });
    });
  });
});
