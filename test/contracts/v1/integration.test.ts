import 'jest';

import { ethers, Wallet } from 'ethers';
import { expectRevert } from '@src/utils/expectRevert';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';
import { MockOracle } from '@src/typings';
import { TestArc } from '../../../src/TestArc';
import { Operation } from '../../../src/types';
import { BigNumberish, BigNumber } from 'ethers/utils';
import { EVM } from '../../helpers/EVM';
import { generatedWallets } from '../../../src/utils/generatedWallets';
import Token from '@src/utils/Token';

jest.setTimeout(30000);

const provider = new ethers.providers.JsonRpcProvider();
const evm = new EVM(provider);

let arc: TestArc;

let ownerWallet: Wallet;
let userWallet: Wallet;
let liquidatorWallet: Wallet;

let currentPosition: BigNumberish;
let wallets = generatedWallets(provider);

describe('Arc Integration', () => {
  async function updateOraclePrice(price: any) {
    const oracle = await MockOracle.at(ownerWallet, arc.oracle.address);
    await oracle.setPrice(price);
  }

  beforeAll(async () => {
    ownerWallet = wallets[0];
    userWallet = wallets[1];
    liquidatorWallet = wallets[2];

    arc = await TestArc.init(ownerWallet);

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

    // Price of LINK collateral = $10
    await updateOraclePrice(ArcDecimal.new(10));
  });

  it('should be able to open a position', async () => {
    // Borrow $100 with $500 worth of collateral (50 LINK)
    const result = await arc._borrowSynthetic(ArcNumber.new(100), ArcNumber.new(50), userWallet);
    currentPosition = result.params.id;

    // Ensure the emitted parameters are correct
    expect(result.operation).toEqual(Operation.Open);
    expect(result.updatedPosition.borrowedAmount.value).toEqual(ArcNumber.new(100));
    expect(result.updatedPosition.borrowedAmount.sign).toBeFalsy();
    expect(result.updatedPosition.collateralAmount.value).toEqual(ArcNumber.new(50));
    expect(result.updatedPosition.collateralAmount.sign).toBeTruthy();
    expect(result.params.id).toEqual(currentPosition);

    // ARC should now hold $500 worth of the user's collateral (50 LINK * $10 = $500)
    expect(await arc.collateralAsset.balanceOf(arc.syntheticAsset.address)).toEqual(
      ArcNumber.new(50),
    );

    // The user should have received $100 worth of LINKUSD in return
    expect(await arc.syntheticAsset.balanceOf(userWallet.address)).toEqual(ArcNumber.new(100));

    // The total LINKUSD supply should be the same as the user's balance
    expect(await arc.syntheticAsset.totalSupply()).toEqual(ArcNumber.new(100));
  });

  it('should be able to borrow more against that position when the price increases', async () => {
    // Now we'd like to increase the price of LINK to $20
    // This means that the 50 LINK is worth $1000 allowing a theoterical maximum
    // of up to $500 of LINKUSD to be borrow (the user has only borrowed $100 at the moment)
    await updateOraclePrice(ArcDecimal.new(20));

    // Let's increase the amount of leverage by borrowing an additional $200
    const result = await arc._borrowSynthetic(
      ArcNumber.new(200),
      ArcNumber.new(0),
      userWallet,
      currentPosition,
    );

    // Ensure the correct emitted parameters are correct
    expect(result.operation).toEqual(Operation.Borrow);
    expect(result.updatedPosition.borrowedAmount.value).toEqual(ArcNumber.new(300));
    expect(result.updatedPosition.borrowedAmount.sign).toBeFalsy();
    expect(result.updatedPosition.collateralAmount.value).toEqual(ArcNumber.new(50));
    expect(result.updatedPosition.collateralAmount.sign).toBeTruthy();
    expect(result.params.id).toEqual(currentPosition);

    // ARC should still $500 worth of the user's collateral (50 LINK * $10 = $500)
    expect(await arc.collateralAsset.balanceOf(arc.syntheticAsset.address)).toEqual(
      ArcNumber.new(50),
    );

    // The user should have $300 worth of LINKUSD in return
    expect(await arc.syntheticAsset.balanceOf(userWallet.address)).toEqual(ArcNumber.new(300));

    // The total LINKUSD supply should be the same as the user's balance
    expect(await arc.syntheticAsset.totalSupply()).toEqual(ArcNumber.new(300));
  });

  it('should be able to pay back debt', async () => {
    // The user senses the market is about to shift and decides to
    // deleverage a little by repaying some debt and increasing the c-ratio.
    // He does this by repaying $100 of LINKUSD to debt making his total borrow
    // amount at $200 ($300 - $100).
    await Token.approve(
      arc.syntheticAsset.address,
      userWallet,
      arc.core.address,
      ArcNumber.new(100),
    );

    const result = await arc.repay(
      currentPosition,
      ArcNumber.new(100),
      ArcNumber.new(0),
      userWallet,
    );

    //Ensure that the correct events were emitted
    expect(result.operation).toEqual(Operation.Repay);
    expect(result.updatedPosition.borrowedAmount.value).toEqual(ArcNumber.new(200));
    expect(result.updatedPosition.borrowedAmount.sign).toBeFalsy();
    expect(result.updatedPosition.collateralAmount.value).toEqual(ArcNumber.new(50));
    expect(result.updatedPosition.collateralAmount.sign).toBeTruthy();
    expect(result.params.id).toEqual(currentPosition);

    // ARC should still have $500 worth of the user's collateral (50 LINK * $10 = $500)
    expect(
      await (await arc.collateralAsset.balanceOf(arc.syntheticAsset.address)).toString(),
    ).toEqual(ArcNumber.new(50).toString());

    // The user should have $200 worth of LINKUSD in return
    expect(await arc.syntheticAsset.balanceOf(userWallet.address)).toEqual(ArcNumber.new(200));

    // The total LINKUSD supply should be the same as the user's balance
    expect(await arc.syntheticAsset.totalSupply()).toEqual(ArcNumber.new(200));
  });

  it('should be able to be liquidate when the price decreases', async () => {
    // The price of LINK is $20, the user has $200 of debt and
    // currently has $1000 of debt giving a 500% c-ratio.

    // The price of LINK now flash crashes to $5 throwing the user underwater
    await updateOraclePrice(ArcDecimal.new(5));

    await expectRevert(
      arc._borrowSynthetic(ArcNumber.new(100), ArcNumber.new(20), userWallet, currentPosition),
    );

    // This means that...
    // - Users's 50 LINK is now worth $250
    // - User has borrowed $200 worth of debt
    // - User's c-ratio is 125%, 75% below the 200% mark
    // - We'll need to liquidate them to set the c-ratio higher by selling
    //   their collateral at a discount 10% (5% ARC + 5% Bot)

    // Oh noes, time to call up Arthur.
    await arc._borrowSynthetic(ArcNumber.new(500), ArcNumber.new(250), liquidatorWallet);
    const result = await arc.liquidatePosition(currentPosition, liquidatorWallet);

    // A run down of how we calculate how much to liquidate
    // - Debt = $200, Collateral = 50LINK = $250
    // - Maximum user can borrow = $125 @ 200% c-ratio ($250 / 2).
    // - The price of LINK = $5, however because of the 10% penalty
    //   we're going to sell LINK to the liquidator for $4.50
    // - Collateral needed to borrow $200 = ($200 * 2) / $4.5 = 88.88
    // - Delta in collateral needed = 88.88 - 50 = 38.88
    // - Since we want the user to be safe we add an extra 10% margin of safety
    // - 38.88888 * 1.1 = 42.777 (rounding errors create slight differences)
    // - The user should be left with 50 - 42.7777 = 7.222 LINK
    // - Since they got rekt we reduce their debt to $7.5
    // - The new c-ratio is now 7.222 * 5 / 7.5 = 481.4%
    // - This may sound high but this is in the worse case where a
    //   flash crash happens. The c-ratio approaches infinity as the price drops more.
    // - Safety over profits.

    // Ensure the emitted parameters are correct
    expect(result.operation).toEqual(Operation.Liquidate);
    expect(result.updatedPosition.borrowedAmount.value.toString()).toEqual('7500000000000000008');
    expect(result.updatedPosition.borrowedAmount.sign).toBeFalsy();
    expect(result.updatedPosition.collateralAmount.value.toString()).toEqual('7222222222222222224');
    expect(result.updatedPosition.collateralAmount.sign).toBeTruthy();
    expect(result.params.id).toEqual(currentPosition);

    // ARC should still have 257.222 LINK left in the system (200 from Arthur + 57.22 from rekt dude)
    expect(
      await (await arc.collateralAsset.balanceOf(arc.syntheticAsset.address)).toString(),
    ).toEqual('257222222222222222224');

    // The user can still have $200 worth of LINKUSD since they got rekt
    expect(await arc.syntheticAsset.balanceOf(userWallet.address)).toEqual(ArcNumber.new(200));

    // The liquidator will now have less LINKUSD since they had to pay the rekt dude's debt
    expect((await arc.syntheticAsset.balanceOf(liquidatorWallet.address)).toString()).toEqual(
      '307500000000000000008',
    );

    // The total LINKUSD supply be the amount the user holds + the amount arthur holds
    expect((await arc.syntheticAsset.totalSupply()).toString()).toEqual('507500000000000000008');
  });

  it('should be able to deposit more collateral', async () => {
    // Our devoted LINK holder has been wiped out but is still hopeful
    // for the future of LINK and decides to double down during this FUD campaign
    // Added/subtracted weird numbers to keep things whole(ish) again.
    const result = await arc._borrowSynthetic(
      ArcNumber.new(100).sub(8).sub(ArcDecimal.new(7.5).value),
      ArcNumber.new(100).sub('222222222222222224').sub(ArcNumber.new(7)),
      userWallet,
      currentPosition,
    );

    // Let's check the new status of our user
    expect(result.operation).toEqual(Operation.Borrow);
    expect(result.updatedPosition.borrowedAmount.value).toEqual(ArcNumber.new(100));
    expect(result.updatedPosition.borrowedAmount.sign).toBeFalsy();
    expect(result.updatedPosition.collateralAmount.value).toEqual(ArcNumber.new(100));
    expect(result.updatedPosition.collateralAmount.sign).toBeTruthy();
    expect(result.params.id).toEqual(currentPosition);
  });

  it('should be able to borrow more debt against the collateral', async () => {
    // The user currently has 100 LINK as collateral = $500
    // The user also has 100 LINKUSD worth of debt = $100
    // The user's collatearl ratio is 500% allowing them to borrow at least $150 more
    const result = await arc._borrowSynthetic(
      ArcNumber.new(150),
      ArcNumber.new(0),
      userWallet,
      currentPosition,
    );

    // Let's check the new status of our user
    expect(result.operation).toEqual(Operation.Borrow);
    expect(result.updatedPosition.borrowedAmount.value).toEqual(ArcNumber.new(250));
    expect(result.updatedPosition.borrowedAmount.sign).toBeFalsy();
    expect(result.updatedPosition.collateralAmount.value).toEqual(ArcNumber.new(100));
    expect(result.updatedPosition.collateralAmount.sign).toBeTruthy();
    expect(result.params.id).toEqual(currentPosition);
  });

  it('should be able to be liquidated if the price drops', async () => {
    // Once again the price drops, but this time to a lesser degree.
    await updateOraclePrice(ArcDecimal.new(4));

    // Here comes the grim reaper
    const result = await arc.liquidatePosition(currentPosition, liquidatorWallet);

    expect(result.operation).toEqual(Operation.Liquidate);
    expect(result.updatedPosition.borrowedAmount.value).toEqual(ArcNumber.new(96).add(7));
    expect(result.updatedPosition.borrowedAmount.sign).toBeFalsy();
    expect(result.updatedPosition.collateralAmount.value.toString()).toEqual(
      '57222222222222222224',
    );
    expect(result.updatedPosition.collateralAmount.sign).toBeTruthy();
    expect(result.params.id).toEqual(currentPosition);

    await expectRevert(arc.liquidatePosition(currentPosition, liquidatorWallet));
  });

  it('should be able to be liquidated if the price drops again', async () => {
    // Once again the price drops, but this time to a lesser degree.
    await updateOraclePrice(ArcDecimal.new(3));

    // Here comes the grim reaper
    await arc.liquidatePosition(currentPosition, liquidatorWallet);

    await expectRevert(arc.liquidatePosition(currentPosition, liquidatorWallet));
  });

  it('should be able to repay all the debt and claim back the remaining collateral', async () => {
    const userPreCollateralBalance = await arc.collateralAsset.balanceOf(userWallet.address);
    const userPreSyntheticBalance = await arc.syntheticAsset.balanceOf(userWallet.address);

    const preResult = await arc.state.positions(currentPosition);

    await arc.repay(
      currentPosition,
      preResult.borrowedAmount.value,
      preResult.collateralAmount.value,
      userWallet,
    );

    const userPostCollateralBalance = await arc.collateralAsset.balanceOf(userWallet.address);
    const userPostSyntheticBalance = await arc.syntheticAsset.balanceOf(userWallet.address);

    expect(userPostCollateralBalance).toEqual(
      userPreCollateralBalance.add(preResult.collateralAmount.value),
    );
    expect(userPostSyntheticBalance).toEqual(
      userPreSyntheticBalance.sub(preResult.borrowedAmount.value),
    );

    const postResult = await arc.state.positions(currentPosition);
    expect(postResult.collateralAmount.value.toNumber()).toEqual(0);
    expect(postResult.borrowedAmount.value.toNumber()).toEqual(0);
  });
});
