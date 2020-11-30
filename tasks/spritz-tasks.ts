import 'module-alias/register';

import { task } from 'hardhat/config';
import { red, yellow, green } from 'chalk';

import { NetworkParams } from '../deployments/src/deployContract';
import { loadContract } from '../deployments/src/loadContracts';
import {
  deployContract,
  DeploymentType,
  loadSynthConfig,
  pruneDeployments,
} from '../deployments/src';
import {
  ArcProxyFactory,
  ChainLinkOracleFactory,
  CoreV4Factory,
  MockOracleFactory,
  StateV1Factory,
  StaticSyntheticTokenFactory,
  SynthRegistryFactory,
  TestTokenFactory,
} from '@src/typings';

task('deploy-spritz', 'Deploy the Spritz contracts')
  .addParam('synth', 'The synth you would like to interact with')
  .setAction(async (taskArgs, hre) => {
    const synthName = taskArgs.synth;
    const network = hre.network.name;

    const signer = (await hre.ethers.getSigners())[0];

    await pruneDeployments(network, signer.provider);

    const synthConfig = loadSynthConfig({ network, key: synthName });
    const networkConfig = { network, signer } as NetworkParams;

    const coreAddress = await deployContract(
      {
        name: 'SpritzCore',
        source: 'CoreV4',
        data: new CoreV4Factory(signer).getDeployTransaction(),
        version: 4,
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

    const syntheticAddress = await deployContract(
      {
        name: 'SyntheticToken',
        source: 'StaticSyntheticToken',
        data: new StaticSyntheticTokenFactory(signer).getDeployTransaction(synthName, synthName),
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
          data: new MockOracleFactory(signer).getDeployTransaction(),
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
          data: new ChainLinkOracleFactory(signer).getDeployTransaction(
            synthConfig.oracle_source_address,
          ),
          version: 1,
          type: DeploymentType.synth,
          group: synthName,
        },
        networkConfig,
      );
    }

    const proxyAddress = (oracleAddress = await deployContract(
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
    ));

    const core = await new CoreV4Factory(signer).attach(proxyAddress);

    const stateAddress = await deployContract(
      {
        name: 'SpritzState',
        source: 'StateV1',
        data: new StateV1Factory(signer).getDeployTransaction(
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
      const synthRegistry = await new SynthRegistryFactory(signer).attach(
        synthRegistryDetails.address,
      );
      await synthRegistry.addSynth(proxyAddress, syntheticAddress);
      console.log(green(`Added to Synth Registry!\n`));
    } catch (error) {
      console.log(red(`Failed to add to Synth Registry!\nReason: ${error}\n`));
    }

    const state = await new StateV1Factory(signer).attach(stateAddress);
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
