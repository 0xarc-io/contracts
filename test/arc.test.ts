import 'jest';

import Arc from '@src/Arc';

import { BigNumber } from 'ethers/utils';

import { generatedWallets } from '@utils/generatedWallets';
import { use, expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { Blockchain } from '@utils/Blockchain';

import { ethers, Wallet } from 'ethers';
import { expectRevert } from '@utils/expectRevert';

import ArcNumber from '@utils/ArcNumber';
import { StableShare } from '@typings/StableShare';
import { TestArc } from '../src/TestArc';

const provider = new ethers.providers.JsonRpcProvider();
const blockchain = new Blockchain(provider);

const TEN = ArcNumber.new(10);

use(solidity);

describe('#Actions.openPosition()', () => {
  const [ownerWallet, userWallet] = generatedWallets(provider);

  let arc: TestArc;

  beforeAll(async () => {
    await blockchain.resetAsync();
    arc = await TestArc.init(ownerWallet);
    // await arc.deployArc();
    await blockchain.saveSnapshotAsync();
  });

  beforeEach(async () => {
    await blockchain.resetAsync();
  });
});
