import 'jest';

import Arc from '@src/Arc';

import { BigNumber } from 'ethers/utils';

import { generatedWallets } from '@utils/generatedWallets';
import { Blockchain } from '@src/utils/Blockchain';
import { ethers, Wallet } from 'ethers';
import { expectRevert } from '@src/utils/expectRevert';

import ArcNumber from '@src/utils/ArcNumber';

const provider = new ethers.providers.JsonRpcProvider();
const blockchain = new Blockchain(provider);

const TEN = ArcNumber.new(10);

describe('Actions.withdraw()', () => {
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

  it('should not be able to withdraw 0', async () => {
    await expectRevert(arc.withdraw(new BigNumber(0)));
  });

  it('should not be able to withdraw more than they have deposited', async () => {
    await expectRevert(arc.withdraw(ArcNumber.new(11)));
  });

  it('should be able to withdraw the amount deposited', async () => {
    await arc.withdraw(TEN);

    const state = await arc.core.state();
    expect(state.supplyTotal).toEqual(new BigNumber(0));

    const supplyBalance = await arc.core.supplyBalances(ownerWallet.address);
    expect(supplyBalance).toEqual(new BigNumber(0));
  });

  it('should be able withdraw the principal + interest accrued', async () => {});

  it('should be able to withdraw a portion of the principal + interest accrued', async () => {});

  it('should be able to accrue the correct amount of interest after a portion is withdrawn', async () => {});
});
