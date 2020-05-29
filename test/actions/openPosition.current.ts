import 'jest';

import Arc from '@src/Arc';

import { BigNumber } from 'ethers/utils';

import { generatedWallets } from '@utils/generatedWallets';
import { use, expect } from 'chai';
import { solidity, MockProvider, getWallets, deployContract } from 'ethereum-waffle';
import { Blockchain } from '@utils/Blockchain';

import { ethers, Wallet } from 'ethers';
import { expectRevert } from '@utils/expectRevert';

import ArcNumber from '@utils/ArcNumber';
import { StableShare } from '@typings/StableShare';

const provider = new ethers.providers.JsonRpcProvider();
const blockchain = new Blockchain(provider);

const TEN = ArcNumber.new(10);

use(solidity);

describe('#Actions.openPosition()', () => {
  const [ownerWallet, userWallet] = generatedWallets(provider);

  let arc: Arc;

  beforeAll(async () => {
    await blockchain.resetAsync();
    arc = await Arc.init(ownerWallet);
    await arc.deployTestArc();
    await arc.stableShare.mintShare(ownerWallet.address, TEN);
    await arc.stableShare.approve(arc.core.address, TEN);
    await arc.supply(TEN);
    await blockchain.saveSnapshotAsync();
  });

  beforeEach(async () => {
    await blockchain.resetAsync();
  });

  it('should not be able to open a position with anything other than the liquidity asset', async () => {
    const newToken = await StableShare.deploy(userWallet);
    await newToken.mintShare(ownerWallet.address, TEN);
    await newToken.approve(arc.core.address, TEN);
    await expectRevert(arc.openPosition(newToken.address, TEN, ArcNumber.new(5)));
  });

  it('should not be able to open a position of 0', async () => {
    await expectRevert(arc.openPosition(arc.stableShare.address, TEN, ArcNumber.new(0)));
  });

  it('should not be able to open a position with not enough collateral', async () => {});

  it('should not be able to borrow more than the collateral provided', async () => {});

  it('should be able to borrow by the exact amout of collateral provided', async () => {});

  it('should be able to borrow by the exact amout of collateral provided', async () => {});

  it('should be able to open a position with the synthetic as collateral', async () => {});
});
