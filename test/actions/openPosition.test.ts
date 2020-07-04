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
    beforeEach(async () => {
      await blockchain.resetAsync();
    });

    it('should be able to borrow by the exact amout of collateral provided', async () => {});

    it('should not be able to open a position with not enough collateral', async () => {});

    it('should not be able to open a position with anything other than the liquidity asset', async () => {});

    it('should not be able to open a position of 0', async () => {});
  });

  describe('with synthetics', () => {
    beforeEach(async () => {
      await blockchain.resetAsync();
    });

    it('should be able to borrow by the exact amout of collateral provided', async () => {});

    it('should not be able to borrow without enough collateral provided', async () => {});

    it('should not be able to borrow without enough liquidity (over collateralisation ratio)', async () => {});

    it('should not be able to borrow 0', async () => {});
  });
});
