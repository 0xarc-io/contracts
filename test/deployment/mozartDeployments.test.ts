import { ethers } from 'hardhat';
import _ from 'lodash';
import { loadContract, loadContracts } from '../../deployments/src/loadContracts';
import { DeploymentType } from '../../deployments/src/writeToDeployments';
import { generatedWallets } from '../helpers/generatedWallets';
import { expect } from 'chai';
import { MozartCoreV1Factory, SyntheticTokenV1, SyntheticTokenV1Factory } from '@src/typings';
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
  const eoaOwner = hreNetwork.users?.eoaOwner?.toLowerCase();
  const multisigOwner = hreNetwork.users?.multisigOwner?.toLowerCase();

  const synthContracts = loadContracts({
    network: network,
    type: DeploymentType.synth,
    name: 'CoreProxy',
  });

  const synthProxiesChecked = {};
  // const synths = ['ETHX', 'yUSD-STABLEx', 'cUSDC-STABLEx', 'xSUSHI-STABLEx'];

  synthContracts.forEach((coreProxyDetails) => {
    const synth = coreProxyDetails.group;
    const synthProxyName = synth.split('-').length == 1 ? synth : synth.split('-')[1];

    if (synthProxyName === 'LINKUSD') {
      return;
    }

    describe(`Core: ${coreProxyDetails.group}`, () => {
      let syntheticProxyDetails;
      let synthetic: SyntheticTokenV1;

      if (synthProxyName in synthProxiesChecked) {
        syntheticProxyDetails = synthProxiesChecked[synthProxyName];
        synthetic = SyntheticTokenV1Factory.connect(syntheticProxyDetails.address, signer);
      } else {
        try {
          syntheticProxyDetails = loadContract({
            network,
            type: DeploymentType.synth,
            group: synthProxyName,
            name: 'SyntheticProxy',
          });
        } catch {
          return;
        }

        synthetic = SyntheticTokenV1Factory.connect(syntheticProxyDetails.address, signer);

        it(`should have the synthetic (${synthProxyName}) configured correctly`, async () => {
          expect(await (await synthetic.getAdmin()).toLowerCase()).to.satisfy(
            (admin) => admin === eoaOwner || admin === multisigOwner,
          );
        });

        synthProxiesChecked[synthProxyName] = syntheticProxyDetails;
      }

      const oracleDetails = loadContract({
        network,
        type: DeploymentType.synth,
        group: synth,
        name: 'Oracle',
      });

      const mozartCore = MozartCoreV1Factory.connect(coreProxyDetails.address, signer);

      it('should have the core configured correctly', async () => {
        expect((await mozartCore.getAdmin()).toLowerCase()).to.satisfy(
          (admin) => admin === multisigOwner || admin === eoaOwner,
        );
        expect((await mozartCore.getCurrentOracle()).toLowerCase()).to.equal(
          oracleDetails.address.toLowerCase(),
        );
        expect((await mozartCore.getSyntheticAsset()).toLowerCase()).to.equal(
          syntheticProxyDetails.address.toLowerCase(),
        );
      });
    });
  });
}
