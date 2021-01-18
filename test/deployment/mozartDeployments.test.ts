import { ethers } from 'hardhat';
import { loadContract } from '../../deployments/src/loadContracts';
import { DeploymentType } from '../../deployments/src/writeToDeployments';
import { generatedWallets } from '../helpers/generatedWallets';
import { expect } from 'chai';
import { MozartCoreV1Factory, SyntheticTokenV1Factory } from '@src/typings';
import { deploymentTestNetworks } from '../../deployments/config';

/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config();

/* eslint-disable @typescript-eslint/no-var-requires */
const hre = require('hardhat');

describe('Mozart.deployments', () => {
  deploymentTestNetworks.forEach((network) => {
    describe(network, () => testNetwork(network));
  });
});

function testNetwork(network: string) {
  const hreNetwork = hre.config.networks[network];
  const provider = new ethers.providers.JsonRpcProvider(hreNetwork.url);
  const signer = generatedWallets(provider)[0];
  const isOwnerSet = hreNetwork.users?.owner?.length > 0;
  const ultimateOwner = hreNetwork.users?.owner.toLowerCase();

  const synths = ['ETHX', 'yUSD-STABLEx', 'cUSDC-STABLEx', 'xSUSHI-STABLEx'];

  synths.forEach((synth) => {
    describe(synth, () => {
      let coreProxyDetails;
      try {
        coreProxyDetails = loadContract({
          network,
          type: DeploymentType.synth,
          group: synth,
          name: 'CoreProxy',
        });
      } catch {
        return;
      }

      const syntheticProxyDetails = loadContract({
        network,
        type: DeploymentType.synth,
        group: synth.split('-').length == 1 ? synth : synth.split('-')[1],
        name: 'SyntheticProxy',
      });

      const oracleDetails = loadContract({
        network,
        type: DeploymentType.synth,
        group: synth,
        name: 'Oracle',
      });

      const mozartCore = MozartCoreV1Factory.connect(coreProxyDetails.address, signer);
      const synthetic = SyntheticTokenV1Factory.connect(syntheticProxyDetails.address, signer);

      it('should have the core configured correctly', async () => {
        expect((await mozartCore.getAdmin()).toLowerCase()).to.equal(ultimateOwner.toLowerCase());
        expect((await mozartCore.getCurrentOracle()).toLowerCase()).to.equal(
          oracleDetails.address.toLowerCase(),
        );
        expect((await mozartCore.getSyntheticAsset()).toLowerCase()).to.equal(
          syntheticProxyDetails.address.toLowerCase(),
        );
      });

      it('should have the synthetic configured correctly', async () => {
        expect(await (await synthetic.getAdmin()).toLowerCase()).to.equal(ultimateOwner);
      });
    });
  });
}
