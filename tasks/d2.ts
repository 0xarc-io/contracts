import 'module-alias/register';

import { subtask, task } from 'hardhat/config';
import { red, blue, yellow, green } from 'chalk';
import { D2CoreV1, SyntheticToken, MockOracle, ArcProxy, ChainLinkOracle } from '@src/typings';
import { TestToken } from '@src/typings/TestToken';
import { NetworkParams } from '../deployments/src/deployContract';
import {
  deployContract,
  DeploymentType,
  loadSynthConfig,
  writeToDeployments,
} from '../deployments/src';

task('deploy-d2', 'Deploy, update and interact with D2 contracts')
  .addParam('synth', 'The synth you would like to interact with')
  .addOptionalParam('component', 'Only component to deploy at the moment is core')
  .setAction(async (taskArgs, bre) => {
    const synthName = taskArgs.synth;
    const network = bre.network.name;

    const signer = (await bre.ethers.getSigners())[0];

    const synthConfig = loadSynthConfig({ network, synth: synthName });
    const networkConfig = { network, signer } as NetworkParams;

    const coreAddress = await deployContract(
      {
        name: 'D2Core',
        source: 'D2CoreV1',
        data: D2CoreV1.getDeployTransaction(signer),
        version: 1,
        type: DeploymentType.synth,
      },
      networkConfig,
    );

    if (taskArgs.component == 'core') {
      return;
    }

    const collateralAddress =
      synthConfig.collateral_address ||
      (await deployContract(
        {
          name: 'Collateral',
          source: 'TestToken',
          data: TestToken.getDeployTransaction(signer, 'TestCollateral', 'TEST'),
          version: 1,
          type: DeploymentType.synth,
          group: synthName,
        },
        networkConfig,
      ));

    const syntheticAddress = await deployContract(
      {
        name: 'Synthetic',
        source: 'SyntheticToken',
        data: SyntheticToken.getDeployTransaction(signer, 'TESTUSD', 'TESTUSD'),
        version: 1,
        type: DeploymentType.synth,
        group: synthName,
      },
      networkConfig,
    );

    let oracleAddress = '';

    if (!synthConfig.oracle_source_address) {
      oracleAddress = await deployContract(
        {
          name: 'Oracle',
          source: 'MockOracle',
          data: MockOracle.getDeployTransaction(signer),
          version: 1,
          type: DeploymentType.synth,
          group: synthName,
        },
        networkConfig,
      );
    } else {
      oracleAddress = await deployContract(
        {
          name: 'Oracle',
          source: 'MockOracle',
          data: ChainLinkOracle.getDeployTransaction(signer, synthConfig.oracle_source_address),
          version: 1,
          type: DeploymentType.synth,
          group: synthName,
        },
        networkConfig,
      );
    }

    const proxyAddress = (oracleAddress = await deployContract(
      {
        name: 'Proxy',
        source: 'ArcProxy',
        data: ArcProxy.getDeployTransaction(signer, coreAddress, await signer.getAddress(), []),
        version: 1,
        type: DeploymentType.synth,
        group: synthName,
      },
      networkConfig,
    ));

    const core = await D2CoreV1.at(signer, proxyAddress);

    console.log(yellow(`* Calling init()...`));
    try {
      await core.init(
        collateralAddress,
        syntheticAddress,
        oracleAddress,
        signer.address,
        { value: synthConfig.collateral_ratio },
        { value: synthConfig.liquidation_user_fee },
        { value: synthConfig.liquidation_arc_ratio },
        { value: synthConfig.printer_arc_ratio },
      );
      console.log(green(`Called init() successfully!`));
    } catch {
      throw red(`Failed to call init()\n`);
    }

    console.log(yellow(`* Calling addMinter... \n`));
    const synth = await SyntheticToken.at(signer, syntheticAddress);
    try {
      await synth.addMinter(core.address);
      console.log(green(`Added minter!`));
    } catch {
      throw red(`Failed to add minter!\n`);
    }
  });

// @TODO: Scenarios to plan for:
//        - Deploying the entire stack (DONE)
//        - Deploying a specific core version (DONE)
//        - Transfering ownership to the rightful owner
//        - Print the proxy, core, collateral and synthetic addresses
//        - Getting verified on Etherscan
