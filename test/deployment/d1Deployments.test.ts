import fs from 'fs';
import path from 'path';

import { toWei, isAddress } from 'web3-utils';
import { asyncForEach } from '@src/utils/asyncForEach';

import { ethers } from 'hardhat';
import { loadContract, loadContracts } from '../../deployments/src/loadContracts';
import { DeploymentType } from '../../deployments/src/writeToDeployments';
import { pruneDeployments } from '../../deployments/src';
import { generatedWallets } from '../helpers/generatedWallets';
import { expect } from 'chai';
import { StateV1Factory } from '@src/typings/StateV1Factory';
import { CoreV4Factory } from '@src/typings/CoreV4Factory';

require('dotenv').config();

const hre = require('hardhat');

const networks = ['mainnet', 'rinkeby'];

describe('deployments', () => {
  networks.forEach((network) => {
    describe(network, () => {
      testNetwork(network);
    });
  });
});

async function testNetwork(network: string) {
  const hreNetwork = hre.config.networks[network];
  const provider = new ethers.providers.JsonRpcProvider(hreNetwork.url);
  const signer = generatedWallets(provider)[0];

  const coreProxyDetails = loadContract({
    network,
    type: DeploymentType.synth,
    group: 'LINKUSD',
    name: 'CoreProxy',
  });

  const stateContractDetails = loadContract({
    network,
    type: DeploymentType.synth,
    group: 'LINKUSD',
    name: 'StateV1',
  });

  const syntheticDetails = loadContract({
    network,
    type: DeploymentType.synth,
    group: 'LINKUSD',
    name: 'Synthetic',
  });

  const state = new StateV1Factory(signer).attach(stateContractDetails.address);
  const core = new CoreV4Factory(signer).attach(coreProxyDetails.address);

  it('should have the correct addresses setup for Core', async () => {
    expect(await state.core()).to.equal(coreProxyDetails.address);
    expect(await state.syntheticAsset()).to.equal(syntheticDetails.address);
  });

  it('should have the correct admin set for core', async () => {
    if (hreNetwork.users?.owner?.length > 0) {
      expect(await (await core.getAdmin()).toLowerCase()).to.equal(
        hreNetwork.users.owner.toLowerCase(),
      );
    }
  });
}
