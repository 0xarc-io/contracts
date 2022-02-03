import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
  SapphirePool,
  SapphirePoolFactory,
} from '@src/typings';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { generateContext } from '../context';
import { sapphireFixture } from '../fixtures';

describe('SapphirePool', () => {
  let pool: SapphirePool;

  let admin: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  before(async () => {
    const ctx = await generateContext(sapphireFixture);
    admin = ctx.signers.admin;
    unauthorized = ctx.signers.unauthorized;

    const sapphirePoolImpl = await new SapphirePoolFactory(admin).deploy();

    const proxy = await new ArcProxyFactory(admin).deploy(
      sapphirePoolImpl.address,
      admin.address,
      [],
    );
    pool = SapphirePoolFactory.connect(proxy.address, admin);

    await pool.init('Sapphire Pool', 'SAP', 18);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe('Restricted functions', () => {
    describe('#init', () => {
      it('reverts if called by non-admin', async () => {
        const poolImpl = await new SapphirePoolFactory(admin).deploy();
        const proxy = await new ArcProxyFactory(admin).deploy(
          poolImpl.address,
          admin.address,
          [],
        );
        const _pool = SapphirePoolFactory.connect(proxy.address, unauthorized);

        await expect(_pool.init('Sapphire Pool', 'SAP', 18)).to.be.revertedWith(
          'Adminable: caller is not admin',
        );
      });

      it('sets the name, symbol and decimals', async () => {
        expect(await pool.name()).to.equal('Sapphire Pool');
        expect(await pool.symbol()).to.equal('SAP');
        expect(await pool.decimals()).to.equal(18);
      });
    });

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

      it('reverts if core tries to swap more than its limit');

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

      it('withdraws the correct amount of tokens');

      it(
        'decreases the reward amount for the given token in the core swap utilization mapping',
      );

      it(
        'withdraws the proportional amount of reward in the selected currency (1 currency available)',
      );

      it(
        'withdraws the proportional amount of reward in the selected currency (2 currencies available)',
      );
    });

    describe('#transferRewards', () => {
      it(
        'reverts if the reward token is not in the core swap utilization mapping',
      );

      it(
        'increases the reward amount for the given token in the core swap utilization mapping',
      );

      it('does not mint LP tokens for the transferred rewards');
    });
  });

  describe('Scenarios', () => {
    it(
      '2 LPs deposit and withdraw at different times, while rewards are being added',
    );

    it('2 LPs with 2 cores interact with the pool');
  });
});
