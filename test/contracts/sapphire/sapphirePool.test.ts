import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BASE } from '@src/constants';
import {
  ArcProxyFactory,
  BaseERC20Factory,
  MockSapphirePool,
  MockSapphirePoolFactory,
  SapphirePool,
  SapphirePoolFactory,
  TestToken,
  TestTokenFactory,
} from '@src/typings';
import { approve } from '@src/utils';
import {
  ADMINABLE_ERROR,
  ARITHMETIC_ERROR,
  TRANSFER_FAILED,
  TRANSFER_FROM_FAILED,
} from '@test/helpers/contractErrors';
import { roundUpDiv } from '@test/helpers/roundUpOperations';
import {
  DEFAULT_COLLATERAL_DECIMALS,
  DEFAULT_STABLECOIN_DECIMALS,
} from '@test/helpers/sapphireDefaults';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber, BigNumberish, ethers, utils } from 'ethers';
import { ITestContext } from '../context';

import hre from 'hardhat';

describe('SapphirePool', () => {
  let pool: MockSapphirePool;

  let stablecoin: TestToken;

  let depositAmount: BigNumber; // 6 decimals
  let scaledDepositAmount: BigNumber; // 18 decimals
  let stablecoinScalar: BigNumberish;
  let ctx: ITestContext;

  let admin: SignerWithAddress;
  let depositor: SignerWithAddress;

  async function borrowAndRepaySetup() {
    await pool.setDepositLimit(stablecoin.address, depositAmount.mul(2));
    await pool.setCoreBorrowLimit(admin.address, scaledDepositAmount);

    await approve(depositAmount, stablecoin.address, pool.address, depositor);
    await pool.connect(depositor).deposit(stablecoin.address, depositAmount);

    await approve(depositAmount, stablecoin.address, pool.address, admin);
  }

  // before(async () => {
  //   ctx = await generateContext(sapphireFixture);
  //   admin = ctx.signers.admin;
  //   depositor = ctx.signers.unauthorized;
  //   stablecoin = ctx.contracts.stablecoin;

  //   const sapphirePoolImpl = await new MockSapphirePoolFactory(admin).deploy();
  //   const proxy = await new ArcProxyFactory(admin).deploy(
  //     sapphirePoolImpl.address,
  //     admin.address,
  //     [],
  //   );
  //   pool = MockSapphirePoolFactory.connect(proxy.address, admin);

  //   await pool.init('Sapphire Pool', 'SAP');

  //   const stablecoinDecimals = await stablecoin.decimals();
  //   depositAmount = utils.parseUnits('100', stablecoinDecimals);
  //   stablecoinScalar = 10 ** (18 - stablecoinDecimals);
  //   scaledDepositAmount = depositAmount.mul(stablecoinScalar);

  //   await stablecoin.mintShare(depositor.address, depositAmount);
  // });

  addSnapshotBeforeRestoreAfterEach();

  describe('Restricted functions', () => {
    describe('#init', () => {
      it('reverts if called by non-admin', async () => {
        const poolImpl = await new MockSapphirePoolFactory(admin).deploy();
        const proxy = await new ArcProxyFactory(admin).deploy(
          poolImpl.address,
          admin.address,
          [],
        );
        const _pool = MockSapphirePoolFactory.connect(proxy.address, depositor);

        await expect(_pool.init('Sapphire Pool', 'SAP')).to.be.revertedWith(
          ADMINABLE_ERROR,
        );
      });

      it('sets the name, symbol and decimals', async () => {
        expect(await pool.name()).to.equal('Sapphire Pool');
        expect(await pool.symbol()).to.equal('SAP');
        expect(await pool.decimals()).to.equal(18);
      });
    });

    describe('#setCoreBorrowLimit', () => {
      it('reverts if set by non-admin', async () => {
        await expect(
          pool
            .connect(depositor)
            .setCoreBorrowLimit(ctx.contracts.sapphire.core.address, 1000),
        ).to.be.revertedWith(ADMINABLE_ERROR);
      });

      it('reverts if setting limit that makes the sum of the limits of the cores greater than than the sum of the deposit limits', async () => {
        await pool.setDepositLimit(stablecoin.address, depositAmount);

        await pool.setCoreBorrowLimit(admin.address, scaledDepositAmount);
        await expect(
          pool.setCoreBorrowLimit(
            depositor.address,
            scaledDepositAmount.add(1),
          ),
        ).to.be.revertedWith(
          'SapphirePool: sum of the deposit limits exceeds sum of borrow limits',
        );
      });

      it('sets the limit for how many stables can be borrowed', async () => {
        let utilization = await pool.coreBorrowUtilization(
          ctx.contracts.sapphire.core.address,
        );
        expect(utilization.limit).to.eq(0);

        await pool.setDepositLimit(stablecoin.address, depositAmount);
        await pool.setCoreBorrowLimit(
          ctx.contracts.sapphire.core.address,
          1000,
        );

        utilization = await pool.coreBorrowUtilization(
          ctx.contracts.sapphire.core.address,
        );
        expect(utilization.limit).to.eq(1000);
        expect(utilization.amountUsed).to.eq(0);
      });

      it('sets the limit to core when another one exists already', async () => {
        await pool.setDepositLimit(stablecoin.address, depositAmount);

        await pool.setCoreBorrowLimit(
          ctx.contracts.sapphire.core.address,
          scaledDepositAmount.div(3),
        );
        await pool.setCoreBorrowLimit(
          admin.address,
          scaledDepositAmount.div(3),
        );

        expect((await pool.coreBorrowUtilization(admin.address)).limit).to.eq(
          scaledDepositAmount.div(3),
        );

        await pool.setCoreBorrowLimit(
          admin.address,
          scaledDepositAmount.div(2),
        );

        expect((await pool.coreBorrowUtilization(admin.address)).limit).to.eq(
          scaledDepositAmount.div(2),
        );
      });

      it('removes the core from the active core array if its limit is set to 0', async () => {
        await pool.setDepositLimit(stablecoin.address, depositAmount);

        await pool.setCoreBorrowLimit(
          ctx.contracts.sapphire.core.address,
          scaledDepositAmount.div(3),
        );

        expect(await pool.getActiveCores()).to.have.lengthOf(1);

        await pool.setCoreBorrowLimit(ctx.contracts.sapphire.core.address, 0);

        expect(await pool.getActiveCores()).to.be.empty;
      });

      it('reverts if setting limit to 0 and there are no other available borrowable assets', async () => {
        await pool.setDepositLimit(stablecoin.address, depositAmount);

        await pool.setCoreBorrowLimit(
          ctx.contracts.sapphire.core.address,
          1000,
        );
        await pool.setCoreBorrowLimit(admin.address, 1000);

        await pool.setCoreBorrowLimit(ctx.contracts.sapphire.core.address, 0);

        await expect(
          pool.setCoreBorrowLimit(admin.address, 0),
        ).to.be.revertedWith(
          'SapphirePool: at least one asset must have a positive borrow limit',
        );
      });
    });

    describe('#setDepositLimit', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          pool.connect(depositor).setDepositLimit(stablecoin.address, 1000),
        ).to.be.revertedWith(ADMINABLE_ERROR);
      });

      it('sets the limit for how many stablecoins can be deposited', async () => {
        let utilization = await pool.assetDepositUtilization(
          stablecoin.address,
        );
        expect(utilization.amountUsed).to.deep.eq(0);
        expect(utilization.limit).to.deep.eq(0);

        await pool.setDepositLimit(stablecoin.address, 1000);

        utilization = await pool.assetDepositUtilization(stablecoin.address);
        expect(utilization.amountUsed).to.eq(0);
        expect(utilization.limit).to.eq(1000);
      });

      it('sets the correct token scalar of the given token, if previous limit was 0', async () => {
        expect(await pool.tokenDecimals(stablecoin.address)).to.eq(0);

        await pool.setDepositLimit(stablecoin.address, 1000);

        expect(await pool.tokenDecimals(stablecoin.address)).to.eq(
          await stablecoin.decimals(),
        );
      });

      it('if limit is > 0, adds the token to the list of tokens that can be deposited', async () => {
        expect(await pool.getDepositAssets()).to.be.empty;

        await pool.setDepositLimit(stablecoin.address, 1000);

        expect(await pool.getDepositAssets()).to.deep.eq([stablecoin.address]);
      });

      it('does not add a supported asset twice to the supported assets array', async () => {
        expect(await pool.getDepositAssets()).to.be.empty;

        await pool.setDepositLimit(stablecoin.address, 100);
        await pool.setDepositLimit(stablecoin.address, 420);

        expect(await pool.getDepositAssets()).to.deep.eq([stablecoin.address]);
      });

      it('reverts if setting the limit to 0 and the token is not previously supported', async () => {
        await expect(
          pool.setDepositLimit(stablecoin.address, 0),
        ).to.be.revertedWith(
          'SapphirePool: cannot set the limit of an unknown asset to 0',
        );
      });

      it('reverts if setting a deposit limit that makes the sum of the deposit limits smaller than than the sum of the borrow limits', async () => {
        await pool.setDepositLimit(stablecoin.address, depositAmount);
        await pool.setDepositLimit(
          ctx.contracts.collateral.address,
          utils.parseUnits('100', DEFAULT_COLLATERAL_DECIMALS),
        );

        await pool.setCoreBorrowLimit(admin.address, scaledDepositAmount);
        await pool.setCoreBorrowLimit(depositor.address, scaledDepositAmount);

        await expect(
          pool.setDepositLimit(stablecoin.address, depositAmount.mul(2).div(3)),
        ).to.be.revertedWith(
          'SapphirePool: sum of borrow limits exceeds sum of deposit limits',
        );
      });

      it('if limit is 0, removes the token from the list of tokens that can be deposited', async () => {
        const testUsdc = await new TestTokenFactory(admin).deploy(
          'TestUSDC',
          'TUSDC',
          6,
        );

        await pool.setDepositLimit(stablecoin.address, depositAmount);
        await pool.setDepositLimit(testUsdc.address, depositAmount);

        expect(await pool.getDepositAssets()).to.deep.eq([
          stablecoin.address,
          testUsdc.address,
        ]);

        await pool.setDepositLimit(stablecoin.address, 0);

        expect(await pool.getDepositAssets()).to.deep.eq([testUsdc.address]);
      });

      it('adds 2 assets to the supported assets list', async () => {
        expect(await pool.getDepositAssets()).to.be.empty;

        const testUsdc = await new TestTokenFactory(admin).deploy(
          'TestUSDC',
          'TUSDC',
          6,
        );

        await pool.setDepositLimit(stablecoin.address, 100);
        await pool.setDepositLimit(testUsdc.address, 100);

        expect(await pool.getDepositAssets()).to.deep.eq([
          stablecoin.address,
          testUsdc.address,
        ]);
      });

      it('reverts if trying to set a limit of 0 to the only deposit token available', async () => {
        const testUsdc = await new TestTokenFactory(admin).deploy(
          'TestUSDC',
          'TUSDC',
          6,
        );

        await pool.setDepositLimit(stablecoin.address, 100);
        await pool.setDepositLimit(testUsdc.address, 100);

        await pool.setDepositLimit(stablecoin.address, 0);

        await expect(
          pool.setDepositLimit(testUsdc.address, 0),
        ).to.be.revertedWith(
          'SapphirePool: at least 1 deposit asset must have a positive limit',
        );
      });
    });

    describe('#borrow', () => {
      beforeEach(() => borrowAndRepaySetup());

      it('reverts if called by a non-approved core', async () => {
        await expect(
          pool
            .connect(depositor)
            .borrow(
              stablecoin.address,
              scaledDepositAmount.div(2),
              depositor.address,
            ),
        ).to.be.revertedWith('SapphirePool: sender is not a Core');
      });

      it('reverts if there are not enough requested stables', async () => {
        await pool
          .connect(depositor)
          .withdraw(scaledDepositAmount.div(2), stablecoin.address);

        expect(await stablecoin.balanceOf(pool.address)).to.eq(
          depositAmount.div(2),
        );

        await expect(
          pool.borrow(
            stablecoin.address,
            scaledDepositAmount.div(3).mul(2),
            admin.address,
          ),
        ).to.be.revertedWith(TRANSFER_FAILED);
      });

      it('reverts if trying to borrow an unsupported token', async () => {
        await expect(
          pool.borrow(
            ctx.contracts.collateral.address,
            scaledDepositAmount,
            admin.address,
          ),
        ).to.be.revertedWith('SapphirePool: unknown token');
      });

      it('reverts if core tries to borrow more than its limit', async () => {
        await pool.setCoreBorrowLimit(
          admin.address,
          scaledDepositAmount.sub(1),
        );

        await expect(
          pool.borrow(stablecoin.address, scaledDepositAmount, admin.address),
        ).to.be.revertedWith('SapphirePool: core borrow limit exceeded');
      });

      it('correctly borrows assets that have 18 decimals', async () => {
        const daiDepositAmount = scaledDepositAmount;
        const testDai = await new TestTokenFactory(admin).deploy(
          'TestDAI',
          'TDAI',
          18,
        );
        await testDai.mintShare(depositor.address, daiDepositAmount);
        await pool.setDepositLimit(testDai.address, daiDepositAmount);
        await pool.setCoreBorrowLimit(admin.address, daiDepositAmount);

        await approve(
          daiDepositAmount,
          testDai.address,
          pool.address,
          depositor,
        );
        await pool
          .connect(depositor)
          .deposit(testDai.address, daiDepositAmount);

        expect(await testDai.balanceOf(admin.address)).to.eq(0);

        await pool.borrow(testDai.address, daiDepositAmount, admin.address);
        expect(await testDai.balanceOf(admin.address)).to.eq(daiDepositAmount);
      });

      it('increases the token utilization borrow amount', async () => {
        let utilization = await pool.coreBorrowUtilization(admin.address);
        expect(utilization.amountUsed).to.eq(0);

        await pool.borrow(
          stablecoin.address,
          scaledDepositAmount.div(2),
          admin.address,
        );

        utilization = await pool.coreBorrowUtilization(admin.address);
        expect(utilization.amountUsed).to.eq(scaledDepositAmount.div(2));

        await pool.borrow(
          stablecoin.address,
          scaledDepositAmount.div(2),
          admin.address,
        );

        utilization = await pool.coreBorrowUtilization(admin.address);
        expect(utilization.amountUsed).to.eq(scaledDepositAmount);
      });

      it('emits TokensBorrowed', async () => {
        await expect(
          pool.borrow(stablecoin.address, scaledDepositAmount, admin.address),
        )
          .to.emit(pool, 'TokensBorrowed')
          .withArgs(
            admin.address,
            stablecoin.address,
            depositAmount,
            admin.address,
          );
      });
    });

    describe('#repay', () => {
      beforeEach(() => borrowAndRepaySetup());

      it('reverts if called by a non-approved core', async () => {
        await expect(
          pool
            .connect(depositor)
            .repay(stablecoin.address, scaledDepositAmount.div(2)),
        ).to.be.revertedWith('SapphirePool: sender is not a Core');
      });

      it('reverts if there are not enough creds to repay', async () => {
        await pool
          .connect(depositor)
          .withdraw(scaledDepositAmount.div(2), stablecoin.address);

        expect(await stablecoin.balanceOf(pool.address)).to.eq(
          depositAmount.div(2),
        );

        await expect(
          pool.repay(stablecoin.address, scaledDepositAmount.div(3).mul(2)),
        ).to.be.revertedWith(ARITHMETIC_ERROR);
      });

      it('reverts if trying to repay with an unsupported token', async () => {
        await ctx.contracts.collateral.mintShare(admin.address, depositAmount); // collateral has 6 decimals
        expect(await ctx.contracts.collateral.balanceOf(admin.address)).to.eq(
          depositAmount,
        );

        await expect(
          pool.repay(ctx.contracts.collateral.address, depositAmount),
        ).to.be.revertedWith('SapphirePool: unknown token');
      });

      it('repays the correct amount of requested tokens and updates the creds correctly', async () => {
        expect(await stablecoin.balanceOf(admin.address)).to.eq(0);

        await pool.borrow(
          stablecoin.address,
          scaledDepositAmount,
          admin.address,
        );

        expect(await stablecoin.balanceOf(admin.address)).to.eq(depositAmount);
        expect(await pool.stablesLent()).to.eq(scaledDepositAmount);

        await pool.repay(stablecoin.address, depositAmount.div(2));

        expect(await stablecoin.balanceOf(admin.address)).to.eq(
          depositAmount.div(2),
        );
        expect(await pool.stablesLent()).to.eq(scaledDepositAmount.div(2));
      });

      it('correctly repays assets that have 18 decimals', async () => {
        const daiDepositAmount = scaledDepositAmount;
        const testDai = await new TestTokenFactory(admin).deploy(
          'TestDAI',
          'TDAI',
          18,
        );
        await testDai.mintShare(depositor.address, daiDepositAmount);
        await pool.setDepositLimit(testDai.address, daiDepositAmount);
        await pool.setCoreBorrowLimit(admin.address, daiDepositAmount);

        await approve(
          daiDepositAmount,
          testDai.address,
          pool.address,
          depositor,
        );
        await pool
          .connect(depositor)
          .deposit(testDai.address, daiDepositAmount);

        await pool.borrow(testDai.address, daiDepositAmount, admin.address);
        expect(await testDai.balanceOf(admin.address)).to.eq(daiDepositAmount);

        await approve(daiDepositAmount, testDai.address, pool.address, admin);
        await pool.repay(testDai.address, daiDepositAmount);
        expect(await testDai.balanceOf(admin.address)).to.eq(0);
      });

      it('decreases the token utilization borrow amount', async () => {
        let utilization = await pool.coreBorrowUtilization(admin.address);
        expect(utilization.amountUsed).to.eq(0);

        await pool.borrow(
          stablecoin.address,
          scaledDepositAmount.div(2),
          admin.address,
        );

        utilization = await pool.coreBorrowUtilization(admin.address);
        expect(utilization.amountUsed).to.eq(scaledDepositAmount.div(2));

        await pool.repay(stablecoin.address, depositAmount.div(2));

        utilization = await pool.coreBorrowUtilization(admin.address);
        expect(utilization.amountUsed).to.eq(0);
      });

      it('reverts if trying to repay if the limit for that stablecoin is 0', async () => {
        const testDai = await new TestTokenFactory(admin).deploy(
          'TestDAI',
          'TDAI',
          18,
        );
        await pool.setDepositLimit(testDai.address, scaledDepositAmount);
        await testDai.mintShare(pool.address, scaledDepositAmount);

        await pool.borrow(testDai.address, scaledDepositAmount, admin.address);

        await pool.setDepositLimit(testDai.address, 0);

        await testDai.approve(pool.address, scaledDepositAmount);
        await expect(
          pool.repay(testDai.address, scaledDepositAmount),
        ).to.be.revertedWith('SapphirePool: cannot repay with the given token');
      });
    });

    describe('#decreaseStablesLent', () => {
      beforeEach(async () => {
        await borrowAndRepaySetup();
        await pool.borrow(
          stablecoin.address,
          scaledDepositAmount,
          admin.address,
        );
      });

      it('reverts if called by a non-approved core', async () => {
        await expect(
          pool.connect(depositor).decreaseStablesLent(100),
        ).to.be.revertedWith('SapphirePool: sender is not a Core');
      });

      it('reverts if trying to reduce more than the current lent amount', async () => {
        expect(await pool.stablesLent()).to.eq(scaledDepositAmount);

        await expect(
          pool.decreaseStablesLent(scaledDepositAmount.add(1)),
        ).to.be.revertedWith(ARITHMETIC_ERROR);
      });

      it('reduces the stables lent amount correctly', async () => {
        expect(await pool.stablesLent()).to.eq(scaledDepositAmount);

        await pool.decreaseStablesLent(scaledDepositAmount.div(2));
        expect(await pool.stablesLent()).to.eq(scaledDepositAmount.div(2));
      });

      it('emits StablesLentDecreased', async () => {
        await expect(pool.decreaseStablesLent(scaledDepositAmount))
          .to.emit(pool, 'StablesLentDecreased')
          .withArgs(admin.address, scaledDepositAmount, 0);
      });
    });
  });

  describe('View functions', () => {
    describe('#accumulatedRewardAmount', () => {
      it('returns the current reward amount for the given token', async () => {
        expect(await stablecoin.balanceOf(pool.address)).to.eq(0);

        await pool.setDepositLimit(stablecoin.address, depositAmount.mul(2));

        await approve(
          depositAmount,
          stablecoin.address,
          pool.address,
          depositor,
        );
        await pool
          .connect(depositor)
          .deposit(stablecoin.address, depositAmount);

        await stablecoin.mintShare(pool.address, depositAmount);

        expect(await pool.accumulatedRewardAmount()).to.eq(scaledDepositAmount);
      });
    });

    describe('#getDepositAssets', () => {
      it('returns the correct deposit assets array', async () => {
        await pool.setDepositLimit(stablecoin.address, depositAmount);
        await pool.setDepositLimit(
          ctx.contracts.collateral.address,
          depositAmount,
        );

        expect(await pool.getDepositAssets()).to.deep.eq([
          stablecoin.address,
          ctx.contracts.collateral.address,
        ]);

        await pool.setDepositLimit(ctx.contracts.collateral.address, 0);

        expect(await pool.getDepositAssets()).to.deep.eq([stablecoin.address]);
      });
    });

    describe('#getPoolValue', () => {
      it('returns the current value of the pool with 1 stablecoin', async () => {
        await pool.setDepositLimit(stablecoin.address, depositAmount.mul(2));
        await stablecoin
          .connect(depositor)
          .approve(pool.address, depositAmount);
        await pool
          .connect(depositor)
          .deposit(stablecoin.address, depositAmount);

        expect(await pool.getPoolValue()).to.eq(scaledDepositAmount);
      });

      it('returns the current value of the pool with 2 stablecoins', async () => {
        const testDai = await new TestTokenFactory(admin).deploy(
          'TestDAI',
          'TDAI',
          18,
        );

        await pool.setDepositLimit(stablecoin.address, depositAmount.mul(2));
        await pool.setDepositLimit(
          testDai.address,
          depositAmount.mul(2).mul(stablecoinScalar),
        );

        await stablecoin
          .connect(depositor)
          .approve(pool.address, depositAmount);
        await testDai
          .connect(depositor)
          .approve(pool.address, scaledDepositAmount);

        await testDai.mintShare(depositor.address, scaledDepositAmount);

        expect(await pool.getPoolValue()).to.eq(0);

        await pool
          .connect(depositor)
          .deposit(stablecoin.address, depositAmount);
        await pool
          .connect(depositor)
          .deposit(testDai.address, scaledDepositAmount);

        expect(await pool.getPoolValue()).to.eq(scaledDepositAmount.mul(2));
      });

      it('returns the current value of the pool with 2 stablecoins, creds and rewards', async () => {
        const testDai = await new TestTokenFactory(admin).deploy(
          'TestDAI',
          'TDAI',
          18,
        );

        await pool.setDepositLimit(stablecoin.address, depositAmount);
        await pool.setDepositLimit(testDai.address, scaledDepositAmount);
        await pool.setCoreBorrowLimit(admin.address, scaledDepositAmount);

        await approve(
          depositAmount,
          stablecoin.address,
          pool.address,
          depositor,
        );
        await pool
          .connect(depositor)
          .deposit(stablecoin.address, depositAmount);

        await testDai.mintShare(depositor.address, scaledDepositAmount);
        await approve(
          scaledDepositAmount,
          testDai.address,
          pool.address,
          depositor,
        );
        await pool
          .connect(depositor)
          .deposit(testDai.address, scaledDepositAmount);

        await pool.borrow(
          stablecoin.address,
          scaledDepositAmount.div(2),
          admin.address,
        );

        // Deposit 100 rewards
        await stablecoin.mintShare(pool.address, depositAmount);

        // The pool should have 100 stablecoin + 50 testDai + 50 cr + 100 stablecoin rewards
        // = 300
        expect(await pool.getPoolValue()).to.eq(utils.parseEther('300'));
      });
    });
  });

  describe('Public functions', () => {
    describe('#deposit', () => {
      beforeEach(async () => {
        await pool.setDepositLimit(stablecoin.address, depositAmount.mul(2));
        await stablecoin
          .connect(depositor)
          .approve(pool.address, depositAmount);
      });

      it('reverts if user has not enough tokens', async () => {
        const utilization = await pool.assetDepositUtilization(
          stablecoin.address,
        );
        expect(utilization.limit).to.eq(depositAmount.mul(2));

        await expect(
          pool
            .connect(depositor)
            .deposit(stablecoin.address, depositAmount.add(1)),
        ).to.be.revertedWith(TRANSFER_FROM_FAILED);
      });

      it('reverts if trying to deposit more than the limit', async () => {
        await pool.setDepositLimit(stablecoin.address, depositAmount.sub(1));

        await expect(
          pool.connect(depositor).deposit(stablecoin.address, depositAmount),
        ).to.be.revertedWith(
          'SapphirePool: cannot deposit more than the limit',
        );
      });

      it('deposits the correct amount of tokens and mints an equal amount amount of LP tokens', async () => {
        // Mints an equal amount of LP tokens because the pool is empty
        expect(await pool.balanceOf(depositor.address)).to.eq(0);

        await pool
          .connect(depositor)
          .deposit(stablecoin.address, depositAmount);

        expect(await pool.balanceOf(depositor.address)).to.eq(
          scaledDepositAmount,
        );
        expect(await stablecoin.balanceOf(depositor.address)).to.eq(0);
      });

      it('mints an equal amount of LP tokens when the deposit token has 6 decimals', async () => {
        const testUsdc = await new TestTokenFactory(admin).deploy(
          'TestUSDC',
          'TUSDC',
          6,
        );
        const usdcDepositAmt = utils.parseUnits('100', 6);
        await testUsdc.mintShare(depositor.address, usdcDepositAmt);
        await testUsdc.connect(depositor).approve(pool.address, usdcDepositAmt);

        await pool.setDepositLimit(testUsdc.address, usdcDepositAmt.mul(2));

        expect(await pool.balanceOf(depositor.address)).to.eq(0);

        await pool.connect(depositor).deposit(testUsdc.address, usdcDepositAmt);

        expect(await pool.balanceOf(depositor.address)).to.eq(
          scaledDepositAmount,
        ); // 100 * 10^18
        expect(await pool.totalSupply()).to.eq(scaledDepositAmount);
        expect(await testUsdc.balanceOf(depositor.address)).to.eq(0);
      });

      it('mints an equal amount of LP tokens when the deposit token has 20 decimals', async () => {
        const testUsdc = await new TestTokenFactory(admin).deploy(
          'TestUSDC',
          'TUSDC',
          20,
        );
        const usdcDepositAmt = utils.parseUnits('100', 20);
        await testUsdc.mintShare(depositor.address, usdcDepositAmt);
        await testUsdc.connect(depositor).approve(pool.address, usdcDepositAmt);

        await pool.setDepositLimit(testUsdc.address, usdcDepositAmt.mul(2));

        expect(await pool.balanceOf(depositor.address)).to.eq(0);

        await pool.connect(depositor).deposit(testUsdc.address, usdcDepositAmt);

        expect(await pool.balanceOf(depositor.address)).to.eq(
          utils.parseEther('100'),
        ); // 100 * 10^18
        expect(await pool.totalSupply()).to.eq(utils.parseEther('100'));
        expect(await testUsdc.balanceOf(depositor.address)).to.eq(0);
      });

      it('increases the total supply of the LP token', async () => {
        expect(await pool.totalSupply()).to.eq(0);

        await pool
          .connect(depositor)
          .deposit(stablecoin.address, depositAmount.div(2));
        expect(await pool.totalSupply()).to.eq(
          depositAmount.div(2).mul(stablecoinScalar),
        );

        await pool
          .connect(depositor)
          .deposit(stablecoin.address, depositAmount.div(2));
        expect(await pool.totalSupply()).to.eq(scaledDepositAmount);
      });

      it("increases the user's deposit amount", async () => {
        expect(await pool.deposits(depositor.address)).to.eq(0);

        await pool
          .connect(depositor)
          .deposit(stablecoin.address, depositAmount.div(2));

        expect(await pool.deposits(depositor.address)).to.eq(
          scaledDepositAmount.div(2),
        );

        await pool
          .connect(depositor)
          .deposit(stablecoin.address, depositAmount.div(2));

        expect(await pool.deposits(depositor.address)).to.eq(
          scaledDepositAmount,
        );
      });

      it('mints a proportional amount of LP tokens after some rewards were already deposited', async () => {
        await pool
          .connect(depositor)
          .deposit(stablecoin.address, depositAmount.div(2));

        expect(await pool.balanceOf(depositor.address)).to.eq(
          scaledDepositAmount.div(2),
        );

        // 100 rewards come into the pool
        await stablecoin.mintShare(pool.address, depositAmount);

        await pool
          .connect(depositor)
          .deposit(stablecoin.address, depositAmount.div(2));

        const expectedAdditionalLpTokens = roundUpDiv(
          scaledDepositAmount.div(2).mul(scaledDepositAmount.div(2)).div(BASE),
          scaledDepositAmount.div(2).add(scaledDepositAmount),
        );

        expect(
          await pool.balanceOf(depositor.address),
          'final lp balance',
        ).to.eq(scaledDepositAmount.div(2).add(expectedAdditionalLpTokens));
      });
    });

    describe('#withdraw', () => {
      beforeEach(async () => {
        await pool.setDepositLimit(stablecoin.address, depositAmount.mul(2));
        await stablecoin
          .connect(depositor)
          .approve(pool.address, depositAmount.mul(2));
        await pool
          .connect(depositor)
          .deposit(stablecoin.address, depositAmount);
      });

      it("reverts if trying to convert more LP tokens that the user's balance", async () => {
        await expect(
          pool
            .connect(depositor)
            .withdraw(scaledDepositAmount.add(1), stablecoin.address),
        ).to.be.revertedWith(ARITHMETIC_ERROR);
      });

      it('withdraws the correct amount of tokens with 18 decimals', async () => {
        expect(await stablecoin.balanceOf(depositor.address)).to.eq(0);
        expect(await pool.balanceOf(depositor.address)).to.eq(
          scaledDepositAmount,
        );

        await pool
          .connect(depositor)
          .withdraw(scaledDepositAmount, stablecoin.address);

        expect(await stablecoin.balanceOf(depositor.address)).to.eq(
          depositAmount,
        );
        expect(await pool.balanceOf(depositor.address)).to.eq(0);
      });

      it('reverts if withdrawing more than the available balance on the contract', async () => {
        await pool.setCoreBorrowLimit(admin.address, scaledDepositAmount);

        await pool.borrow(
          stablecoin.address,
          scaledDepositAmount,
          admin.address,
        ),
          await expect(
            pool
              .connect(depositor)
              .withdraw(scaledDepositAmount, stablecoin.address),
          ).to.be.revertedWith(TRANSFER_FAILED);
      });

      it('reverts if withdrawing for tokens that are not supported', async () => {
        const testUsdc = await new TestTokenFactory(admin).deploy(
          'TestUSDC',
          'TUSDC',
          6,
        );
        await testUsdc.mintShare(pool.address, utils.parseUnits('100', 6));

        await expect(
          pool
            .connect(depositor)
            .withdraw(utils.parseUnits('100', 6), testUsdc.address),
        ).to.be.revertedWith('SapphirePool: unknown token');
      });

      it('withdraws token with 8 decimals', async () => {
        expect(await stablecoin.decimals()).to.eq(8);
        // The user already deposited depositAmount in beforeEach()
        expect(await pool.balanceOf(depositor.address)).to.eq(
          scaledDepositAmount,
        );

        await pool
          .connect(depositor)
          .withdraw(scaledDepositAmount, stablecoin.address);

        expect(await pool.balanceOf(depositor.address)).to.eq(0); // 100 * 10^18
        expect(await pool.totalSupply()).to.eq(0);
        expect(await stablecoin.balanceOf(depositor.address)).to.eq(
          depositAmount,
        );
      });

      it('withdraws token with 20 decimals', async () => {
        const testUsdc = await new TestTokenFactory(admin).deploy(
          'TestUSDC',
          'TUSDC',
          20,
        );
        const usdcDepositAmt = utils.parseUnits('100', 20);
        await testUsdc.mintShare(depositor.address, usdcDepositAmt);
        await testUsdc.connect(depositor).approve(pool.address, usdcDepositAmt);

        await pool.setDepositLimit(testUsdc.address, usdcDepositAmt.mul(2));

        // The user already deposited depositAmount in TDAI from the beforeEach()
        expect(await pool.balanceOf(depositor.address)).to.eq(
          scaledDepositAmount,
        );

        await pool.connect(depositor).deposit(testUsdc.address, usdcDepositAmt);

        expect(await pool.balanceOf(depositor.address)).to.eq(
          depositAmount.mul(2).mul(stablecoinScalar),
        );
        expect(await pool.totalSupply()).to.eq(
          depositAmount.mul(2).mul(stablecoinScalar),
        );

        await pool
          .connect(depositor)
          .withdraw(scaledDepositAmount, testUsdc.address);

        expect(await pool.balanceOf(depositor.address)).to.eq(
          scaledDepositAmount,
        ); // 100 * 10^18
        expect(await pool.totalSupply()).to.eq(scaledDepositAmount);
        expect(await testUsdc.balanceOf(depositor.address)).to.eq(
          usdcDepositAmt,
        );
      });

      it('withdraws the proportional amount of reward in the selected currency (1 currency available)', async () => {
        await stablecoin.mintShare(pool.address, depositAmount);

        expect(await stablecoin.balanceOf(depositor.address)).to.eq(0);

        await pool
          .connect(depositor)
          .withdraw(scaledDepositAmount, stablecoin.address);
        expect(await stablecoin.balanceOf(depositor.address)).to.eq(
          depositAmount.mul(2),
        );
      });

      it('withdraws the proportional amount of reward in the selected currency (2 currencies available)', async () => {
        const testDai = await new TestTokenFactory(admin).deploy(
          'TestDAI',
          'TDAI',
          18,
        );

        await pool.setDepositLimit(testDai.address, scaledDepositAmount);
        await testDai.mintShare(pool.address, scaledDepositAmount);

        expect(await testDai.balanceOf(depositor.address)).to.eq(0);

        await pool
          .connect(depositor)
          .withdraw(scaledDepositAmount.div(2), testDai.address);
        expect(await testDai.balanceOf(depositor.address)).to.eq(
          scaledDepositAmount,
        );
      });

      it('decreases the total supply of the LP token', async () => {
        expect(await pool.totalSupply()).to.eq(scaledDepositAmount);

        await pool
          .connect(depositor)
          .withdraw(
            depositAmount.div(2).mul(stablecoinScalar),
            stablecoin.address,
          );
        expect(await pool.totalSupply()).to.eq(
          depositAmount.div(2).mul(stablecoinScalar),
        );

        await pool
          .connect(depositor)
          .withdraw(
            depositAmount.div(2).mul(stablecoinScalar),
            stablecoin.address,
          );
        expect(await pool.totalSupply()).to.eq(0);
      });

      it('decreases the user deposit amount', async () => {
        expect(await pool.deposits(depositor.address)).to.eq(
          scaledDepositAmount,
        );

        await pool
          .connect(depositor)
          .withdraw(scaledDepositAmount.div(2), stablecoin.address);

        expect(await pool.deposits(depositor.address)).to.eq(
          scaledDepositAmount.div(2),
        );

        await pool
          .connect(depositor)
          .withdraw(scaledDepositAmount.div(2), stablecoin.address);

        expect(await pool.deposits(depositor.address)).to.eq(0);
      });

      it('decreases the asset utilization', async () => {
        let utilization = await pool.assetDepositUtilization(
          stablecoin.address,
        );
        expect(utilization.amountUsed).to.eq(depositAmount);

        await pool
          .connect(depositor)
          .withdraw(scaledDepositAmount, stablecoin.address);

        utilization = await pool.assetDepositUtilization(stablecoin.address);
        expect(utilization.amountUsed).to.eq(0);
      });
    });
  });

  // Spreadsheets for these scenarios:
  // https://docs.google.com/spreadsheets/d/1N55ls2dfFIqXVVEEAF6Iq6SoxcCrslcXn5N4e_L5fNo/edit#gid=163017817
  describe('Scenarios', () => {
    let userA: SignerWithAddress;
    let userB: SignerWithAddress;

    beforeEach(async () => {
      userA = depositor;
      userB = ctx.signers.staker;

      await approve(
        depositAmount.mul(10),
        stablecoin.address,
        pool.address,
        userA,
      );
      await approve(
        depositAmount.mul(10),
        stablecoin.address,
        pool.address,
        userB,
      );
    });

    it('Scenario 1: 2 LPs deposit and withdraw at different times, while rewards are being added', async () => {
      await pool.setDepositLimit(stablecoin.address, depositAmount.mul(2));
      await stablecoin.mintShare(userB.address, depositAmount);

      // User A deposits 100
      await pool.connect(userA).deposit(stablecoin.address, depositAmount);
      expect(await pool.balanceOf(userA.address)).to.eq(scaledDepositAmount);
      expect(await pool.deposits(userA.address)).to.eq(scaledDepositAmount);

      // 100 rewards are added
      await stablecoin.mintShare(pool.address, depositAmount);

      // User B deposits 100
      await pool.connect(userB).deposit(stablecoin.address, depositAmount);
      expect(await pool.balanceOf(userB.address)).to.eq(utils.parseEther('50'));

      // 300 usdc rewards are added
      await stablecoin.mintShare(pool.address, depositAmount.mul(3));

      // User A withdraws half of its LPs
      const withdrawAmount = (await pool.balanceOf(userA.address)).div(2);
      await pool.connect(userA).withdraw(withdrawAmount, stablecoin.address);

      expect(await pool.balanceOf(userA.address)).to.eq(utils.parseEther('50'));
      expect(await stablecoin.balanceOf(userA.address)).to.eq(
        depositAmount.mul(2), // 200
      );
      expect(await pool.deposits(userA.address)).to.eq(0);

      // User B exits
      await pool
        .connect(userB)
        .withdraw(utils.parseEther('50'), stablecoin.address);
      expect(await pool.balanceOf(userB.address)).to.eq(0);
      expect(await stablecoin.balanceOf(userB.address)).to.eq(
        depositAmount.mul(2),
      );

      // User A exits
      await pool
        .connect(userA)
        .withdraw(utils.parseEther('50'), stablecoin.address);
      expect(await pool.balanceOf(userA.address)).to.eq(0);
      expect(await stablecoin.balanceOf(userA.address)).to.eq(
        depositAmount.mul(4),
      );
    });

    it('Scenario 2: 2 LPs with 2 cores interact with the pool', async () => {
      const core = ctx.signers.scoredBorrower;

      // Initial state (A 1000, B 500)
      await stablecoin.mintShare(userA.address, depositAmount.mul(9)); // User A already has 100
      await stablecoin.mintShare(userB.address, depositAmount.mul(5));
      await pool.setDepositLimit(stablecoin.address, depositAmount.mul(15));

      await pool.setCoreBorrowLimit(core.address, scaledDepositAmount);

      // User A stakes 1000 USDC
      await pool
        .connect(userA)
        .deposit(stablecoin.address, depositAmount.mul(10));
      expect(await pool.balanceOf(userA.address)).to.eq(
        scaledDepositAmount.mul(10),
      );

      // User B stakes 500 USDC
      await pool
        .connect(userB)
        .deposit(stablecoin.address, depositAmount.mul(5));
      expect(await pool.balanceOf(userB.address)).to.eq(
        scaledDepositAmount.mul(5),
      );

      // Core borrows 100 USDC
      await pool
        .connect(core)
        .borrow(stablecoin.address, scaledDepositAmount, admin.address);
      expect(await pool.stablesLent()).to.eq(scaledDepositAmount);
      expect(await stablecoin.balanceOf(pool.address)).to.eq(
        depositAmount.mul(14),
      );

      // 100 USDC rewards are added
      await stablecoin.mintShare(pool.address, depositAmount);

      // User B withdraws 100 LP
      const poolValue = await pool.getPoolValue();
      const totalSupply = await pool.totalSupply();
      let expectedWithdraw = scaledDepositAmount
        .mul(poolValue)
        .div(totalSupply);
      expectedWithdraw = expectedWithdraw.div(
        // Convert from 18 decimals to 6
        stablecoinScalar,
      );

      const preWithdrawUtilization = await pool.assetDepositUtilization(
        stablecoin.address,
      );
      expect(preWithdrawUtilization.amountUsed).to.eq(depositAmount.mul(15));

      await pool
        .connect(userB)
        .withdraw(scaledDepositAmount, stablecoin.address);

      const postWithdrawBalance = await stablecoin.balanceOf(userB.address);
      expect(expectedWithdraw).to.eq(postWithdrawBalance);

      const postWithdrawUtilization = await pool.assetDepositUtilization(
        stablecoin.address,
      );
      expect(postWithdrawUtilization.amountUsed).to.eq(
        preWithdrawUtilization.amountUsed.sub(expectedWithdraw),
      );

      expect(await stablecoin.balanceOf(userB.address)).to.eq(expectedWithdraw);
      expect(await stablecoin.balanceOf(pool.address)).to.eq(
        depositAmount.mul(15).sub(expectedWithdraw),
      );
      expect(await pool.getPoolValue()).to.eq(
        scaledDepositAmount.mul(16).sub(expectedWithdraw.mul(stablecoinScalar)),
      );

      // User B stakes 100 USDC for x LP
      const userBlpBalance = await pool.balanceOf(userB.address);
      const initialStableUserBBalance = await stablecoin.balanceOf(
        userB.address,
      );
      await pool.connect(userB).deposit(stablecoin.address, depositAmount);
      const earnedLP = (await pool.balanceOf(userB.address)).sub(
        userBlpBalance,
      );

      // User B withdraws x LP - expect that the user does not end up with more than what he staked above
      await pool.connect(userB).withdraw(earnedLP, stablecoin.address);
      expect(await pool.balanceOf(userB.address)).to.eq(userBlpBalance);
      expect(await stablecoin.balanceOf(userB.address)).to.eq(
        initialStableUserBBalance,
      );
    });

    it('Scenario 3: asset utilization is properly decreased when withdrawing more than deposited', async () => {
      await pool.setDepositLimit(stablecoin.address, depositAmount.mul(2));

      // Initial state (A 100, B 100)
      await stablecoin.mintShare(userB.address, depositAmount); // User A already has 100

      // A deposits 100
      await pool.connect(userA).deposit(stablecoin.address, depositAmount);

      // B deposits 100
      await pool.connect(userB).deposit(stablecoin.address, depositAmount);

      // 200 USDC rewards are added
      await stablecoin.mintShare(pool.address, depositAmount.mul(2));

      // Asset utilization should be 200
      let assetUtilization = await pool.assetDepositUtilization(
        stablecoin.address,
      );
      expect(assetUtilization.amountUsed).to.eq(depositAmount.mul(2));
      // A withdraws all (including rewards) (should be $150)
      await pool
        .connect(userA)
        .withdraw(scaledDepositAmount, stablecoin.address);
      // Asset utilization should be 100
      assetUtilization = await pool.assetDepositUtilization(stablecoin.address);
      expect(assetUtilization.amountUsed).to.eq(depositAmount);
    });

    it('Scenario 4: 2 users deposit, reward is added, and both exit', async () => {
      // Initial state: (A 100k, B 1k)
      const aDeposit = utils.parseUnits('100000', DEFAULT_STABLECOIN_DECIMALS);
      const bDeposit = utils.parseUnits('1000', DEFAULT_STABLECOIN_DECIMALS);
      await stablecoin.mintShare(userA.address, aDeposit);
      await stablecoin.mintShare(userB.address, bDeposit);
      await approve(aDeposit, stablecoin.address, pool.address, userA);
      await approve(bDeposit, stablecoin.address, pool.address, userB);
      await pool.setDepositLimit(
        stablecoin.address,
        utils.parseUnits('1000000', DEFAULT_STABLECOIN_DECIMALS),
      );

      // A deposits 100k
      await pool.connect(userA).deposit(stablecoin.address, aDeposit);

      // B deposits 1k
      await pool.connect(userB).deposit(stablecoin.address, bDeposit);

      // 6.06k rewards are added
      await stablecoin.mintShare(
        pool.address,
        utils.parseUnits('6060', DEFAULT_STABLECOIN_DECIMALS),
      );

      // A withdraws all (100k + 6k)
      await pool
        .connect(userA)
        .withdraw(await pool.balanceOf(userA.address), stablecoin.address);

      // Can B withdraw 1$?
      await expect(
        pool
          .connect(userB)
          .withdraw(
            utils.parseUnits('1', DEFAULT_STABLECOIN_DECIMALS),
            stablecoin.address,
          ),
      ).to.not.be.reverted;
    });
  });

  xdescribe('Upgrade test (v1 -> v2)', () => {
    const usdcAddress = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';
    const poolProxyAddress = '0x59b8a21A0B0cE87E308082Af6fFC4205b5dC932C';
    const deployerAddress = '0x9c767178528c8a205DF63305ebdA4BB6B147889b';
    const otherLPAddress = '0xbb4153b55a59cc8bde72550b0cf16781b08ef7b0';
    const usdcScalar = 10 ** 12;
    const provider = hre.network.provider;

    beforeEach(async () => {
      await provider.request({
        method: 'hardhat_impersonateAccount',
        params: [deployerAddress],
      });
      await provider.request({
        method: 'hardhat_impersonateAccount',
        params: [otherLPAddress],
      });
    });

    afterEach(async () => {
      await provider.request({
        method: 'hardhat_stopImpersonatingAccount',
        params: [deployerAddress],
      });
      await provider.request({
        method: 'hardhat_stopImpersonatingAccount',
        params: [otherLPAddress],
      });
    });

    async function getLpForUsdcAmount(
      usdcAmount: BigNumber,
      poolContract: SapphirePool,
    ) {
      const supply = await poolContract.totalSupply();
      const poolValue = await poolContract.getPoolValue();
      return roundUpDiv(
        usdcAmount.mul(usdcScalar).mul(supply).div(BASE),
        poolValue,
      );
    }

    it('repairs pool, can withdraw what is available', async () => {
      const deployer = await hre.ethers.getSigner(deployerAddress);
      const poolDeployer = SapphirePoolFactory.connect(
        poolProxyAddress,
        deployer,
      );
      const usdcContract = BaseERC20Factory.connect(usdcAddress, deployer);

      // Upgrade contract
      const upgrade = await new SapphirePoolFactory(deployer).deploy();
      await ArcProxyFactory.connect(poolProxyAddress, deployer).upgradeTo(
        upgrade.address,
      );

      // deployer tries to withdraw the amount of deposit utilization + 1 and fails
      const {
        amountUsed: assetUtilization,
      } = await poolDeployer.assetDepositUtilization(usdcAddress);
      const depositUtilizationLpEquivalent = await getLpForUsdcAmount(
        assetUtilization,
        poolDeployer,
      );
      await expect(
        poolDeployer.withdraw(
          depositUtilizationLpEquivalent.add(utils.parseEther('1')),
          usdcAddress,
        ),
      ).to.be.reverted;

      // deployer withdraws exactly the deposit utilization, which should set the utilization to 0
      console.log(
        'magic number withdraw (lp equivalent of the asset utilization)',
      );
      const lpBalance = await poolDeployer.balanceOf(deployer.address);
      console.log('lpBalance', lpBalance.toString());
      await poolDeployer.withdraw(depositUtilizationLpEquivalent, usdcAddress);

      expect(
        (await poolDeployer.assetDepositUtilization(usdcAddress)).amountUsed,
      ).to.eq(0);

      // admin sets deployer's utilization to 0
      await poolDeployer.resetBorrowUtilization(deployer.address);

      // second LP exits
      const otherLP = await hre.ethers.getSigner(otherLPAddress);
      const otherLpBalance = await poolDeployer.balanceOf(otherLP.address);
      await approve(
        otherLpBalance,
        poolDeployer.address,
        poolDeployer.address,
        otherLP,
      );
      await poolDeployer.connect(otherLP).withdraw(otherLpBalance, usdcAddress);

      // deployer should now be able to withdraw all the available rest
      console.log('deployer withdraws all');
      const usdcBalance = await usdcContract.balanceOf(poolProxyAddress);
      const lpToWithdraw = await getLpForUsdcAmount(usdcBalance, poolDeployer);
      await approve(
        lpToWithdraw,
        poolDeployer.address,
        poolDeployer.address,
        deployer,
      );
      console.log('withdrawing lp amount:', lpToWithdraw.toString());
      await poolDeployer.withdraw(lpToWithdraw, usdcAddress);

      expect(await usdcContract.balanceOf(poolProxyAddress)).to.eq(0);

      /**
       * NOTE:
       * As a side-effect of this fix, there is now an additional ~3k usdc that is not accounted
       * in the deposit limit.
       */
    });
  });

  describe.only('Upgrade test (v2 -> v3)', () => {
    /**
     * Runs on a local mainnet polygon fork
     */

    const poolOwner = '0xc033f3488584f4c929b2d78326f0fb84cbc7d525';
    const provider = new ethers.providers.JsonRpcProvider(
      'http://localhost:8545',
    );
    const coreAddress = '0x05efe26f4a75EA4d183e8a7922494d60adfB27b3';
    const proxyAddress = '0x59b8a21A0B0cE87E308082Af6fFC4205b5dC932C';
    const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

    let signer: ethers.providers.JsonRpcSigner;

    before(async () => {
      await provider.send('hardhat_impersonateAccount', [poolOwner]);
      await provider.send('hardhat_setBalance', [
        poolOwner,
        '0x3635C9ADC5DEA00000',
      ]);

      signer = provider.getSigner(poolOwner);
    });

    after(async () => {
      await provider.send('hardhat_stopImpersonatingAccount', [poolOwner]);
    });

    it('replicates the bug: setting existing borrow limit duplicates the _knownCores variable', async () => {
      /**
       * This causes so that setting a smaller deposit limit of an asset would
       * revert because the sum of the cores will be duplicated
       */

      const pool = SapphirePoolFactory.connect(proxyAddress, signer);
      await expect(
        pool.setDepositLimit(usdcAddress, utils.parseUnits('100000', 6)),
      ).to.be.revertedWith(
        'SapphirePool: sum of borrow limits exceeds sum of deposit limits',
      );
    });

    it('repairs pool: setting deposit limit to core does not duplicate amounts', async () => {
      const poolProxy = ArcProxyFactory.connect(proxyAddress, signer);
      const poolImpl = await new SapphirePoolFactory(signer).deploy();
      await poolProxy.upgradeTo(poolImpl.address);
      const pool = SapphirePoolFactory.connect(proxyAddress, signer);

      // Ensure the nr of active cores does not increase if adding a known core
      let activeCores = await pool.getActiveCores();
      expect(activeCores.length).eq(2);
      await pool.setCoreBorrowLimit(coreAddress, utils.parseEther('40000'));
      activeCores = await pool.getActiveCores();
      expect(activeCores.length).eq(2);

      // At this point in the fork there are two identical cores in the "active cores" array:
      expect(activeCores[0].toString()).eq(activeCores[1].toString());

      // Ensure that setting a core borrow limit to 0 removes it from the active cores array
      await pool.setCoreBorrowLimit(coreAddress, 0);
      activeCores = await pool.getActiveCores();
      expect(activeCores.length).eq(0);

      // Ensure setting a deposit limit works
      await expect(
        pool.setDepositLimit(usdcAddress, utils.parseUnits('100000', 6)),
      ).to.not.be.reverted;

      // Ensure a newly added core is added to the known cores list
      const newCore = '0x69b37541d1C00c949B530ccd3d23437188767160';
      await pool.setCoreBorrowLimit(newCore, utils.parseEther('100000'));
      activeCores = await pool.getActiveCores();
      expect(activeCores.length).eq(1);
      expect(activeCores).includes(newCore);
    });
  });
});
