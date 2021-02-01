import 'module-alias/register';

import { BigNumber } from 'ethers';
import { expect } from 'chai';

import { expectRevert } from '@test/helpers/expectRevert';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { WhitelistSale } from '@src/typings/WhitelistSale';
import { TestToken } from '@src/typings';

let ownerAccount: SignerWithAddress;
let userAccount: SignerWithAddress;

describe('WhitelistSale', () => {
  let whitelistSale: WhitelistSale;
  let currency: TestToken;

  xit('should not be able to set the allocation as a non-owner', async () => {});

  xit('should be able to set the allocation correctly', async () => {});

  xit('should be able to remove an allocation successfully', async () => {});

  xit('should not be able to spend if the sale has not started', async () => {});

  xit('should not be able to update the sale status as a non-owner', async () => {});

  xit('should be able to spend up to the allocation', async () => {});

  xit('should be able to spend more if the allocation increases', async () => {});
});
