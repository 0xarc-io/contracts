import 'module-alias/register';

import { task } from 'hardhat/config';
import { red, yellow, green, magenta } from 'chalk';

import { NetworkParams } from '../deployments/src/deployContract';
import { loadContract } from '../deployments/src/loadContracts';
import {
  deployContract,
  DeploymentType,
  loadDetails,
  loadSynthConfig,
  pruneDeployments,
} from '../deployments/src';
import { MAX_UINT256, FIVE_PERCENT } from '../src/constants';
import { loadSavingsConfig } from '../deployments/src/loadSynthConfig';
import { SavingsRegistryFactory } from '@src/typings/SavingsRegistryFactory';

import {
  ArcProxyFactory,
  ChainLinkOracleFactory,
  MockOracleFactory,
  MozartSavingsV1Factory,
  MozartCoreV1Factory,
  SyntheticTokenV1Factory,
  SynthRegistryV2Factory,
  TestTokenFactory,
  YUSDOracleFactory,
} from '@src/typings';
import ArcNumber from '@src/utils/ArcNumber';

task('deploy-mozart-synthetic', 'Deploy the Mozart synthetic token')
  .addParam('name', 'The name of the synthetic token')
  .addParam('symbol', 'The symbol of the synthetic token')
  .setAction(async (taskArgs, hre) => {
    const name = taskArgs.name;
    const symbol = taskArgs.symbol;

    const { network, signer, networkConfig } = await loadDetails(taskArgs, hre);

    await pruneDeployments(network, signer.provider);

    const syntheticAddress = await deployContract(
      {
        name: 'SyntheticToken',
        source: 'SyntheticTokenV1',
        data: new SyntheticTokenV1Factory(signer).getDeployTransaction(),
        version: 1,
        type: DeploymentType.synth,
      },
      networkConfig,
    );

    if (!syntheticAddress || syntheticAddress.length == 0) {
      throw red('Synthetic Token has not been deployed!');
    }

    const syntheticProxyAddress = await deployContract(
      {
        name: 'SyntheticProxy',
        source: 'ArcProxy',
        data: new ArcProxyFactory(signer).getDeployTransaction(
          syntheticAddress,
          signer.address,
          [],
        ),
        version: 1,
        type: DeploymentType.synth,
        group: symbol,
      },
      networkConfig,
    );

    const synthetic = SyntheticTokenV1Factory.connect(syntheticProxyAddress, signer);

    if ((await synthetic.name()).length > 0) {
      console.log(magenta(`Synthetic init() function has already been called\n`));
      return;
    }

    console.log(yellow(`* Calling synthetic init()...`));
    try {
      await synthetic.init(name, symbol, '1', { gasLimit: 1000000 });
      console.log(green(`Called synthetic init() successfully!\n`));
    } catch (error) {
      console.log(red(`Failed to call synthetic init().\nReason: ${error}\n`));
    }
  });

