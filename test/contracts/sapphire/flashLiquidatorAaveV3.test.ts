import { forkNetwork, impersonateAccount } from '@test/helpers';
import {
  FlashLiquidatorAaveV3,
  FlashLiquidatorAaveV3Factory,
} from '@src/typings';
import { Signer } from 'ethers';
import hre from 'hardhat';
import { IERC20Factory } from '@src/typings/IERC20Factory';
import { expect } from 'chai';

const LIQUIDATOR_ADDRESS = '0x1cd8e1cd4df6e7403a6a826c7208916c043be49a';
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

// Simulate liquidation transaction
// https://polygonscan.com/tx/0xabd7b7368aaa57dde4e33197caa6cdecea17a2a2dd70d055fb62c06a56359291
describe('FlashLiquidatorAaveV3', () => {
  let liquidator: Signer;
  let liquidatorContract: FlashLiquidatorAaveV3;

  before(async () => {
    await forkNetwork(process.env.POLYGON_ALCHEMY, 29707370);

    const admin = (await hre.ethers.getSigners())[0];

    liquidator = await impersonateAccount(LIQUIDATOR_ADDRESS);

    liquidatorContract = await new FlashLiquidatorAaveV3Factory(admin).deploy(
      '0xa97684ead0e402dc232d5a977953df7ecbab3cdb',
      '0xe592427a0aece92de3edee1f18e0157c05861564',
      await liquidator.getAddress(),
    );
  });

  it('liquidates user', async () => {
    const usdc = IERC20Factory.connect(USDC_ADDRESS, liquidator);
    const initialUsdcBalance = await usdc.balanceOf(LIQUIDATOR_ADDRESS);

    await liquidatorContract.liquidate(
      '0x05efe26f4a75EA4d183e8a7922494d60adfB27b3',
      '0x93a3D13A754589a010a9116351C697eE87C43436',
      {
        account: '0x93a3D13A754589a010a9116351C697eE87C43436',
        score: '999',
        protocol:
          '0x617263782e637265646974000000000000000000000000000000000000000000',
        merkleProof: [
          '0x7138866a7c143f6cd81d71f48eab5e2ee226f961e803dcf083144c80a85fcfac',
          '0xeacc8ca6cd82babfd950e46b163094b4c7106cb087189c8689370d4e9e912b0f',
          '0x3005a4b9bf544d8a1a32a26e1b330705577de0469cb7e39ca311c848ec622b19',
          '0xf651f3a16c54651eea7263a5d6284c9e813e5f24994e2d5816a6faae992eb14f',
          '0x6bdf595e355db4860c60ccb0561ce4d06cb6f045a79556ee05c2d34616162782',
          '0x830e0d19c7a97dea8589639bc34a7b981a47b8137ab0e24e7932ed3e10a20cbb',
          '0x28f3e79d4c405038dd91162c450d32d7a186528769b5ae46ab01b900793dd7e7',
          '0xb78453045019be6ed926a6722f131400b184b506777ad3767bfa197cd233852e',
          '0x9fd3a8e189ad797fc0bc035c13bcb4ec2baea94c133d25290fd72c33ff3f03d8',
          '0xe0af7063923e93d80925b9a738511ca2e52d6cf7e158c8b33485e32f58e7fc8b',
          '0x0d936f9beed946f6052768a9349b95191e16a1704a27e4e80c4ad59f8ab0b5bd',
          '0x957642eebf5d9d4c31f2a4a3ea6b9e6f134290426604be754504a33677e49e55',
          '0x7b41af7eb3b3b33f0ab57de386b3a2f03aabd8d43f685bcb2c5482cc87290f7e',
          '0xb2f48afada889526ca1d589a1d7b1ec3928a39a29dc688cb4fe9d8c85b20574d',
          '0xbdcd078bf18ebf6cd535266e0f38ac05a494e9a9be5816ccb9d8a8188bdc120c',
        ],
      },
    );

    const finalUsdcBalance = await usdc.balanceOf(LIQUIDATOR_ADDRESS);
    expect(finalUsdcBalance).to.be.gt(initialUsdcBalance);
    ``;
  });
});
