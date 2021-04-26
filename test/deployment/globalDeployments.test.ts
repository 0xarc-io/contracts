import { ethers } from 'hardhat';
import { loadContract } from '../../deployments/src/loadContracts';
import { DeploymentType } from '../../deployments/src/writeToDeployments';
import { generatedWallets } from '../helpers/generatedWallets';
import { expect } from 'chai';
import {
  ArcxTokenFactory,
  SynthRegistryFactory,
  SynthRegistryV2Factory,
} from '@src/typings';
import { deploymentTestNetworks } from '../../deployments/config';

/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config();

/* eslint-disable @typescript-eslint/no-var-requires */
const hre = require('hardhat');

describe('Global.deployments', () => {
  deploymentTestNetworks.forEach((network) => {
    describe(network, () => testNetwork(network));
  });
});

function testNetwork(network: string) {
  const hreNetwork = hre.config.networks[network];
  const provider = new ethers.providers.JsonRpcProvider(hreNetwork.url);
  const signer = generatedWallets(provider)[0];
  const eoaOwner = hreNetwork.users?.eoaOwner?.toLowerCase();

  try {
    const arcTokenDetails = loadContract({
      network,
      type: DeploymentType.global,
      name: 'ArcxToken',
    });

    const arcxToken = ArcxTokenFactory.connect(arcTokenDetails.address, signer);

    it('should have the correct owner set for the arc token', async () => {
      expect(await (await arcxToken.owner()).toLowerCase()).to.equal(eoaOwner);
    });
  } catch {}

  try {
    const synthRegistryDetails = loadContract({
      network,
      type: DeploymentType.global,
      name: 'SynthRegistry',
    });

    const synthRegistry = SynthRegistryFactory.connect(
      synthRegistryDetails.address,
      signer,
    );

    it('should have the correct owner set for the synthetic registry', async () => {
      expect(await (await synthRegistry.owner()).toLowerCase()).to.equal(
        eoaOwner,
      );
    });
  } catch {}

  try {
    const synthRegistryV2Details = loadContract({
      network,
      type: DeploymentType.global,
      name: 'SynthRegistryV2',
    });

    const synthRegistry = SynthRegistryV2Factory.connect(
      synthRegistryV2Details.address,
      signer,
    );

    it('should have the correct owner set for the synthetic registry v2', async () => {
      expect(await (await synthRegistry.owner()).toLowerCase()).to.equal(
        eoaOwner,
      );
    });
  } catch {}
}