task('deploy-mozart', 'Deploy the Mozart contracts')
  .addParam('synth', 'The synth you would like to interact with')
  .setAction(async (taskArgs, hre) => {
    const synthName = taskArgs.synth;

    const { network, signer, networkConfig, networkDetails } = await loadDetails(taskArgs, hre);

    await pruneDeployments(network, signer.provider);

    const synthConfig = loadSynthConfig({ network, key: synthName });
    const globalGroup = synthName.split('-').length == 1 ? synthName : synthName.split('-')[1];

    const coreAddress = await deployContract(
      {
        name: 'MozartCore',
        source: 'MozartCoreV1',
        data: new MozartCoreV1Factory(signer).getDeployTransaction(),
        version: 1,
        type: DeploymentType.synth,
      },
      networkConfig,
    );

    const collateralAddress =
      synthConfig.collateral_address ||
      (await deployContract(
        {
          name: 'CollateralToken',
          source: 'TestToken',
          data: new TestTokenFactory(signer).getDeployTransaction('TestCollateral', 'TEST', 18),
          version: 1,
          type: DeploymentType.synth,
          group: synthName,
        },
        networkConfig,
      ));

    await hre.run(`deploy-mozart-synthetic`, { name: globalGroup, symbol: globalGroup });

    let oracleAddress = '';

    if (!synthConfig.oracle_link_aggregator_address && !synthConfig.oracle_source) {
      oracleAddress = await deployContract(
        {
          name: 'Oracle',
          source: 'MockOracle',
          data: new MockOracleFactory(signer).getDeployTransaction(),
          version: 1,
          type: DeploymentType.synth,
          group: synthName,
        },
        networkConfig,
      );
    } else if (synthConfig.oracle_link_aggregator_address) {
      oracleAddress = await deployContract(
        {
          name: 'Oracle',
          source: 'ChainLinkOracle',
          data: new ChainLinkOracleFactory(signer).getDeployTransaction(
            synthConfig.oracle_link_aggregator_address,
          ),
          version: 1,
          type: DeploymentType.synth,
          group: synthName,
        },
        networkConfig,
      );
    } else if (synthConfig.oracle_source == 'YUSDOracle') {
      oracleAddress = await deployContract(
        {
          name: 'Oracle',
          source: 'YUSDOracle',
          data: new YUSDOracleFactory(signer).getDeployTransaction(),
          version: 1,
          type: DeploymentType.synth,
          group: synthName,
        },
        networkConfig,
      );
    } else {
      throw red('No valid oracle config was found!');
    }

    if (!oracleAddress || oracleAddress.length == 0) {
      throw red('No valid oracle was deployed!');
    }

    const coreProxyAddress = await deployContract(
      {
        name: 'CoreProxy',
        source: 'ArcProxy',
        data: new ArcProxyFactory(signer).getDeployTransaction(
          coreAddress,
          await signer.getAddress(),
          [],
        ),
        version: 1,
        type: DeploymentType.synth,
        group: synthName,
      },
      networkConfig,
    );

    const syntheticProxyAddress = loadContract({
      network,
      type: DeploymentType.synth,
      name: 'SyntheticProxy',
      group: globalGroup,
    }).address;

    const core = MozartCoreV1Factory.connect(coreProxyAddress, signer);
    const synthetic = SyntheticTokenV1Factory.connect(syntheticProxyAddress, signer);

    console.log(yellow(`* Calling core init()...`));
    const interestRateSetter = networkDetails['users']['owner'] || signer.address;
    try {
      await core.init(
        synthConfig.params.decimals,
        collateralAddress,
        syntheticProxyAddress,
        oracleAddress,
        interestRateSetter,
        { value: synthConfig.params.collateral_ratio },
        { value: synthConfig.params.liquidation_user_fee },
        { value: synthConfig.params.liquidation_arc_ratio },
      );
      console.log(green(`Called core init() successfully!\n`));
      console.log(magenta(`The interest rate setter has been set to: ${interestRateSetter}`));
    } catch (error) {
      console.log(red(`Failed to call core init().\nReason: ${error}\n`));
    }

    console.log(yellow(`* Calling synthetic addMinter...`));
    try {
      // We already enforce limits at the synthetic level.
      await synthetic.addMinter(core.address, synthConfig.params.synthetic_limit || MAX_UINT256, {
        gasLimit: 1000000,
      });
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
      const synthRegistry = SynthRegistryV2Factory.connect(synthRegistryDetails.address, signer);
      await synthRegistry.addSynth(coreProxyAddress, syntheticProxyAddress);
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

task('deploy-mozart-savings', 'Deploy a Mozart Savings contract instance')
  .addParam('savings', 'The savings you would like to deploy')
  .setAction(async (taskArgs, hre) => {
    const savingsName = taskArgs.savings;

    const { network, signer, networkConfig } = await loadDetails(taskArgs, hre);

    await pruneDeployments(network, signer.provider);

    const savingsConfig = loadSavingsConfig({ network, key: savingsName });

    const syntheticProxyAddress = loadContract({
      network,
      name: 'SyntheticProxy',
      type: DeploymentType.synth,
      group: savingsName,
    }).address;

    if (!syntheticProxyAddress || syntheticProxyAddress.length == 0) {
      throw red(
        'There is no valid synthetic address set in the savings config for this network and savings contract!',
      );
    }

    const mozartSavingsAddress = await deployContract(
      {
        name: 'MozartSavings',
        source: 'MozartSavingsV1',
        data: new MozartSavingsV1Factory(signer).getDeployTransaction(),
        version: 1,
        type: DeploymentType.savings,
      },
      networkConfig,
    );

    const savingsProxyAddress = await deployContract(
      {
        name: 'SavingsProxy',
        source: 'ArcProxy',
        data: new ArcProxyFactory(signer).getDeployTransaction(
          mozartSavingsAddress,
          await signer.getAddress(),
          [],
        ),
        version: 1,
        type: DeploymentType.savings,
        group: savingsName,
      },
      networkConfig,
    );

    const savings = MozartSavingsV1Factory.connect(savingsProxyAddress, signer);
    const synthetic = SyntheticTokenV1Factory.connect(syntheticProxyAddress, signer);

    console.log(yellow(`* Calling savings init()...`));
    try {
      await savings.init(savingsConfig.name, savingsConfig.symbol, syntheticProxyAddress, {
        value: savingsConfig.savings_rate,
      });
      console.log(green(`Called savings init() successfully!\n`));
      console.log(magenta(`The savings rate has been set to: ${savingsConfig.savings_rate}`));
    } catch (error) {
      console.log(red(`Failed to call savings init().\nReason: ${error}\n`));
    }

    console.log(yellow(`* Calling synthetic addMinter...`));
    try {
      // We already enforce limits at the synthetic level.
      // We set the max since on main-net the deployer should never have the ability to do this
      await synthetic.addMinter(savings.address, MAX_UINT256, {
        gasLimit: 1000000,
      });
      console.log(green(`Added synthetic minter!\n`));
    } catch (error) {
      console.log(red(`Failed to add synthetic minter!\nReason: ${error}\n`));
    }

    console.log(yellow(`* Adding to savings registry v2...`));
    const savingsRegistryDetails = loadContract({
      network,
      type: DeploymentType.global,
      name: 'SavingsRegistry',
    });
    try {
      const savingsRegistry = SavingsRegistryFactory.connect(
        savingsRegistryDetails.address,
        signer,
      );
      await savingsRegistry.addSavings(syntheticProxyAddress, savings.address);
      console.log(green(`Added to Savings Registry!\n`));
    } catch (error) {
      console.log(red(`Failed to add to Savings Registry!\nReason: ${error}\n`));
    }

    // Do this to trigger an event on The Graph
    await savings.setArcFee({ value: 0 });

    if ((await signer.provider.getNetwork()).chainId != 1) {
      await savings.setPaused(false);
      await savings.setSavingsRate(FIVE_PERCENT);
    }
  });

// @TODO: Scenarios to plan for:
//        - Deploying the entire stack (DONE)
//        - Deploying a specific core version (DONE)
//        - Transfering ownership to the rightful owner
//        - Print the proxy, core, collateral and synthetic addresses
//        - Getting verified on Etherscan
