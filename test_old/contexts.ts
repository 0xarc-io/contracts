/* eslint-disable @typescript-eslint/no-explicit-any */
import { Signer } from '@ethersproject/abstract-signer';
import { Wallet } from '@ethersproject/wallet';
import { ethers, waffle } from 'hardhat';

import { Contracts, TestingSigners, Stubs, SDKs } from '../arc-types/testing';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

const { createFixtureLoader } = waffle;

/**
 * This is run at the beginning of each suite of tests: 2e2, integration and unit.
 */
export function baseContext(description: string, hooks: () => void): void {
  describe(description, function () {
    before(async function () {
      this.contracts = {
        mozart: {},
        spritz: {},
        synthetic: {},
      } as Contracts;

      this.signers = {} as TestingSigners;
      this.stubs = {} as Stubs;
      this.sdks = {} as SDKs;

      const signers: SignerWithAddress[] = await ethers.getSigners();
      this.signers.admin = signers[0];
      this.signers.minter = signers[1];
      this.signers.minter2 = signers[2];
      this.signers.minter3 = signers[3];
      this.signers.liquidator = signers[4];
      this.signers.saver = signers[5];
      this.signers.globalOperator = signers[5];
      this.signers.positionOperator = signers[5];
      this.signers.unauthorised = signers[5];

      /* Get rid of this when https://github.com/nomiclabs/hardhat/issues/849 gets fixed. */
      this.loadFixture = createFixtureLoader((signers as any[]) as Wallet[]);
    });

    hooks();
  });
}
