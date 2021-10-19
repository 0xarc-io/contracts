import { Fixture } from 'ethereum-waffle';

import { Contracts, Stubs, TestingSigners, SDKs } from './testing';

declare module 'mocha' {
  interface Context {
    signers: TestingSigners;
    contracts: Contracts;
    loadFixture: <T>(fixture: Fixture<T>) => Promise<T>;
    stubs: Stubs;
    sdks: SDKs;
  }
}
