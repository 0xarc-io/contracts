import {
  ArcProxyFactory,
  BaseERC20,
  BaseERC20Factory,
  SapphirePool,
  SapphirePoolFactory,
} from '@src/typings';
import { roundUpDiv, roundUpMul } from '@test/helpers/roundUpOperations';
import { expect } from 'chai';
import { MockProvider } from 'ethereum-waffle';
import { BigNumber, Wallet } from 'ethers';

const POOL_PROXY = '0xef2ec6eB4ED8660774E4BfC42F12c9080c932FA9';

/**
 * The scenario to fix:
 * 1. have 1 deposit coin (ex usdc)
 * 2. deposit 100 usdc
 * 3. user borrows 20 usdc
 * 4. admin adds dai
 * 5. admin removes usdc
 * 6. borrower repays 20 dai
 * 7. you try to withdraw 20 dai
 */
describe('SapphirePool - V3 Upgrade', () => {
  let pool: SapphirePool;
  // In our case admin is also the depositor
  let admin: Wallet;
  let dai: BaseERC20;

  async function getLpToWithdraw(): Promise<BigNumber> {
    const daiOnContract = await dai.balanceOf(pool.address);
    const userLpBalance = await pool.balanceOf(admin.address);
    const poolValue = await pool.getPoolValue();

    // Round up to allow the end last withdrawal be the entirety of the dai on the contract
    return roundUpDiv(roundUpMul(userLpBalance, daiOnContract), poolValue);
  }

  before(async () => {
    const provider = new MockProvider({
      ganacheOptions: {
        fork: process.env.MUMBAI_ALCHEMY,
        fork_block_number: 26744025,
      },
    });

    admin = new Wallet(process.env.TESTNET_DEPLOY_PRIVATE_KEY, provider);
    pool = SapphirePoolFactory.connect(POOL_PROXY, admin);

    const depositAssets = await pool.getDepositAssets();
    expect(depositAssets).to.have.lengthOf(1);

    dai = BaseERC20Factory.connect(depositAssets[0], admin);
  });

  it('reverts when depositor tries to withdraw a newly added token', async () => {
    // the depositor has about 1k of stablecoins deposited on the contract
    // and he's trying to withdraw all the dai currently there, of about 500
    const lpToWithdraw = await getLpToWithdraw();

    await expect(pool.withdraw(lpToWithdraw, dai.address)).to.be.revertedWith(
      'revert',
    );
  });

  // Depositor withdraws all the available dai and succeeds, leaving him with a remaining position
  // of about 500 dai
  it('upgrade, then withdraws all the available newly added tokens', async () => {
    // deploy upgrade
    const newImpl = await new SapphirePoolFactory(admin).deploy();

    // set upgrade
    await ArcProxyFactory.connect(pool.address, admin).upgradeTo(
      newImpl.address,
    );

    // withdraw as much as he can
    const lpToWithdraw = await getLpToWithdraw();
    const preWithdrawDaiBalance = await dai.balanceOf(admin.address);

    await pool.withdraw(lpToWithdraw, dai.address);

    const postDaiOnContract = await dai.balanceOf(pool.address);
    const postWithdrawDaiBalance = await dai.balanceOf(admin.address);

    // expect the pool to be (almost) empty of dai. There is 1 wei of dai left because of the
    // division
    const earnedDai = postWithdrawDaiBalance.sub(preWithdrawDaiBalance);
    expect(postDaiOnContract).to.eq(0);

    expect(postWithdrawDaiBalance).to.eq(preWithdrawDaiBalance.add(earnedDai));
  });
});
