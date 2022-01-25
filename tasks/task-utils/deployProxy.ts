import { deployContract } from '../../deployments/src';
import { DeploymentType, NetworkParams } from '../../deployments/types';
import { ArcProxyFactory } from '../../src/typings';
import { green, red } from 'chalk';
import { Signer } from 'ethers';

export async function deployProxy(
  signer: Signer,
  group: string,
  contractImplementation: string,
  networkConfig: NetworkParams,
): Promise<string> {
  const proxyAddress = await deployContract(
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
