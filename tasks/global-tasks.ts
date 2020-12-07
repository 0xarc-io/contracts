import { ArcxTokenFactory, SynthRegistryFactory, SynthRegistryV2Factory } from '@src/typings';
import { deployContract, pruneDeployments } from '../deployments/src';
import { task } from 'hardhat/config';
import { DeploymentType } from '../deployments/src/writeToDeployments';
import { NetworkParams } from '../deployments/src/deployContract';
import { ArcProxyInfoFactory } from '@src/typings/ArcProxyInfoFactory';
import { arrayify } from '@ethersproject/bytes';
import { SavingsRegistryFactory } from '@src/typings/SavingsRegistryFactory';

task('deploy-global', 'Deploy, update and interact with global contracts').setAction(
  async (taskArgs, hre) => {
    const network = hre.network.name;
    const signer = (await hre.ethers.getSigners())[0];

    await pruneDeployments(network, signer.provider);

    const networkConfig = { network, signer } as NetworkParams;

    const arcxTokenAddress = await deployContract(
      {
        name: 'ArcxToken',
        source: 'ArcxToken',
        data: new ArcxTokenFactory(signer).getDeployTransaction(),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );

    const synthRegistry = await deployContract(
      {
        name: 'SynthRegistry',
        source: 'SynthRegistry',
        data: new SynthRegistryFactory(signer).getDeployTransaction(),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );

    const synthRegistryV2 = await deployContract(
      {
        name: 'SynthRegistryV2',
        source: 'SynthRegistryV2',
        data: new SynthRegistryV2Factory(signer).getDeployTransaction(),
        version: 2,
        type: DeploymentType.global,
      },
      networkConfig,
    );

    const proxyInfo = await deployContract(
      {
        name: 'ArcProxyInfo',
        source: 'ArcProxyInfo',
        data: new ArcProxyInfoFactory(signer).getDeployTransaction(),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );

    const savingsRegistry = await deployContract(
      {
        name: 'SavingsRegistry',
        source: 'SavingsRegistry',
        data: new SavingsRegistryFactory(signer).getDeployTransaction(),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );
  },
);

// @TODO: Scenarios to plan for:
//        - Deploying all the core contracts
//          - ARCX Token
//          - Synth Registry
//        - Deploying a new version of KYF
//        - Deploy a new KYF Token
//        - Deploy a new Skillset Token
//        - Transfer ownership of any new token to the rightful owner
//        - Getting verified on Etherscan
