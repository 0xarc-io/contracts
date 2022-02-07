import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {
  ArcProxyFactory,
  MockSapphirePool,
  MockSapphirePoolFactory,
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
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber, BigNumberish, utils } from 'ethers';
import { generateContext, ITestContext } from '../context';
import { sapphireFixture } from '../fixtures';

describe('SapphirePool', () => {
  let pool: MockSapphirePool;

  let stablecoin: TestToken;
  let creds: TestToken;

  let depositAmount: BigNumber; // 6 decimals
  let scaledDepositAmount: BigNumber; // 18 decimals
  let stablecoinScalar: BigNumberish;
  let ctx: ITestContext;

  let admin: SignerWithAddress;
  let depositor: SignerWithAddress;

  before(async () => {
    ctx = await generateContext(sapphireFixture);
    admin = ctx.signers.admin;
    depositor = ctx.signers.unauthorized;
    stablecoin = ctx.contracts.stableCoin;

    creds = await new TestTokenFactory(admin).deploy('Creds', 'CREDS', 18);

    const sapphirePoolImpl = await new MockSapphirePoolFactory(admin).deploy();
    const proxy = await new ArcProxyFactory(admin).deploy(
      sapphirePoolImpl.address,
      admin.address,
      [],
    );
    pool = MockSapphirePoolFactory.connect(proxy.address, admin);

    await pool.init('Sapphire Pool', 'SAP', creds.address);

    const stablecoinDecimals = await stablecoin.decimals();
    depositAmount = utils.parseUnits('100', stablecoinDecimals);
    stablecoinScalar = 10 ** (18 - stablecoinDecimals);
    scaledDepositAmount = depositAmount.mul(stablecoinScalar);

    await stablecoin.mintShare(depositor.address, depositAmount);
  });

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

        await expect(
          _pool.init('Sapphire Pool', 'SAP', creds.address),
        ).to.be.revertedWith(ADMINABLE_ERROR);
      });

      it('sets the name, symbol and decimals', async () => {
        expect(await pool.name()).to.equal('Sapphire Pool');
        expect(await pool.symbol()).to.equal('SAP');
        expect(await pool.decimals()).to.equal(18);
      });

      it('sets the address of the creds token', async () => {
        expect(await pool.credsToken()).to.equal(creds.address);
      });
    });

    describe('#setCoreSwapLimit', () => {
      it('reverts if set by non-admin', async () => {
        await expect(
          pool
            .connect(depositor)
            .setCoreSwapLimit(ctx.contracts.sapphire.core.address, 1000),
        ).to.be.revertedWith(ADMINABLE_ERROR);
      });

      it('reverts if setting limit that makes the sum of the limits of the cores greater than than the sum of the deposit limits', async () => {
        await pool.setDepositLimit(stablecoin.address, depositAmount);
        await pool.setDepositLimit(creds.address, scaledDepositAmount);

        await pool.setCoreSwapLimit(admin.address, scaledDepositAmount);
        await expect(
          pool.setCoreSwapLimit(depositor.address, scaledDepositAmount.add(1)),
        ).to.be.revertedWith(
          'SapphirePool: swap limit is greater than the sum of the deposit limits',
        );
      });

      it('sets the limit for how many CR can be swapped in for tokens', async () => {
        let utilization = await pool.coreSwapUtilization(
          ctx.contracts.sapphire.core.address,
        );
        expect(utilization.limit).to.eq(0);

        await pool.setDepositLimit(stablecoin.address, depositAmount);
        await pool.setCoreSwapLimit(ctx.contracts.sapphire.core.address, 1000);

        utilization = await pool.coreSwapUtilization(
          ctx.contracts.sapphire.core.address,
        );
        expect(utilization.limit).to.eq(1000);
        expect(utilization.amountUsed).to.eq(0);
      });
    });

    describe('#setDepositLimit', () => {
      it('reverts if called by non-admin', async () => {
        await expect(
          pool.connect(depositor).setDepositLimit(stablecoin.address, 1000),
        ).to.be.revertedWith(ADMINABLE_ERROR);
      });

      it('sets the limit for how many stablecoins can be deposited', async () => {
        let utilization = await pool.assetsUtilization(stablecoin.address);
        expect(utilization.amountUsed).to.deep.eq(0);
        expect(utilization.limit).to.deep.eq(0);

        await pool.setDepositLimit(stablecoin.address, 1000);

        utilization = await pool.assetsUtilization(stablecoin.address);
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
          'SapphirePool: cannot set the limit of an unsupported asset to 0',
        );
      });

      it('reverts if setting a limit that makes the sum of the deposit limits smaller than than the sum of the swap limits', async () => {
        await pool.setDepositLimit(stablecoin.address, depositAmount);
        await pool.setDepositLimit(creds.address, scaledDepositAmount);

        await pool.setCoreSwapLimit(admin.address, scaledDepositAmount);
        await pool.setCoreSwapLimit(depositor.address, scaledDepositAmount);

        await expect(
          pool.setDepositLimit(stablecoin.address, depositAmount.mul(2).div(3)),
        ).to.be.revertedWith(
          'SapphirePool: sum of deposit limits smaller than the sum of the swap limits',
        );
      });

      it('if limit is 0, removes the token from the list of tokens that can be deposited', async () => {
        await pool.setDepositLimit(stablecoin.address, 1000);
        expect(await pool.getDepositAssets()).to.deep.eq([stablecoin.address]);

        await pool.setDepositLimit(stablecoin.address, 0);

        expect(await pool.getDepositAssets()).to.be.empty;
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
    });

    describe('#swap', () => {
      beforeEach(async () => {
        await pool.setDepositLimit(stablecoin.address, depositAmount.mul(2));
        await pool.setCoreSwapLimit(admin.address, scaledDepositAmount);

        await approve(
          depositAmount,
          stablecoin.address,
          pool.address,
          depositor,
        );
        await pool
          .connect(depositor)
          .deposit(stablecoin.address, depositAmount);

        await creds.mintShare(admin.address, scaledDepositAmount);

        await approve(scaledDepositAmount, creds.address, pool.address, admin);
        await approve(depositAmount, stablecoin.address, pool.address, admin);
      });

      it('reverts if called by a non-approved core', async () => {
        await expect(
          pool
            .connect(depositor)
            .swap(
              creds.address,
              stablecoin.address,
              scaledDepositAmount.div(2),
            ),
        ).to.be.revertedWith('SapphirePool: caller is not an approved core');

        await expect(
          pool
            .connect(depositor)
            .swap(
              stablecoin.address,
              creds.address,
              scaledDepositAmount.div(2),
            ),
        ).to.be.revertedWith('SapphirePool: caller is not an approved core');
      });

      it('reverts if there are not enough requested coins', async () => {
        await pool
          .connect(depositor)
          .withdraw(scaledDepositAmount.div(2), stablecoin.address);

        expect(await stablecoin.balanceOf(pool.address)).to.eq(
          depositAmount.div(2),
        );

        await expect(
          pool.swap(
            creds.address,
            stablecoin.address,
            scaledDepositAmount.div(3).mul(2),
          ),
        ).to.be.revertedWith(TRANSFER_FAILED);
      });

      it('reverts if trying to swap creds for an unsupported token', async () => {
        await expect(
          pool.swap(
            creds.address,
            ctx.contracts.collateral.address,
            scaledDepositAmount,
          ),
        ).to.be.revertedWith('SapphirePool: unsupported out token');
      });

      it('reverts if trying to swap an unsupported token for creds', async () => {
        await ctx.contracts.collateral.mintShare(admin.address, depositAmount); // collateral has 6 decimals
        expect(await ctx.contracts.collateral.balanceOf(admin.address)).to.eq(
          depositAmount,
        );

        await pool.swap(creds.address, stablecoin.address, scaledDepositAmount);

        await expect(
          pool.swap(
            ctx.contracts.collateral.address,
            creds.address,
            depositAmount,
          ),
        ).to.be.revertedWith('SapphirePool: unsupported in token');
      });

      it('reverts if trying to swap between two tokens where creds is not one of them', async () => {
        // Populate the pool with two tokens
        const testDai = await new TestTokenFactory(admin).deploy(
          'TestDAI',
          'TDAI',
          18,
        );
        await testDai.mintShare(depositor.address, scaledDepositAmount);

        await pool.setDepositLimit(testDai.address, scaledDepositAmount);

        await approve(
          scaledDepositAmount,
          testDai.address,
          pool.address,
          depositor,
        );
        await pool
          .connect(depositor)
          .deposit(testDai.address, scaledDepositAmount);

        await expect(
          pool.swap(testDai.address, stablecoin.address, scaledDepositAmount),
        ).to.be.revertedWith('SapphirePool: invalid swap tokens');
      });

      it('reverts if trying to swap between two creds tokens', async () => {
        await expect(
          pool.swap(creds.address, creds.address, scaledDepositAmount),
        ).to.be.revertedWith('SapphirePool: invalid swap tokens');
      });

      it('reverts if core tries to swap more than its limit', async () => {
        await pool.setCoreSwapLimit(admin.address, scaledDepositAmount.sub(1));

        await expect(
          pool.swap(creds.address, stablecoin.address, scaledDepositAmount),
        ).to.be.revertedWith('SapphirePool: core swap limit exceeded');
      });

      it('swaps the correct amount of requested tokens in exchange of CR', async () => {
        expect(await stablecoin.balanceOf(admin.address)).to.eq(0);

        await pool.swap(creds.address, stablecoin.address, scaledDepositAmount);

        expect(await stablecoin.balanceOf(admin.address)).to.eq(depositAmount);
        expect(await creds.balanceOf(admin.address)).to.eq(0);

        await pool.swap(
          stablecoin.address,
          creds.address,
          depositAmount.div(2),
        );

        expect(await stablecoin.balanceOf(admin.address)).to.eq(
          depositAmount.div(2),
        );
        expect(await creds.balanceOf(admin.address)).to.eq(
          scaledDepositAmount.div(2),
        );
      });

      it('correctly swaps assets that have 18 decimals', async () => {
        const daiDepositAmount = scaledDepositAmount;
        const testDai = await new TestTokenFactory(admin).deploy(
          'TestDAI',
          'TDAI',
          18,
        );
        await testDai.mintShare(depositor.address, daiDepositAmount);
        await pool.setDepositLimit(testDai.address, daiDepositAmount);
        await pool.setCoreSwapLimit(admin.address, daiDepositAmount);

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

        await pool.swap(creds.address, testDai.address, daiDepositAmount);
        expect(await testDai.balanceOf(admin.address)).to.eq(daiDepositAmount);
      });

      it('increases the token utilization borrow amount when swapping creds for tokens', async () => {
        let utilization = await pool.coreSwapUtilization(admin.address);
        expect(utilization.amountUsed).to.eq(0);

        await pool.swap(
          creds.address,
          stablecoin.address,
          scaledDepositAmount.div(2),
        );

        utilization = await pool.coreSwapUtilization(admin.address);
        expect(utilization.amountUsed).to.eq(scaledDepositAmount.div(2));

        await pool.swap(
          creds.address,
          stablecoin.address,
          scaledDepositAmount.div(2),
        );

        utilization = await pool.coreSwapUtilization(admin.address);
        expect(utilization.amountUsed).to.eq(scaledDepositAmount);
      });

      it('decreases the token utilization borrow amount when swapping tokens for creds', async () => {
        let utilization = await pool.coreSwapUtilization(admin.address);
        expect(utilization.amountUsed).to.eq(0);

        await pool.swap(creds.address, stablecoin.address, scaledDepositAmount);

        utilization = await pool.coreSwapUtilization(admin.address);
        expect(utilization.amountUsed).to.eq(scaledDepositAmount);

        await pool.swap(
          stablecoin.address,
          creds.address,
          depositAmount.div(2),
        );

        utilization = await pool.coreSwapUtilization(admin.address);
        expect(utilization.amountUsed).to.eq(scaledDepositAmount.div(2));
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
        await pool.setDepositLimit(creds.address, depositAmount);

        expect(await pool.getDepositAssets()).to.deep.eq([
          stablecoin.address,
          creds.address,
        ]);

        await pool.setDepositLimit(creds.address, 0);

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
        await pool.setCoreSwapLimit(admin.address, scaledDepositAmount);

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

        await creds.mintShare(admin.address, scaledDepositAmount);
        await approve(scaledDepositAmount, creds.address, pool.address, admin);
        await pool.swap(
          creds.address,
          stablecoin.address,
          scaledDepositAmount.div(2),
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
        const utilization = await pool.assetsUtilization(stablecoin.address);
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

        const expectedAdditionalLpTokens = scaledDepositAmount
          .div(2)
          .mul(scaledDepositAmount.div(2))
          .div(scaledDepositAmount.div(2).add(scaledDepositAmount));

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
          .approve(pool.address, depositAmount);
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
        await pool.setCoreSwapLimit(admin.address, scaledDepositAmount);

        await creds.mintShare(admin.address, scaledDepositAmount);
        await approve(scaledDepositAmount, creds.address, pool.address, admin);

        await pool.swap(creds.address, stablecoin.address, scaledDepositAmount),
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
        ).to.be.revertedWith('SapphirePool: unsupported withdraw token');
      });

      it('withdraws token with 6 decimals', async () => {
        const testUsdc = await new TestTokenFactory(admin).deploy(
          'TestUSDC',
          'TUSDC',
          6,
        );
        const usdcDepositAmt = utils.parseUnits('100', 6);
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

      await pool.setDepositLimit(stablecoin.address, depositAmount.mul(2));
      await stablecoin.mintShare(userB.address, depositAmount);
      await approve(depositAmount, stablecoin.address, pool.address, userA);
      await approve(depositAmount, stablecoin.address, pool.address, userB);
    });

    it.only('2 LPs deposit and withdraw at different times, while rewards are being added', async () => {
      // User A deposits
      await pool.connect(userA).deposit(stablecoin.address, depositAmount);
      expect(await pool.balanceOf(userA.address)).to.eq(scaledDepositAmount);

      // 100 rewards are added
      await stablecoin.mintShare(pool.address, depositAmount);

      // User B deposits
      await pool.connect(userB).deposit(stablecoin.address, depositAmount);
      expect(await pool.balanceOf(userB.address)).to.eq(utils.parseEther('50'));

      // 300 usdc rewards are added
      await stablecoin.mintShare(pool.address, depositAmount.mul(3));

      // User A withdraws half
      const withdrawAmount = (await pool.balanceOf(userA.address)).div(2);
      await pool.connect(userA).withdraw(withdrawAmount, stablecoin.address);

      expect(await pool.balanceOf(userA.address)).to.eq(utils.parseEther('50'));
      expect(await stablecoin.balanceOf(userA.address)).to.eq(
        depositAmount.mul(2), // 200
      );

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

    it('2 LPs with 2 cores interact with the pool');
  });
});
