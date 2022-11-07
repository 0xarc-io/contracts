import { PassportScoreProof } from '@arc-types/sapphireTypes';
import {
  FlashLiquidatorAaveV2,
  FlashLiquidatorAaveV2Factory,
  MockSapphireOracle,
  MockSapphireOracleFactory,
  SapphireAssessorFactory,
  SapphireCoreV1Factory,
} from '@src/typings';
import { IERC20Factory } from '@src/typings/IERC20Factory';
import { ISapphireOracleFactory } from '@src/typings/ISapphireOracleFactory';
import {
  forkNetwork,
  impersonateAccount,
  setAccountBalance,
} from '@test/helpers';
import { expect } from 'chai';
import { Signer, utils } from 'ethers';

const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const LIQUIDATOR_ADDRESS = '0x1cd8e1cd4df6e7403a6a826c7208916c043be49a';
const CORE_ADDRESS = '0x0BD82cc66200a483bD2dc63011240B749E4D8983';
const VAULT_OWNER = '0x9c767178528c8a205DF63305ebdA4BB6B147889b';

const VAULT_OWNER_CREDIT_SCORE_PROOF: PassportScoreProof = {
  account: '0x9c767178528c8a205df63305ebda4bb6b147889b',
  score: '821',
  merkleProof: [
    '0xa65400e9603b38732f928281ca063eff70514b88f4163af5777c74074e2dcb24',
    '0x755ce2da0c83da27134b8aac6cf822dca1086aeb42745c808aaa3871dc74650c',
    '0x00833ca5984570c4bc38f7f85dff53bb0f45866861a766741bb7fe1de67d67d3',
    '0x271d8ea465a367fba37981c8aac8d8080fe120a7ea22e35037d6352ea3c2be68',
    '0xdd80e179b90590daeb0d710d2a214ffdad75437202b7fc21c5d094983a1bb4c6',
    '0x58b01f7caa28bf7a8ed08b3ea965c6da4b29dbfaa174aebe5737ab9ab837f3a5',
    '0x6be9094ef575c3f4ffb6db2151140d54390b8d8d4aca24e4b2691d7d94fe751a',
    '0xd9848b4a9b54109352acc8aeff6d5386cf278309439518253610e3111d15bfe7',
    '0x2ed52a14c7ec6193529e00d77364e4e4a007208f6aad6f3311da822a08df55a2',
    '0x6fbc52c2fb63fb9d562861c6bebc5798d8cc7b870482541b51efac74f3a795ce',
    '0x9a8ba0c4edf3eecaaa411236da5534e379790a42fb52208850fb3cb13801795b',
    '0x4d89a68d77c843e14ca5b2e429bf6d218d765586c783299efe4c75e361626bb4',
    '0x3ff75d2c5bd63cb8661cd0df1811ddd1e7d575b79dc6f7d1b5a3d898db40ee2b',
    '0x2f75ca546d0f9d57f8280e478ce4038368e8a377f6f4f390638adc2dbe409eb9',
    '0x8dfecb0d483a381717619f22cf66b96c7520f15eff1a7a1c5b3026b9e7358195',
    '0x6665e125e77966b42101bdfee5662d591172e150912fd2513ca2e4ad1e17d77f',
    '0xdcc14b7e0c51f65824d957093833b087f71c752f963e7963ec799add5d577833',
    '0x508de875db1241f9d5d2315ac4c3388172535dd7827fd19b6042a7f353e521da',
    '0xe0bf809653310ec08b68404c6de8136cdfbfaacb33604064d8c48acd9bc984c0',
    '0x6dad5987fa35f877b704bf212e2fec3b9f9e79e6d1130772074d2c4da01c5f8b',
    '0x3ca06ba91fa571149ec693412683f6bcd6ba13a096ffe80ecd3362e01eb57561',
    '0x0d4279e29aa4283e3bbaf4e51a4cc2f8f84fda37e2bc6790413b7eefdeb31fc5',
  ],
  protocol:
    '0x617263782e637265646974000000000000000000000000000000000000000000',
};

describe('FlashLiquidatorAaveV2', () => {
  let deployer: Signer;
  let liquidator: Signer;
  let mockOracle: MockSapphireOracle;
  let liquidatorContract: FlashLiquidatorAaveV2;

  before(async () => {
    // Fork mainnet where vault owner has an open vault
    await forkNetwork(process.env.MAINNET_ALCHEMY, 15919663);
    deployer = await impersonateAccount(VAULT_OWNER);
    liquidator = await impersonateAccount(LIQUIDATOR_ADDRESS);

    // Deploy mock price oracle
    mockOracle = await new MockSapphireOracleFactory(deployer).deploy();

    // Deploy flash liquidator
    liquidatorContract = await new FlashLiquidatorAaveV2Factory(
      deployer,
    ).deploy(
      '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
      '0xe592427a0aece92de3edee1f18e0157c05861564',
      LIQUIDATOR_ADDRESS,
    );

    // Turn on reporting of real timestamp
    await mockOracle.setReportRealTimestamp(true);
  });

  it('executes liquidation', async () => {
    let coreAsAdmin = SapphireCoreV1Factory.connect(CORE_ADDRESS, deployer);
    const adminAddress = await coreAsAdmin.getAdmin();
    coreAsAdmin = SapphireCoreV1Factory.connect(
      CORE_ADDRESS,
      await impersonateAccount(adminAddress),
    );

    // Confirm the vault is safe
    const oracle = ISapphireOracleFactory.connect(
      await coreAsAdmin.oracle(),
      liquidator,
    );
    const currentPrice = await oracle.fetchCurrentPrice();
    const assessor = SapphireAssessorFactory.connect(
      await coreAsAdmin.assessor(),
      liquidator,
    );
    const assessedCRatio = await assessor.assess(
      await coreAsAdmin.lowCollateralRatio(),
      await coreAsAdmin.highCollateralRatio(),
      VAULT_OWNER_CREDIT_SCORE_PROOF,
      true,
    );
    expect(
      await coreAsAdmin.isCollateralized(
        VAULT_OWNER,
        currentPrice.price,
        assessedCRatio,
      ),
    ).to.be.true;

    // Set the mock oracle
    await setAccountBalance(adminAddress, utils.parseEther('1'));
    await coreAsAdmin.setOracle(mockOracle.address);
    // Set a low price. The current liquidation price is $963
    const newPrice = utils.parseEther('960');
    await mockOracle.setPrice(newPrice);

    // Confirm the vault is unsafe
    expect(
      await coreAsAdmin.isCollateralized(VAULT_OWNER, newPrice, assessedCRatio),
    ).to.be.false;

    // Capture the usdc balance before liquidation
    const usdc = IERC20Factory.connect(USDC_ADDRESS, liquidator);
    const profitReceiverAddress = await liquidatorContract.profitReceiver();
    const initialUsdcBalance = await usdc.balanceOf(profitReceiverAddress);

    await liquidatorContract.liquidate(
      CORE_ADDRESS,
      VAULT_OWNER,
      VAULT_OWNER_CREDIT_SCORE_PROOF,
    );

    // Confirm the usdc balance increased
    const finalUsdcBalance = await usdc.balanceOf(profitReceiverAddress);
    expect(finalUsdcBalance).to.be.gt(initialUsdcBalance);
    // console.log(
    //   `I've made ${utils.formatUnits(
    //     finalUsdcBalance.sub(initialUsdcBalance),
    //     6,
    //   )} USDC`,
    // ); // $3.76
  });
});
