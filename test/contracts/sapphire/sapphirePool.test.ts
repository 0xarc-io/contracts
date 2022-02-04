import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
  SapphirePool,
  SapphirePoolFactory,
  TestToken,
  TestTokenFactory,
} from '@src/typings';
import { ADMINABLE_ERROR } from '@test/helpers/contractErrors';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';

describe('SapphirePool', () => {
  let pool: SapphirePool;

  let testDai: TestToken;

  let admin: SignerWithAddress;
  let unauthorized: SignerWithAddress;
  let ctx: ITestContext;

  before(async () => {
    ctx = await generateContext(sapphireFixture);
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

    testDai = await new TestTokenFactory(admin).deploy('TestDAI', 'TDAI', 18);
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
          ADMINABLE_ERROR,
        );
      });

      it('sets the name, symbol and decimals', async () => {
        expect(await pool.name()).to.equal('Sapphire Pool');
        expect(await pool.symbol()).to.equal('SAP');
        expect(await pool.decimals()).to.equal(18);
      });
    });

    describe('#setCoreSwapLimit', () => {
      it('reverts if set by non-admin', async () => {
        await expect(
          pool
            .connect(unauthorized)
            .setCoreSwapLimit(ctx.contracts.sapphire.core.address, 1000),
        ).to.be.revertedWith(ADMINABLE_ERROR);
      });

      it('sets the limit for how many CR can be swapped in for tokens', async () => {
        let utilization = await pool.coreSwapUtilization(
          ctx.contracts.sapphire.core.address,
        );
        expect(utilization.limit).to.eq(0);

        await pool.setCoreSwapLimit(ctx.contracts.sapphire.core.address, 1000);

        utilization = await pool.coreSwapUtilization(
          ctx.contracts.sapphire.core.address,
        );
        expect(utilization.limit).to.eq(1000);
      });
    });

    describe('#setDepositLimit', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          pool.connect(unauthorized).setDepositLimit(testDai.address, 1000),
        ).to.be.revertedWith(ADMINABLE_ERROR);
      });

      it('reverts if setting the limit to 0 and the token is not previously supported', async () => {
        await expect(
          pool.setDepositLimit(testDai.address, 0),
        ).to.be.revertedWith(
          'SapphirePool: the limit must be > 0 or the asset must be already supported',
        );
      });

      it('sets the limit for how many stablecoins can be deposited', async () => {
        let utilization = await pool.assetsUtilization(testDai.address);
        expect(utilization.amountUsed).to.deep.eq(0);
        expect(utilization.limit).to.deep.eq(0);

        await pool.setDepositLimit(testDai.address, 1000);

        utilization = await pool.assetsUtilization(testDai.address);
        expect(utilization.amountUsed).to.eq(0);
        expect(utilization.limit).to.eq(1000);
      });

      it('if limit is > 0, adds the token to the list of tokens that can be deposited', async () => {
        expect(await pool.getDepositAssets()).to.be.empty;

        await pool.setDepositLimit(testDai.address, 1000);

        expect(await pool.getDepositAssets()).to.deep.eq([testDai.address]);
      });

      it('if limit is 0, removes the token from the list of tokens that can be deposited', async () => {
        await pool.setDepositLimit(testDai.address, 1000);
        expect(await pool.getDepositAssets()).to.deep.eq([testDai.address]);

        await pool.setDepositLimit(testDai.address, 0);
        expect(await pool.getDepositAssets()).to.be.empty;
      });

      it('does not add a supported asset twice to the supported assets array', async () => {
        expect(await pool.getDepositAssets()).to.be.empty;

        await pool.setDepositLimit(testDai.address, 100);
        await pool.setDepositLimit(testDai.address, 420);

        expect(await pool.getDepositAssets()).to.deep.eq([testDai.address]);
      });

      it('adds 2 assets to the supported assets list', async () => {
        expect(await pool.getDepositAssets()).to.be.empty;

        const testUsdc = await new TestTokenFactory(admin).deploy(
          'TestUSDC',
          'TUSDC',
          6,
        );

        await pool.setDepositLimit(testDai.address, 100);
        await pool.setDepositLimit(testUsdc.address, 100);

        expect(await pool.getDepositAssets()).to.deep.eq([
          testDai.address,
          testUsdc.address,
        ]);
      });
    });

    describe('#swap', () => {
      it('reverts if called by a non-approved core');

      it('reverts if there are not enough requested coins');

      it('reverts if core tries to swap more than its limit');

      it('swaps the correct amount of requested tokens in exchange of CR');

      it('correctly swaps assets that do not have the same decimals');

      it(
        'increases the token utilization borrow amount when swapping creds for tokens',
      );

      it(
        'decreases the token utilization borrow amount when swapping tokens for creds',
      );
    });
  });

  describe('View functions', () => {
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

      it('increases the total supply of the LP token');
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

      it('decreases the total supply of the LP token');
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
