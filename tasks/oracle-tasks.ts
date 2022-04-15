import { DeploymentType } from '../deployments/types';
import {
  ArcUniswapV2OracleFactory,
  ChainLinkOracleFactory,
} from '@src/typings';
import { green } from 'chalk';
import { task } from 'hardhat/config';
import {
  deployContract,
  loadDetails,
  pruneDeployments,
} from '../deployments/src';
import { verifyContract } from './task-utils';

const KEEP3RV1_ADDRESS = '0x1cEB5cB57C4D4E2b2433641b95Dd330A33185A44';
const UNIV2_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';

task('deploy-uniswap-oracle', 'Deploy the uniswap TWAP oracle').setAction(
  async (_taskArgs, hre) => {
    const { network, signer, networkConfig } = await loadDetails(hre);

    await pruneDeployments(network, signer.provider);

    const oracleAddress = await deployContract(
      {
        name: 'ArcUniswapV2Oracle',
        source: 'ArcUniswapV2Oracle',
        data: new ArcUniswapV2OracleFactory(signer).getDeployTransaction(
          KEEP3RV1_ADDRESS,
          UNIV2_FACTORY,
        ),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );

    console.log(green(`Contract ArcUniswapV2Oracle is at ${oracleAddress}`));
  },
);

task('deploy-chainlink-oracle')
  .addParam('name', 'The name of the asset')
  .addParam('pricefeed', 'Address of the chainlink price feed')
  .setAction(async (taskArgs, hre) => {
    const { pricefeed, name } = taskArgs;
    const { network, signer, networkConfig } = await loadDetails(hre);

    await pruneDeployments(network, signer.provider);

    const oracleAddress = await deployContract(
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
