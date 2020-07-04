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

  it('should not be able to supply 0', async () => {});

  it('should not be able to supply without enough funds', async () => {});

  it('should be able to supply', async () => {});

  it('should not accrue interest if there are no borrows', async () => {});

  it('should accrue the correct amount of interest after 1 minute', async () => {});

  it('should accrue the correct amount of interest after 1 hour', async () => {});

  it('should accrue the correct amount of interest after 1 day', async () => {});
});
