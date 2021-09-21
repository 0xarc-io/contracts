import { ArcUniswapV2Oracle__factory } from '@src/typings';
import { green } from 'chalk';
import { task } from 'hardhat/config';
import {
  deployContract,
  DeploymentType,
  loadDetails,
  pruneDeployments,
} from '../deployments/src';

const KEEP3RV1_ADDRESS = '0x1cEB5cB57C4D4E2b2433641b95Dd330A33185A44';
const UNIV2_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';

task('deploy-uniswap-oracle', 'Deploy the uniswap TWAP oracle').setAction(
  async (taskArgs, hre) => {
    const { network, signer, networkConfig } = await loadDetails(hre);

    await pruneDeployments(network, signer.provider);

    const oracleAddress = await deployContract(
      {
        name: 'ArcUniswapV2Oracle',
        source: 'ArcUniswapV2Oracle',
        data: new ArcUniswapV2Oracle__factory(signer).getDeployTransaction(
          KEEP3RV1_ADDRESS,
          UNIV2_FACTORY,
        ),
        version: 1,
        type: DeploymentType.synth,
      },
      networkConfig,
    );

    console.log(green(`Contract ArcUniswapV2Oracle is at ${oracleAddress}`));
  },
);
