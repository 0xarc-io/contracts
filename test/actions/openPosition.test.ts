import 'jest';

import { BigNumber } from 'ethers/utils';

import { generatedWallets } from '@utils/generatedWallets';
import { use } from 'chai';
import { solidity, MockProvider, getWallets, deployContract } from 'ethereum-waffle';
import { Blockchain } from '@utils/Blockchain';

import { ethers, Wallet } from 'ethers';
import { expectRevert } from '@utils/expectRevert';

import ArcNumber from '@utils/ArcNumber';
import { StableShare } from '@typings/StableShare';
import ArcDecimal from '../../src/utils/ArcDecimal';
import Token from '@src/utils/Token';
import { TestArc } from '../../src/TestArc';

const provider = new ethers.providers.JsonRpcProvider();
const blockchain = new Blockchain(provider);

const TEN = ArcNumber.new(10);

use(solidity);

jest.setTimeout(30000);

describe('#Actions.openPosition()', () => {
  const [ownerWallet, userWallet, minterWallet, lenderWallet] = generatedWallets(provider);

  let arc: TestArc;

  describe('with stable shares', () => {
    // Set the price of the synthetic at $100
    // Mint $200 worth of stable shares
    // Mint 1 synthetic asset from the $200
    beforeEach(async () => {
      await blockchain.resetAsync();

      arc = await TestArc.init(ownerWallet);
      await arc.deployTestArc();
      await arc.oracle.setPrice(ArcDecimal.new(100.0));
      await Token.approve(
        arc.stableShare.address,
        userWallet,
        arc.core.address,
        ArcNumber.new(10000),
      );
    });

    it('should be able to borrow by the exact amout of collateral provided', async () => {
      await arc.stableShare.mintShare(userWallet.address, ArcNumber.new(200));
      await arc.openPosition(arc.stableShare.address, ArcNumber.new(1), userWallet);

      const position = await arc.core.positions(0);
      expect(position.collateralAsset).toEqual(arc.stableShare.address);
      expect(position.collateralAmount).toEqual(ArcNumber.new(200));
      expect(position.borrowedAsset).toEqual(arc.synthetic.address);
      expect(position.borrowedAmount).toEqual(ArcNumber.new(1));

      const syntheticBalance = await arc.synthetic.balanceOf(userWallet.address);
      expect(syntheticBalance).toEqual(ArcNumber.new(1));

      const state = await arc.core.state();
      expect(state.borrowTotal).toEqual(ArcNumber.new(0));

      const positionCount = await arc.core.positionCount();
      expect(positionCount).toEqual(new BigNumber(1));

      const collateralBalance = await arc.stableShare.balanceOf(arc.synthetic.address);
      expect(collateralBalance).toEqual(ArcNumber.new(200));
    });

    it('should not be able to open a position with not enough collateral', async () => {
      await arc.stableShare.mintShare(userWallet.address, ArcNumber.new(199));
      await expectRevert(arc.openPosition(arc.stableShare.address, ArcNumber.new(1), userWallet));
    });

    it('should not be able to open a position with anything other than the liquidity asset', async () => {
      const newToken = await StableShare.deploy(userWallet);
      await newToken.mintShare(userWallet.address, ArcNumber.new(200));
      await newToken.approve(arc.core.address, ArcNumber.new(200));
      await expectRevert(arc.openPosition(newToken.address, ArcNumber.new(1), userWallet));
    });

    it('should not be able to open a position of 0', async () => {
      await arc.stableShare.mintShare(userWallet.address, ArcNumber.new(200));
      await expectRevert(arc.openPosition(arc.stableShare.address, ArcNumber.new(0)));
    });
  });

  describe.only('with synthetics', () => {
    // Set the price of the synthetic at $100
    // Mint $2000 to the user, mint 10 synthetics
    // Mint $200 to the lender, lend to the protocol (0% utilised)
    // Borrow $100 worth of stable shares with 2 synthetics
    // Remaining tests play around with the collateral ratio

    beforeEach(async () => {
      await blockchain.resetAsync();

      arc = await TestArc.init(ownerWallet);
      await arc.deployTestArc();
      await arc.oracle.setPrice(ArcDecimal.new(100.0));

      await Token.approve(
        arc.synthetic.address,
        userWallet,
        arc.core.address,
        ArcNumber.new(10000),
      );

      await arc.sucessfullySupply(ArcNumber.new(200), lenderWallet);
      await arc.sucessfullyMintSynthetic(ArcNumber.new(10), ArcNumber.new(2000), minterWallet);
    });

    // Maximum of 10 available as per above
    async function transferSynthetic(amount: number) {
      return await Token.transfer(
        arc.synthetic.address,
        userWallet.address,
        ArcNumber.new(amount),
        minterWallet,
      );
    }

    it('should be able to borrow by the exact amout of collateral provided', async () => {
      await transferSynthetic(2);
      await arc.openPosition(arc.synthetic.address, ArcNumber.new(100), userWallet);

      const position = await arc.core.positions(1);
      expect(position.collateralAsset).toEqual(arc.synthetic.address);
      expect(position.collateralAmount).toEqual(ArcNumber.new(2));
      expect(position.borrowedAsset).toEqual(arc.stableShare.address);
      expect(position.borrowedAmount).toEqual(ArcNumber.new(100));

      const userStableShareBalance = await arc.stableShare.balanceOf(userWallet.address);
      expect(userStableShareBalance).toEqual(ArcNumber.new(100));

      const state = await arc.core.state();
      expect(state.borrowTotal).toEqual(ArcNumber.new(100));

      const utilisationRatio = await arc.core.utilisationRatio();
      expect(utilisationRatio.value).toEqual(ArcDecimal.new(0.5).value);
    });

    it('should not be able to borrow without enough collateral provided', async () => {
      await transferSynthetic(1);
      await expectRevert(arc.openPosition(arc.synthetic.address, ArcNumber.new(51), userWallet));
    });

    it('should not be able to borrow without enough liquidity (over collateralisation ratio)', async () => {
      await transferSynthetic(3);
      await expectRevert(arc.openPosition(arc.synthetic.address, ArcNumber.new(101), userWallet));
    });

    it('should not be able to borrow 0', async () => {
      await transferSynthetic(1);
      await expectRevert(arc.openPosition(arc.synthetic.address, ArcNumber.new(0), userWallet));
    });
  });
});
