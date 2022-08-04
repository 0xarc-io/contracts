import { DeploymentType } from '../deployments/types';
import {
  ChainLinkOracleFactory,
} from '@src/typings';
import { green } from 'chalk';
import { task } from 'hardhat/config';
import { loadHardhatDetails } from './utils/loadHardhatDetails';
import { pruneDeployments } from './utils/pruneDeployments';
import { verifyContract } from './utils/verifyContract';
import { deployAndSaveContract } from './utils/deployAndSaveContract';

task('deploy-chainlink-oracle')
  .addParam('name', 'The name of the asset')
  .addParam('pricefeed', 'Address of the chainlink price feed')
  .setAction(async (taskArgs, hre) => {
    const { pricefeed, name } = taskArgs;
    const { network, signer, networkConfig } = await loadHardhatDetails(hre);

    await pruneDeployments(network, signer.provider);

    const oracleAddress = await deployAndSaveContract(
      {
        name: 'ChainlinkOracle' + name,
        source: 'ChainlinkOracle',
        data: new ChainLinkOracleFactory(signer).getDeployTransaction(
          taskArgs.pricefeed,
        ),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );
    await verifyContract(hre, oracleAddress, pricefeed);

    console.log(green(`Contract ChainlinkOracle is at ${oracleAddress}`));
  });
