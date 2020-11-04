import 'module-alias/register';

import { Wallet } from 'ethers';

import { ethers } from 'hardhat';
import { expectRevert } from '@src/utils/expectRevert';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';
import { ArcProxy, CoreV3, CoreV4, MockOracle } from '@src/typings';
import { D1TestArc } from '../../../src/D1TestArc';
import { Operation } from '../../../src/types';
import { BigNumberish, BigNumber } from 'ethers/utils';
import { EVM } from '../../helpers/EVM';
import { generatedWallets } from '../../../src/utils/generatedWallets';
import Token from '@src/utils/Token';
import { getWaffleExpect } from '../../helpers/testingUtils';

const expect = getWaffleExpect();

const provider = ethers.provider;
const evm = new EVM(provider);

let arc: D1TestArc;

let ownerWallet: Wallet;
let userWallet: Wallet;
let liquidatorWallet: Wallet;

let wallets = generatedWallets(provider);

let coreV3: CoreV3;
let coreV4: CoreV4;

let positionId: BigNumberish;

describe('CoreV4Migration', () => {
  async function updateOraclePrice(price: any) {
    const oracle = await MockOracle.at(ownerWallet, arc.oracle.address);
    await oracle.setPrice(price);
  }

  before(async () => {
    ownerWallet = wallets[0];
    userWallet = wallets[1];
    liquidatorWallet = wallets[2];

    arc = await D1TestArc.init(ownerWallet);

    await arc.deployTestArc();

    await arc.state.setMarketParams({
      collateralRatio: { value: ArcNumber.new(2) },
      liquidationUserFee: { value: ArcDecimal.new(0.05).value },
      liquidationArcFee: { value: ArcDecimal.new(0.05).value },
    });

    await arc.state.setRiskParams({
      collateralLimit: ArcNumber.new(0),
      syntheticLimit: ArcNumber.new(0),
      positionCollateralMinimum: ArcNumber.new(1),
    });

    coreV3 = await CoreV3.deploy(ownerWallet);
    coreV4 = await CoreV4.deploy(ownerWallet);

    // Set the current implementation to V4
    await (await ArcProxy.at(ownerWallet, arc.core.address)).upgradeTo(coreV3.address);

    // Price of LINK collateral = $10
    await updateOraclePrice(ArcDecimal.new(10));
  });

  it('should be able to open a position and go into positive debt', async () => {
    const result = await arc._borrowSynthetic(ArcNumber.new(100), ArcNumber.new(50), userWallet);
    positionId = result.params.id;

    await arc._borrowSynthetic(ArcNumber.new(500), ArcNumber.new(500), liquidatorWallet);
    await Token.transfer(
      arc.syntheticAsset.address,
      userWallet.address,
      ArcNumber.new(200),
      liquidatorWallet,
    );

    // This should put the user's position in positive debt by 200
    const repayResult = await arc.repay(positionId, ArcNumber.new(300), 0, userWallet);
    expect(repayResult.updatedPosition.borrowedAmount.sign).to.be.true;
    expect(repayResult.updatedPosition.borrowedAmount.value).to.equal(ArcNumber.new(200));

    // Drop the price so the position is now "under collateralised"
    // 50 LINK * 5 = $250, Borrow = $200 = < 200% c-ratio
    await updateOraclePrice(ArcDecimal.new(5));

    const isCollateralised = await arc.state.isCollateralized({
      ...repayResult.updatedPosition,
      collateralAsset: 0,
      borrowedAsset: 1,
    });
    expect(isCollateralised).to.be.false;

    await expectRevert(
      arc._borrowSynthetic(ArcNumber.new(10), ArcNumber.new(100), userWallet, positionId),
    );
    await expectRevert(
      arc._borrowSynthetic(ArcNumber.new(200), ArcNumber.new(0), userWallet, positionId),
    );

    await expectRevert(arc.liquidatePosition(positionId, liquidatorWallet));
  });

  it('should be able to upgrade to v4 and remove all collateral', async () => {
    await (await ArcProxy.at(ownerWallet, arc.core.address)).upgradeTo(coreV4.address);

    await expectRevert(arc.liquidatePosition(positionId, liquidatorWallet));

    await expectRevert(
      arc._borrowSynthetic(ArcNumber.new(2000), ArcNumber.new(0), userWallet, positionId),
    );

    await expectRevert(arc.repay(positionId, ArcNumber.new(200), ArcNumber.new(500), userWallet));

    // Withdraw the excess $200 in the system itself
    const borrowResult = await arc._borrowSynthetic(
      ArcNumber.new(200),
      ArcNumber.new(0),
      userWallet,
      positionId,
    );

    expect(borrowResult.updatedPosition.borrowedAmount.value).to.equal(ArcNumber.new(0));
    expect(borrowResult.updatedPosition.borrowedAmount.sign).to.be.false;

    // Withdraw the remaining collateral
    const repayResult = await arc.repay(
      positionId,
      ArcNumber.new(0),
      ArcNumber.new(50),
      userWallet,
    );

    expect(repayResult.updatedPosition.collateralAmount.value).to.equal(ArcNumber.new(0));
    expect(repayResult.updatedPosition.collateralAmount.sign).to.be.true;

    // Make sure they can't go into positive debt again
    await expectRevert(arc.repay(positionId, ArcNumber.new(100), 0, userWallet));
  });
});
