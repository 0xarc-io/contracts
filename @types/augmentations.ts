/* eslint-disable @typescript-eslint/no-explicit-any */
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { Fixture } from 'ethereum-waffle';

import { Contracts, Stubs, TestingSigners, SDKs } from './testing';
import { BASE } from '../src/constants';

declare module 'mocha' {
  interface Context {
    signers: TestingSigners;
    contracts: Contracts;
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    stubs: Stubs;
    sdks: SDKs;
  }
}
