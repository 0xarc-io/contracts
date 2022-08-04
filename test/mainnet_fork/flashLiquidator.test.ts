import { PassportScoreProof } from '@arc-types/sapphireTypes';
import { loadContract } from '../../deployments/src';
import { SapphireArc } from '@src/SapphireArc';
import { BaseERC20Factory, FlashLiquidatorFactory } from '@src/typings';
import { FlashLiquidator } from '@src/typings/FlashLiquidator';
import { checkLiquidatable } from '../../tasks/utils/checkLiquidatable';
import { expect } from 'chai';
import { utils, Wallet } from 'ethers';
import { MockProvider } from 'ethereum-waffle';

const USER_TO_LIQUIDATE = '0xad7b45345afeebd6755b5799c1b991306e4e5a43';
const AAVE_POOL_ADDRESSES_PROVIDER =
  '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb';
const UNIV3_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
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
  let provider: MockProvider;
  let flashLiquidator: FlashLiquidator;
  let arc: SapphireArc;
  let signer: Wallet;
  let currentTimestamp: number;

  before(async () => {
    provider = new MockProvider({
      ganacheOptions: {
        fork: process.env.POLYGON_ALCHEMY,
        fork_block_number: 28556222,
      },
    });
    signer = (await provider.getWallets())[0];

    const coreProxyAddress = loadContract({
      network: 'polygon',
      name: 'SapphireCoreProxy',
      group: 'WETH',
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
    await provider.send('evm_setTime', [++currentTimestamp * 1000]);

    flashLiquidator = await new FlashLiquidatorFactory(signer).deploy(
      AAVE_POOL_ADDRESSES_PROVIDER,
      UNIV3_ROUTER,
    );
  });

  it('liquidates user', async () => {
    console.log('a');
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

    // Run liquidation. Need to set the next timestamp or otherwise the oracle will report stale
    // prices for this simulation
    await provider.send('evm_setTime', [++currentTimestamp * 1000]);
    await flashLiquidator.liquidate(
      coreContracts.core.address,
      USER_TO_LIQUIDATE,
      PROOF,
    );

    const postLiquidationBalance = await repayAsset.balanceOf(signer.address);
    const repayAssetDecimals = await repayAsset.decimals();
    expect(postLiquidationBalance).to.be.gt(preLiquidationBalance);
    console.log(
      `Flash loan executed for total profit of ${utils.formatUnits(
        postLiquidationBalance.sub(preLiquidationBalance),
        repayAssetDecimals,
      )}`,
    );
  });
});
