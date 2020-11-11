import 'module-alias/register';

import { subtask, task } from 'hardhat/config';
import { red, blue, yellow, green } from 'chalk';

import {
  ChainLinkOracle,
  MockOracle,
  StateV1,
  SyntheticToken,
  SynthRegistry,
} from '../src/typings';

import { NetworkParams } from '../deployments/src/deployContract';
import { params } from '../hardhat.config';
import { loadContract, loadContracts } from '../deployments/src/loadContracts';
import { CoreV4, ArcProxy } from '@src/typings';
import { TestToken } from '@src/typings/TestToken';
import {
  deployContract,
  DeploymentType,
  loadSynthConfig,
  pruneDeployments,
  writeToDeployments,
} from '../deployments/src';

task('deploy-d1', 'Deploy the D1 contracts')
  .addParam('synth', 'The synth you would like to interact with')
  .setAction(async (taskArgs, hre) => {
    const synthName = taskArgs.synth;
    const network = hre.network.name;

    const signer = (await hre.ethers.getSigners())[0];

    await pruneDeployments(network, signer);

    const synthConfig = loadSynthConfig({ network, synth: synthName });
    const networkConfig = { network, signer } as NetworkParams;

    const coreAddress = await deployContract(
      {
        name: 'CoreV4',
        source: 'CoreV4',
        data: CoreV4.getDeployTransaction(signer),
        version: 1,
        type: DeploymentType.synth,
      },
      networkConfig,
    );

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
        data: SyntheticToken.getDeployTransaction(
          signer,
          synthName,
          synthName,
          synthConfig.version,
        ),
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

    const core = await CoreV4.at(signer, proxyAddress);

    const stateAddress = await deployContract(
      {
        name: 'StateV1',
        source: 'StateV1',
        data: StateV1.getDeployTransaction(
          signer,
          core.address,
          collateralAddress,
          syntheticAddress,
          oracleAddress,
          {
            collateralRatio: { value: synthConfig.params.collateral_ratio },
            liquidationUserFee: { value: synthConfig.params.liquidation_user_fee },
            liquidationArcFee: { value: synthConfig.params.liquidation_arc_fee },
          },
          {
            collateralLimit: synthConfig.params.collateral_limit || 0,
            syntheticLimit: synthConfig.params.synthetic_limit || 0,
            positionCollateralMinimum: synthConfig.params.position_collateral_minimum || 0,
          },
        ),
        version: 1,
        type: DeploymentType.synth,
        group: synthName,
      },
      networkConfig,
    );

    console.log(yellow(`* Calling init()...`));
    try {
      await core.init(stateAddress);
      console.log(green(`Called init() successfully!\n`));
    } catch (error) {
      console.log(red(`Failed to call init().\nReason: ${error}\n`));
    }

    console.log(yellow(`* Adding to synth registry...`));

    const synthRegistryDetails = loadContract({
      network,
      type: DeploymentType.global,
      name: 'SynthRegistry',
    });
    try {
      const synthRegistry = await SynthRegistry.at(signer, synthRegistryDetails.address);
      await synthRegistry.addSynth(proxyAddress, syntheticAddress);
      console.log(green(`Added to Synth Registry!\n`));
    } catch (error) {
      console.log(red(`Failed to add to Synth Registry!\nReason: ${error}\n`));
    }

    const state = await StateV1.at(signer, stateAddress);
    await state.setRiskParams({
      collateralLimit: 0,
      syntheticLimit: 0,
      positionCollateralMinimum: 0,
    });
  });
// @TODO: Scenarios to plan for:
//        - Deploying the entire stack
//        - Deploying a specific core version
//        - Deploying the state contract
//        - Transfering ownership to the rightful owner
//        - Print the proxy, core, collateral and synthetic addresses
//        - Getting verified on Etherscan
