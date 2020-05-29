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
    await blockchain.saveSnapshotAsync();
  });

  beforeEach(async () => {
    await blockchain.resetAsync();
  });
});
