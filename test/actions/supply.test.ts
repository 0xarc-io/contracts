import 'jest';

import Arc from '@src/Arc';

import { BigNumber } from 'ethers/utils';

import { generatedWallets } from '@utils/generatedWallets';
import { Blockchain } from '@utils/Blockchain';
import { ethers, Wallet } from 'ethers';
import { expectRevert } from '@utils/expectRevert';
import ArcNumber from '@utils/ArcNumber';

const TEN = ArcNumber.new(10);

const provider = new ethers.providers.JsonRpcProvider();
const blockchain = new Blockchain(provider);

describe('Actions.supply()', () => {
  const [ownerWallet, userWallet] = generatedWallets(provider);

  let arc: Arc;

  beforeEach(async () => {
    arc = await Arc.init(ownerWallet);
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
    expect(supplyBalance).toEqual(TEN);
  });

  it('should not accrue interest if there are no borrows', async () => {});

  it('should accrue the correct amount of interest after 1 block', async () => {});

  it('should accrue the correct amount of interest after 5 blocks', async () => {});

  it('should accrue the correct amount of interest after 10 blocks', async () => {});
});
