import { BalanceTree } from '@src/MerkleTree';
import { MerkleDistributorFactory } from '@src/typings';
import { readCsv } from '@src/utils/readCsv';
import { green } from 'chalk';
import { BigNumber } from 'ethers';
import { task } from 'hardhat/config';
import path from 'path';
import { deployContract, DeploymentType, loadDetails, pruneDeployments } from '../deployments/src';

task('deploy-distributor', 'Deploy merkle token distributor')
  .addParam('token', 'The address of the distributed token')
  .addParam('csv', 'The path to csv with distribution data')
  .setAction(async (taskArgs, hre) => {
    const { network, signer, networkConfig } = await loadDetails(taskArgs, hre);
    await pruneDeployments(network, signer.provider);
    const data = readCsv(path.resolve(taskArgs.csv));
    const distributorTree = new BalanceTree(
      data.map((row) => {
        console.log(row[1]);
        return {
          account: row[0],
          amount: BigNumber.from(row[1]),
        };
      }),
    );
    const distributorAddress = await deployContract(
      {
        name: 'MerkleDistributor',
        source: 'MerkleDistributor',
        data: new MerkleDistributorFactory(signer).getDeployTransaction(
          taskArgs.token,
          distributorTree.getHexRoot(),
        ),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );

    console.log(green(`Contract MerkleDistributor is at ${distributorAddress}`));
  });

task('switch-active-distributor', 'Switch activity of distributor')
  .addParam('address', 'The address of the distributor contract')
  .setAction(async (taskArgs, hre) => {
    const { signer } = await loadDetails(taskArgs, hre);
    const distributorContract = MerkleDistributorFactory.connect(taskArgs.address, signer);
    const { wait } = await distributorContract.switchActive();
    await wait();
    console.log(
      green(
        `MerkleDistributor is ${
          (await distributorContract.active()) ? 'active ' : 'not active'
        } now`,
      ),
    );
  });
