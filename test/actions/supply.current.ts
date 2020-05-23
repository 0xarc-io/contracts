import 'jest';

import { Arc } from '../../typechain/Arc';
import { BigNumber } from 'ethers/utils';

import { generatedWallets } from '../../src/utils/generatedWallets';
import { Blockchain } from '../../src/utils/Blockchain';
import { ethers } from 'ethers';
import { expectRevert } from '../../src/utils/expectRevert';
import { StableShare } from '../../typechain/StableShare';

const ZERO = new BigNumber(0);
const BASE = new BigNumber(10).pow(18);

const provider = new ethers.providers.JsonRpcProvider();
const blockchain = new Blockchain(provider);

describe('Actions.supply()', () => {
  const [ownerWallet, userWallet] = generatedWallets(provider);

  let arc: Arc;
  let stableShare: StableShare;

  beforeEach(async () => {
    stableShare = await StableShare.deploy(ownerWallet);
    arc = await Arc.deploy(ownerWallet, {
      collateralRatio: ZERO,
      syntheticRatio: ZERO,
      liquidationSpread: ZERO,
      originationFee: ZERO,
      interestSetter: ethers.constants.AddressZero,
      liquidityAsset: stableShare.address,
    });
  });

  it('should not be able to supply 0', async () => {
    await expectRevert(arc.supply(0));
  });

  it('should not be able to supply without enough funds', async () => {
    await expectRevert(arc.supply(BASE.mul(10)));
  });

  it('should be able to supply', async () => {
    await arc.supply(new BigNumber(10));
  });

  it('should not accrue interest if there are no borrows', async () => {});

  it('should accrue the correct amount of interest after 1 block', async () => {});

  it('should accrue the correct amount of interest after 5 blocks', async () => {});

  it('should accrue the correct amount of interest after 10 blocks', async () => {});
});
