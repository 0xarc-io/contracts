import 'jest';

import Arc from '@src/Arc';

import { BigNumber } from 'ethers/utils';

import { generatedWallets } from '@utils/generatedWallets';
import { Blockchain } from '@utils/Blockchain';
import { ethers, Wallet } from 'ethers';
import { expectRevert } from '@utils/expectRevert';
import ArcNumber from '@utils/ArcNumber';
import { TestArc } from '../../src/TestArc';

const TEN = ArcNumber.new(10);

const provider = new ethers.providers.JsonRpcProvider();
const blockchain = new Blockchain(provider);

describe('Actions.supply()', () => {
  const [ownerWallet, userWallet] = generatedWallets(provider);

  let arc: TestArc;

  beforeEach(async () => {
    await blockchain.resetAsync();

    arc = await TestArc.init(ownerWallet);
    await arc.deployTestArc();
  });

  it('should not be able to supply 0', async () => {
    await expectRevert(arc.supply(TEN));
  });

  it('should not be able to supply without enough funds', async () => {
    await expectRevert(arc.supply(TEN));
  });

  it('should be able to supply', async () => {
    await arc.stableShare.mintShare(ownerWallet.address, TEN);
    await arc.stableShare.approve(arc.core.address, TEN);
    await arc.supply(TEN);

    const state = await arc.core.state();
    expect(state.supplyTotal).toEqual(TEN);

    const supplyBalance = await arc.core.supplyBalances(ownerWallet.address);
    expect(supplyBalance.balance).toEqual(TEN);

    const supplyTotal = (await arc.core.state()).supplyTotal;
    expect(supplyTotal).toEqual(TEN);
  });

  it.only('should not accrue interest if there are no borrows', async () => {
    await arc.sucessfullySupply(ArcNumber.new(10), userWallet);
    let block = await blockchain.getCurrentTimestamp();
    console.log(block.timestamp);
    await blockchain.setNextBlockTimestamp(block.timestamp + 100);
    await blockchain.waitBlocksAsync(1);
    block = await blockchain.getCurrentTimestamp();
    console.log(block.timestamp);
  });

  it('should accrue the correct amount of interest after 1 minute', async () => {});

  it('should accrue the correct amount of interest after 1 hour', async () => {});

  it('should accrue the correct amount of interest after 1 day', async () => {});
});
