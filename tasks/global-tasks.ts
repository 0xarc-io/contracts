import { task } from 'hardhat/config';
import { green } from 'chalk';

import { DeploymentType, NetworkParams } from '../deployments/types';
import { ArcxTokenV2Factory } from '@src/typings';
import { verifyContract } from './utils/verifyContract';
import { deployAndSaveContract } from './utils/deployAndSaveContract';

task('deploy-arcx-token-v2', 'Deploy the ArcxTokenV2')
  .addParam('name', 'Then name of the token')
  .addParam('symbol', 'The symbol of the token')
  .addParam('oldtoken', 'The address of the old ARCX token')
  .setAction(async (taskArgs, hre) => {
    const network = hre.network.name;
    const { name, symbol, oldtoken: oldArcxToken } = taskArgs;

    const signer = (await hre.ethers.getSigners())[0];
    const networkConfig = { network, signer } as NetworkParams;

    const arcxToken = await deployAndSaveContract(
      {
        name: 'ArcxToken',
        source: 'ArcxTokenV2',
        data: new ArcxTokenV2Factory(signer).getDeployTransaction(
          name,
          symbol,
          oldArcxToken,
        ),
        version: 2,
        type: DeploymentType.global,
      },
      networkConfig,
    );
    await verifyContract(hre, arcxToken, name, symbol, oldArcxToken);

    console.log(green(`ARCX V2 successfully deployed at ${arcxToken}`));
  });
