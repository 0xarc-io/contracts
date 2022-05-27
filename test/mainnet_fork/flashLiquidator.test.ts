import { PassportScoreProof } from '@arc-types/sapphireCore';
import { loadContract } from '../../deployments/src';
import { SapphireArc } from '@src/SapphireArc';
import { BaseERC20Factory, FlashLiquidatorFactory } from '@src/typings';
import { FlashLiquidator } from '@src/typings/FlashLiquidator';
import { checkLiquidatable } from '../../tasks/utils/checkLiquidatable';
import { expect } from 'chai';
import hre from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const SIGNER_ADDRESS = '0x9c767178528c8a205df63305ebda4bb6b147889b';
const USER_TO_LIQUIDATE = '0xad7b45345afeebd6755b5799c1b991306e4e5a43';
const USDC_WETH_UNISWAP_POOL = '0x45dda9cb7c25131df268515131f647d726f50608';
const PROOF: PassportScoreProof = {
  account: '0xad7b45345afeebd6755b5799c1b991306e4e5a43',
  protocol:
    '0x617263782e637265646974000000000000000000000000000000000000000000',
  score: '399',
  merkleProof: [
    '0xa2f2708781f9980495a2db87bae69ddf1f89f56c7a2c71651cd84591ffc7a838',
    '0x3b6cfbdc7d9821204292695d40abe3ede6c6cf4826b3b6d5442aee710f2fdfe6',
    '0xbb526f46a4f52d2381f2e7b624ed8ba1962bfb75e0db24187ef00eb218af7e5a',
    '0x04587b428a914d81a80ad3005201a3f3dabdc24a5ea5544e5bffa752180eb3dd',
    '0x3ec3b6a897414358955b216fcb39ab62f883a96a2e79aa2baac558c64327c4bf',
  ],
};

/**
 * This test is meant to be run on a polygon fork at block number 28556223, to mimic
 * this liquidation: https://polygonscan.com/tx/0x855c5ce4a0f577dc10f918a0bcf736d60ad9d8ce8b9e906c29d5e6f1470fb07a
 */
describe('FlashLiquidator', () => {
  let flashLiquidator: FlashLiquidator;
  let arc: SapphireArc;
  let signer: SignerWithAddress;
  let currentTimestamp: number;

  before(async () => {
    const provider = hre.network.provider;

    // Impersonate liquidator as the deployer
    await provider.request({
      method: 'hardhat_impersonateAccount',
      params: [SIGNER_ADDRESS],
    });
    signer = await hre.ethers.getSigner(SIGNER_ADDRESS);

    const coreProxyAddress = loadContract({
      network: 'polygon',
      name: 'SapphireCoreProxy',
    }).address;
    arc = SapphireArc.new(signer);
    await arc.addCores({
      sapphireCore: coreProxyAddress,
    });

    // If we don't set the next block timestamp, the fork will be broken
    // because the next block will have the real current timestamp
    // instead of the one of the fork
    currentTimestamp = (
      await arc.cores['sapphireCore'].core.currentTimestamp()
    ).toNumber();
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      ++currentTimestamp,
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    flashLiquidator = await new FlashLiquidatorFactory(signer).deploy();
  });

  it('liquidates user', async () => {
    const { isLiquidatable } = await checkLiquidatable(
      USER_TO_LIQUIDATE,
      arc,
      PROOF,
    );

    expect(isLiquidatable).to.be.true;
    const coreContracts = arc.cores[arc.getCoreNames()[0]];

    const repayAssetAddress = (await coreContracts.pool.getDepositAssets())[0];
    const repayAsset = BaseERC20Factory.connect(repayAssetAddress, signer);

    const preLiquidationBalance = await repayAsset.balanceOf(signer.address);

    // Run liquidation
    await hre.network.provider.send('evm_setNextBlockTimestamp', [
      ++currentTimestamp,
    ]);
    await flashLiquidator.liquidate(
      coreContracts.core.address,
      USER_TO_LIQUIDATE,
      repayAssetAddress,
      PROOF,
      USDC_WETH_UNISWAP_POOL,
    );

    const postLiquidationBalance = await repayAsset.balanceOf(signer.address);
    expect(postLiquidationBalance).to.be.gt(preLiquidationBalance);
  });

  after(() =>
    hre.network.provider.request({
      method: 'hardhat_stopImpersonatingAccount',
      params: ['0x9c767178528c8a205df63305ebda4bb6b147889b'],
    }),
  );
});
