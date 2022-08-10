import { DeploymentType, NetworkParams } from '../../deployments/types';
import { green, red } from 'chalk';
import { Signer } from 'ethers';
import { deployAndSaveContract } from './deployAndSaveContract';
import { ArcProxyFactory } from '@src/typings';

export async function deployProxy(
  signer: Signer,
  group: string,
  contractImplementation: string,
  networkConfig: NetworkParams,
): Promise<string> {
  const proxyAddress = await deployAndSaveContract(
    {
      name: `${group}Proxy`,
      source: 'ArcProxy',
      data: new ArcProxyFactory(signer).getDeployTransaction(
        contractImplementation,
        await signer.getAddress(),
        [],
      ),
      version: 1,
      type: DeploymentType.global,
      group,
    },
    networkConfig,
  );

  if (proxyAddress) {
    console.log(
      green(`${group}Proxy successfully deployed at ${proxyAddress}`),
    );
    return proxyAddress;
  } else {
    throw red(`${group}Proxy was not deployed!`);
  }
}
