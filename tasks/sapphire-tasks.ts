import { ArcProxyFactory, SyntheticTokenV2Factory } from '@src/typings';
import { green, magenta, red, yellow } from 'chalk';
import {
  deployContract,
  DeploymentType,
  loadDetails,
  pruneDeployments,
} from '../deployments/src';
import { task } from 'hardhat/config';

task(
  'deploy-sapphire-synth',
  'Deploy the Sapphire synthetic token (SyntheticTokenV2)',
)
  .addParam('name', 'The name of the synthetic token')
  .addParam('symbol', 'The symbol of the synthetic token')
  .setAction(async (taskArgs, hre) => {
    const name = taskArgs.name;
    const symbol = taskArgs.symbol;

    const { network, signer, networkConfig } = await loadDetails(taskArgs, hre);

    await pruneDeployments(network, signer.provider);

    // Deploy implementation

    const syntheticAddress = await deployContract(
      {
        name: 'SyntheticToken',
        source: 'SyntheticTokenV2',
        data: new SyntheticTokenV2Factory(signer).getDeployTransaction(
          name,
          '2',
        ),
        version: 2,
        type: DeploymentType.synth,
      },
      networkConfig,
    );

    if (!syntheticAddress) {
      throw red('Synthetic Token has not been deployed!');
    }

    // Deploy proxy

    const syntheticProxyAddress = await deployContract(
      {
        name: 'SyntheticV2Proxy',
        source: 'ArcProxy',
        data: new ArcProxyFactory(signer).getDeployTransaction(
          syntheticAddress,
          signer.address,
          [],
        ),
        version: 2,
        type: DeploymentType.synth,
        group: symbol,
      },
      networkConfig,
    );

    const synthetic = SyntheticTokenV2Factory.connect(
      syntheticProxyAddress,
      signer,
    );

    // Call init()

    const synthName = await synthetic.name();
    if (synthName.length > 0) {
      console.log(
        magenta(`Synthetic init() function has already been called\n`),
      );
      return;
    }

    console.log(yellow(`Calling init() ...\n`));
    try {
      await synthetic.init(name, symbol, '2');
      console.log(green(`init() called successfully!\n`));
    } catch (e) {
      console.log(red(`Failed to call synthetic init().\nReason: ${e}\n`));
    }
  });
