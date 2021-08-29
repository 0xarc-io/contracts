import { loadContracts } from '../../deployments/src/loadContracts';
import { expect } from 'chai';

/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config();

/* eslint-disable @typescript-eslint/no-var-requires */
describe('loadContracts', () => {
  it('loads one contract', () => {
    const arcxDaoV2 = loadContracts({
      network: 'rinkeby',
      source: 'AddressAccrual',
      name: 'ArcDAO',
      type: 'global',
      group: undefined,
      version: 2,
    });

    expect(arcxDaoV2).to.have.length(1);
  });

  it('loads multiple contracts', () => {
    const arcxTokens = loadContracts({
      group: 'yUSD-STABLEx',
      network: 'rinkeby',
    });

    expect(arcxTokens).to.have.length(3);
  });
});
