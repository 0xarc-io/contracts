import 'module-alias/register';

import { subtask, task } from 'hardhat/config';
import { red, blue, yellow, green } from 'chalk';

import {
  D2CoreV1,
  MockOracle,
  ArcProxy,
  ChainLinkOracle,
  TestToken,
  SynthRegistry,
} from '../src/typings';

import { NetworkParams } from '../deployments/src/deployContract';
import { params } from '../hardhat.config';
import { loadContract, loadContracts } from '../deployments/src/loadContracts';
import {
  deployContract,
  DeploymentType,
  loadSynthConfig,
  pruneDeployments,
  writeToDeployments,
} from '../deployments/src';
import { BigNumber } from 'ethers/utils';
import { MAX_UINT256 } from '../src/constants';
import { SyntheticTokenV1 } from '@src/typings/SyntheticTokenV1';
import { SynthRegistryV2 } from '@src/typings/SynthRegistryV2';

task('deploy-d2', 'Deploy the D2 contracts')
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
        name: 'D2Core',
        source: 'D2CoreV1',
        data: D2CoreV1.getDeployTransaction(signer),
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
        source: 'SyntheticTokenV1',
        data: SyntheticTokenV1.getDeployTransaction(
          signer,
          // synthName,
          // synthName,
          // synthConfig.version,
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
          source: 'ChainLinkOracle',
          data: ChainLinkOracle.getDeployTransaction(signer, synthConfig.oracle_source_address),
          version: 1,
          type: DeploymentType.synth,
          group: synthName,
        },
        networkConfig,
      );
    }

    const coreProxyAddress = await deployContract(
      {
        name: 'CoreProxy',
        source: 'ArcProxy',
        data: ArcProxy.getDeployTransaction(signer, coreAddress, await signer.getAddress(), []),
        version: 1,
        type: DeploymentType.synth,
        group: synthName,
      },
      networkConfig,
    );

    const syntheticProxyAddress = await deployContract(
      {
        name: 'SyntheticProxy',
        source: 'ArcProxy',
        data: ArcProxy.getDeployTransaction(
          signer,
          syntheticAddress,
          await signer.getAddress(),
          [],
        ),
        version: 1,
        type: DeploymentType.synth,
        group: synthName,
      },
      networkConfig,
    );

    const core = await D2CoreV1.at(signer, coreProxyAddress);
    const synthetic = await SyntheticTokenV1.at(signer, syntheticProxyAddress);

    console.log(yellow(`* Calling core init()...`));
    try {
      await core.init(
        collateralAddress,
        syntheticProxyAddress,
        oracleAddress,
        signer.address,
        { value: synthConfig.params.collateral_ratio },
        { value: synthConfig.params.liquidation_user_fee },
        { value: synthConfig.params.liquidation_arc_ratio },
      );
      console.log(green(`Called core init() successfully!\n`));
    } catch (error) {
      console.log(red(`Failed to call core init().\nReason: ${error}\n`));
    }

    console.log(yellow(`* Calling synthetic init()...`));
    try {
      await synthetic.init(synthName, synthName, synthConfig.version);
      console.log(green(`Called synthetic init() successfully!\n`));
    } catch (error) {
      console.log(red(`Failed to call synthetic init().\nReason: ${error}\n`));
    }

    console.log(yellow(`* Calling synthetic addMinter...`));
    try {
      // We already enforce limits at the synthetic level.
      await synthetic.addMinter(core.address, synthConfig.params.synthetic_limit || MAX_UINT256);
      console.log(green(`Added synthetic minter!\n`));
    } catch (error) {
      console.log(red(`Failed to add synthetic minter!\nReason: ${error}\n`));
    }

    console.log(yellow(`* Adding to synth registry v2...`));
    const synthRegistryDetails = loadContract({
      network,
      type: DeploymentType.global,
      name: 'SynthRegistryV2',
    });
    try {
      const synthRegistry = await SynthRegistryV2.at(signer, synthRegistryDetails.address);
      await synthRegistry.addSynth(coreProxyAddress, syntheticAddress);
      console.log(green(`Added to Synth Registry V2!\n`));
    } catch (error) {
      console.log(red(`Failed to add to Synth Registry V2!\nReason: ${error}\n`));
    }

    console.log(yellow(`* Calling setLimits...`));
    try {
      await core.setLimits(
        synthConfig.params.collateral_limit || 0,
        synthConfig.params.position_collateral_minimum || 0,
      );
      console.log(green(`Limits set!\n`));
    } catch (error) {
      console.log(red(`Failed to set limits!\nReason: ${error}\n`));
    }
  });

// @TODO: Scenarios to plan for:
//        - Deploying the entire stack (DONE)
//        - Deploying a specific core version (DONE)
//        - Transfering ownership to the rightful owner
//        - Print the proxy, core, collateral and synthetic addresses
//        - Getting verified on Etherscan
