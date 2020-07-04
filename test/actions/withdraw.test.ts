import 'jest';

import Arc from '@src/Arc';

import { BigNumber } from 'ethers/utils';

import { generatedWallets } from '@utils/generatedWallets';
import { Blockchain } from '@src/utils/Blockchain';
import { ethers, Wallet } from 'ethers';
import { expectRevert } from '@src/utils/expectRevert';

import ArcNumber from '@src/utils/ArcNumber';
import { TestArc } from '../../src/TestArc';

const provider = new ethers.providers.JsonRpcProvider();
const blockchain = new Blockchain(provider);

const TEN = ArcNumber.new(10);

describe('Actions.withdraw()', () => {
  const [ownerWallet, userWallet] = generatedWallets(provider);

  let arc: TestArc;

  beforeEach(async () => {
    await blockchain.resetAsync();
  });

  it('should not be able to withdraw 0', async () => {});

  it('should not be able to withdraw more than they have deposited', async () => {});

  it('should be able to withdraw the amount deposited', async () => {});

  it('should be able withdraw the principal + interest accrued', async () => {});

  it('should be able to withdraw a portion of the principal + interest accrued', async () => {});

  it('should be able to accrue the correct amount of interest after a portion is withdrawn', async () => {});
});
