import { ethers } from 'hardhat';
import { loadContract } from '../../deployments/src/loadContracts';
import { DeploymentType } from '../../deployments/src/writeToDeployments';
import { generatedWallets } from '../helpers/generatedWallets';
import { expect } from 'chai';
import { StateV1Factory } from '@src/typings/StateV1Factory';
import { CoreV4Factory } from '@src/typings/CoreV4Factory';
import { deploymentTestNetworks } from '../../deployments/config';

/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config();

/* eslint-disable @typescript-eslint/no-var-requires */
const hre = require('hardhat');

describe('Spritz.deployments', () => {
  deploymentTestNetworks.forEach((network) => {
    describe(network, () => testNetwork(network));
  });
});

function testNetwork(network: string) {
  describe('LINKUSD', () => {
    const hreNetwork = hre.config.networks[network];
    const provider = new ethers.providers.JsonRpcProvider(hreNetwork.url);
    const signer = generatedWallets(provider)[0];
    const isOwnerSet = hreNetwork.users?.owner?.length > 0;
    const ultimateOwner = hreNetwork.users?.owner.toLowerCase();

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
      name: 'SpritzState',
    });

    const syntheticDetails = loadContract({
      network,
      type: DeploymentType.synth,
      group: 'LINKUSD',
      name: 'SyntheticToken',
    });

    const state = StateV1Factory.connect(stateContractDetails.address, signer);
    const core = CoreV4Factory.connect(coreProxyDetails.address, signer);

    it('should have the correct addresses setup for Core', async () => {
      expect(await state.core()).to.equal(coreProxyDetails.address);
      expect(await state.syntheticAsset()).to.equal(syntheticDetails.address);
    });

    it('should have the correct admin set for core', async () => {
      if (isOwnerSet) {
        expect((await core.getAdmin()).toLowerCase()).to.equal(ultimateOwner);
      }
    });
  });
}
