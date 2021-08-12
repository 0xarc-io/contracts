import {
  ArcProxyFactory,
  DefaultPassportSkinFactory,
  DefiPassportClaimerFactory,
  DefiPassportFactory,
} from '@src/typings';
import { green, red, yellow } from 'chalk';
import {
  pruneDeployments,
  loadDetails,
  DeploymentType,
  deployContract,
} from '../deployments/src';
import { task } from 'hardhat/config';

task('deploy-defi-passport', 'Deploy the Defi Passport NFT contract')
  .addParam('name', 'Name of the defi passport NFT')
  .addParam('symbol', 'Symbol of the defi passport NFT')
  .addParam('creditscore', 'Address of the SapphireCreditScore contract to use')
  .addOptionalParam(
    'skinmanager',
    'Address of the skin manager. Default is deployer',
  )
  .addFlag('implementationonly', 'Only deploy implementation')
  .setAction(async (taskArgs, hre) => {
    const {
      name,
      symbol,
      creditscore: creditScoreContractAddress,
      skinManager,
      implementationonly: implementationOnly,
    } = taskArgs;

    const { network, signer, networkConfig } = await loadDetails(taskArgs, hre);

    await pruneDeployments(network, signer.provider);

    const defiPassportImpl = await deployContract(
      {
        name: 'DefiPassport',
        source: 'DefiPassport',
        data: new DefiPassportFactory(signer).getDeployTransaction(),
        version: 1,
        type: DeploymentType.global,
        group: 'DefiPassport',
      },
      networkConfig,
    );

    if (defiPassportImpl) {
      console.log(
        green(`DefiPassport implementation deployed at ${defiPassportImpl}`),
      );
    } else {
      throw red(`DefiPassport implementation was not deployed!`);
    }

    if (implementationOnly) {
      await hre.run('verify:verify', {
        address: defiPassportImpl,
        constructorArguments: [],
      });
      return;
    }

    const defiPassportProxy = await deployContract(
      {
        name: 'DefiPassportProxy',
        source: 'ArcProxy',
        data: new ArcProxyFactory(signer).getDeployTransaction(
          defiPassportImpl,
          await signer.getAddress(),
          [],
        ),
        version: 1,
        type: DeploymentType.global,
        group: 'DefiPassport',
      },
      networkConfig,
    );

    if (defiPassportProxy) {
      console.log(
        green(
          `DefiPassportProxy successfully deployed at ${defiPassportProxy}`,
        ),
      );
    } else {
      throw red(`DefiPassportProxy was not deployed!`);
    }

    const defiPassportProxyContract = DefiPassportFactory.connect(
      defiPassportProxy,
      signer,
    );

    console.log(
      yellow(`Calling init({
      name: ${name},
      symbol: ${symbol},
      creditScoreContractAddress: ${creditScoreContractAddress},
      skinManager: ${skinManager || (await signer.getAddress())}
    })...`),
    );
    await defiPassportProxyContract.init(
      name,
      symbol,
      creditScoreContractAddress,
      skinManager || (await signer.getAddress()),
    );
    console.log(green(`Init successfully called`));

    console.log(yellow('Verifying contracts...'));
    await hre.run('verify:verify', {
      address: defiPassportImpl,
      constructorArguments: [],
    });
    await hre.run('verify:verify', {
      address: defiPassportProxy,
      constructorArguments: [defiPassportImpl, await signer.getAddress(), []],
    });
  });

task(
  'deploy-defi-passport-claimer',
  'Deploy the Defi Passport claimer contract',
)
  .addParam('creditscore', 'Address of the SapphireCreditScore contract to use')
  .addParam('defipassport', 'Address of the Defi Passport contract')
  .setAction(async (taskArgs, hre) => {
    const { creditscore, defipassport } = taskArgs;

    const { network, signer, networkConfig } = await loadDetails(taskArgs, hre);

    await pruneDeployments(network, signer.provider);

    const defiPassportClaimer = await deployContract(
      {
        name: 'DefiPassportClaimer',
        source: 'DefiPassportClaimer',
        data: new DefiPassportClaimerFactory(signer).getDeployTransaction(
          creditscore,
          defipassport,
        ),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );

    if (!defiPassportClaimer) {
      throw red(`Defi passport claimer was not deployed!`);
    }

    console.log(
      green(
        `DefiPassportClaimer successfully deployed at ${defiPassportClaimer}`,
      ),
    );

    console.log(yellow('Verifying contract...'));
    await hre.run('verify:verify', {
      address: defiPassportClaimer,
      constructorArguments: [creditscore, defipassport],
    });
  });

task(
  'deploy-default-passport-skin',
  'Deploy the Default Passport skin NFT contract',
)
  .addParam('name', 'The name of the NFT')
  .addParam('symbol', 'The symbol of the NFT')
  .setAction(async (taskArgs, hre) => {
    const { name, symbol } = taskArgs;
    const { network, signer, networkConfig } = await loadDetails(taskArgs, hre);

    await pruneDeployments(network, signer.provider);

    const defaultPassportSkinNft = await deployContract(
      {
        name: 'DefaultPassportSkin',
        source: 'DefaultPassportSkin',
        data: new DefaultPassportSkinFactory(signer).getDeployTransaction(
          name,
          symbol,
        ),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );

    if (!defaultPassportSkinNft) {
      throw red(`Default passport skin NFT not deployed!`);
    }

    console.log(
      green(`Default passport skin NFT deployed at ${defaultPassportSkinNft}`),
    );

    console.log(yellow(`Verifying contract...`));
    await hre.run('verify:verify', {
      address: defaultPassportSkinNft,
      constructorArguments: [name, symbol],
    });
  });
