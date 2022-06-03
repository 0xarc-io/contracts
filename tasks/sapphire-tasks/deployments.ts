import {
  ArcProxyFactory,
  FlashLiquidatorFactory,
  MockSapphireOracleFactory,
  SapphireAssessorFactory,
  SapphireCoreV1,
  SapphireCoreV1Factory,
  SapphireMapperLinearFactory,
  SapphirePassportScoresFactory,
  SapphirePoolFactory,
} from '@src/typings';
import { green, red, yellow } from 'chalk';
import {
  deployContract,
  loadCollateralConfig,
  loadContract,
  loadDetails,
  pruneDeployments,
} from '../../deployments/src';
import { task } from 'hardhat/config';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import _ from 'lodash';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import getUltimateOwner from '../task-utils/getUltimateOwner';
import { DEFAULT_MAX_CREDIT_SCORE } from '@test/helpers/sapphireDefaults';
import { constants } from 'ethers';
import { verifyContract } from '../task-utils';
import {
  CoreConfig,
  DeploymentType,
  NetworkParams,
} from '../../deployments/types';
import { TransactionRequest } from '@ethersproject/providers';
import prompt from 'prompt';

task(
  'deploy-passport-scores',
  'Deploy the SapphirePassportScores with zero hash as the root',
)
  .addOptionalParam('rootupdater', 'The merkle root updater')
  .addOptionalParam('pauseoperator', 'The pause operator')
  .addOptionalParam('initialEpoch', 'The initial epoch number')
  .addFlag('implementationonly', 'Deploy only the implementation contract')
  .setAction(async (taskArgs, hre) => {
    const {
      rootupdater: rootUpdater,
      pauseoperator: pauseOperator,
      implementationonly: implementationOnly,
      initialEpoch,
    } = taskArgs;
    const {
      network,
      signer,
      networkConfig,
      networkDetails,
    } = await loadDetails(hre);

    await pruneDeployments(network, signer.provider);

    const ultimateOwner = getUltimateOwner(signer, networkDetails);

    let version = 1;
    try {
      const existingPassportScoresImpl = loadContract({
        name: 'SapphirePassportScores',
        source: 'SapphirePassportScores',
        network: network,
      });
      version = existingPassportScoresImpl.version + 1;
      console.log(
        yellow(
          `SapphireCreditScore implementation found. Deploying a new version ${version}`,
        ),
      );
    } catch (err) {
      // Nothing to do
    }

    const passportScoresImpAddress = await deployContract(
      {
        name: 'SapphirePassportScores',
        source: 'SapphirePassportScores',
        data: new SapphirePassportScoresFactory(signer).getDeployTransaction(),
        version,
        type: DeploymentType.global,
      },
      networkConfig,
    );
    await verifyContract(hre, passportScoresImpAddress);

    if (implementationOnly) {
      return;
    }

    const passportScoresProxyAddress = await deployContract(
      {
        name: 'SapphirePassportScoresProxy',
        source: 'ArcProxy',
        data: new ArcProxyFactory(signer).getDeployTransaction(
          passportScoresImpAddress,
          await signer.getAddress(),
          [],
        ),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );
    const passportScoresContract = SapphirePassportScoresFactory.connect(
      passportScoresProxyAddress,
      signer,
    );

    if (!passportScoresProxyAddress) {
      throw red(`SapphirePassportScores could not be deployed :(`);
    }

    console.log(
      green(
        `SapphirePassportScores was successfully deployed at ${passportScoresProxyAddress}`,
      ),
    );

    console.log(yellow(`Calling init()...`));
    await passportScoresContract.init(
      constants.HashZero,
      rootUpdater || ultimateOwner,
      pauseOperator || ultimateOwner,
      initialEpoch || 0,
    );
    console.log(green(`init() called successfully!`));

    console.log(yellow('Verifying proxy..'));
    await verifyContract(
      hre,
      passportScoresProxyAddress,
      passportScoresImpAddress,
      await signer.getAddress(),
      [],
    );
  });

task('deploy-mapper', 'Deploy the Sapphire Mapper').setAction(
  async (_, hre) => {
    const { network, signer, networkConfig } = await loadDetails(hre);

    await pruneDeployments(network, signer.provider);

    // Deploy the mapper
    const mapperAddress = await deployContract(
      {
        name: 'SapphireMapperLinear',
        source: 'SapphireMapperLinear',
        data: new SapphireMapperLinearFactory(signer).getDeployTransaction(),
        version: 1,
        type: DeploymentType.borrowing,
      },
      networkConfig,
    );

    console.log(
      green(`Sapphire Mapper Linear successfully deployed at ${mapperAddress}`),
    );

    await verifyContract(hre, mapperAddress);
  },
);

task('deploy-assessor', 'Deploy the Sapphire Assessor').setAction(
  async (_, hre) => {
    const { network, signer, networkConfig } = await loadDetails(hre);

    await pruneDeployments(network, signer.provider);

    const passportScoresAddress = loadContract({
      network,
      type: DeploymentType.global,
      name: 'SapphirePassportScores',
    }).address;

    if (!passportScoresAddress) {
      throw red(`The Sapphire Credit Score must be deployed first`);
    }

    const mapperAddress = loadContract({
      network,
      type: DeploymentType.borrowing,
      name: 'SapphireMapperLinear',
    }).address;

    if (!mapperAddress) {
      throw red(`The Sapphire Mapper must be deployed first`);
    }

    // Deploy the mapper
    const assessorAddress = await deployContract(
      {
        name: 'SapphireAssessor',
        source: 'SapphireAssessor',
        data: new SapphireAssessorFactory(signer).getDeployTransaction(
          mapperAddress,
          passportScoresAddress,
          DEFAULT_MAX_CREDIT_SCORE,
        ),
        version: 1,
        type: DeploymentType.borrowing,
      },
      networkConfig,
    );

    await verifyContract(
      hre,
      assessorAddress,
      mapperAddress,
      passportScoresAddress,
      DEFAULT_MAX_CREDIT_SCORE,
    );
  },
);

task('deploy-sapphire', 'Deploy a Sapphire core')
  .addOptionalParam(
    'collateral',
    'The collateral name to register the core with',
  )
  .addFlag('implementationonly', 'Deploy only the implementation contract')
  .setAction(async (taskArgs, hre) => {
    const collatName = taskArgs.collateral;

    const {
      network,
      signer,
      networkConfig,
      networkDetails,
    } = await loadDetails(hre);

    await pruneDeployments(network, signer.provider);

    const coreAddress = await deployContract(
      {
        name: 'SapphireCore',
        source: 'SapphireCoreV1',
        data: new SapphireCoreV1Factory(signer).getDeployTransaction(),
        version: 1,
        type: DeploymentType.borrowing,
      },
      networkConfig,
    );
    console.log(
      green(`Sapphire Core implementation deployed at ${coreAddress}`),
    );
    await verifyContract(hre, coreAddress);

    if (taskArgs.implementationonly) return;

    if (!collatName) {
      throw red('You must specify the collateral name');
    }

    const collatConfig = await loadCollateralConfig({
      network,
      key: collatName,
    });

    if (!collatConfig) {
      throw red(
        `No configuration has been found for collateral: ${collatName}`,
      );
    }

    console.log(
      yellow(`Collateral config:\n`, JSON.stringify(collatConfig, null, 2)),
    );

    const coreProxyAddress = await deployContract(
      {
        name: 'SapphireCoreProxy',
        source: 'ArcProxy',
        data: new ArcProxyFactory(signer).getDeployTransaction(
          coreAddress,
          await signer.getAddress(),
          [],
        ),
        version: 1,
        type: DeploymentType.borrowing,
        group: collatName,
      },
      networkConfig,
    );
    console.log(green(`Sapphire core proxy deployed at ${coreProxyAddress}`));
    await verifyContract(
      hre,
      coreProxyAddress,
      coreAddress,
      await signer.getAddress(),
      [],
    );

    const { collateralAddress } = collatConfig;

    const oracleAddress = await _deployOracle(
      networkConfig,
      signer,
      hre,
      collatConfig.oracle,
    );

    if (!oracleAddress) {
      throw red(`The oracle was not deployed!`);
    }

    // Initialize core
    const assessorAddress = loadContract({
      network,
      type: DeploymentType.borrowing,
      name: 'SapphireAssessor',
    }).address;

    const core = SapphireCoreV1Factory.connect(coreProxyAddress, signer);

    const ultimateOwner = getUltimateOwner(signer, networkDetails);

    if (!ultimateOwner || ultimateOwner === constants.AddressZero) {
      throw red(`Ultimate owner is null`);
    }

    console.log(
      yellow(
        `Ultimate owner is ${
          collatConfig.interestSettings.interestSetter || ultimateOwner
        }`,
      ),
    );

    const collateralAddressSet = await core.collateralAsset();
    if (collateralAddressSet === constants.AddressZero) {
      prompt.start();
      console.log(
        red(
          `Please ensure the following details are correct:
            Collateral Address: ${collateralAddress}
            Oracle Address: ${oracleAddress}
            Interest Rate Setter: ${
              collatConfig.interestSettings.interestSetter || ultimateOwner
            }
            Pause operator: ${collatConfig.pauseOperator || ultimateOwner}
            Assessor address: ${assessorAddress}
            Fee collector: ${collatConfig.feeCollector || ultimateOwner}
            High c-ratio: ${collatConfig.borrowRatios.highCRatio}
            Low c-ratio: ${collatConfig.borrowRatios.lowCRatio}`,
        ),
      );
      const { agree } = await prompt.get([
        {
          name: 'agree',
          description: 'Do you agree?',
          default: 'Y',
        },
      ]);
      if (agree.toString().toLowerCase() !== 'y') {
        throw red(`You must agree to continue`);
      }

      console.log(yellow(`Calling core.init() ...\n`));
      const tx = await core.init(
        collateralAddress,
        oracleAddress,
        collatConfig.interestSettings.interestSetter || ultimateOwner,
        collatConfig.pauseOperator || ultimateOwner,
        assessorAddress,
        collatConfig.feeCollector || ultimateOwner,
        collatConfig.borrowRatios.highCRatio,
        collatConfig.borrowRatios.lowCRatio,
      );
      await tx.wait();
      console.log(green(`core.init() called successfully!\n`));
    } else {
      console.log(green('Core already initialized!'));
    }

    if ((await core.borrowPool()) !== collatConfig.borrowPool) {
      console.log(
        yellow(`Setting borrow pool to ${collatConfig.borrowPool} ...`),
      );
      await core.setBorrowPool(collatConfig.borrowPool);
      console.log(green('Borrow pool set successfully'));
    }

    if (await shouldSetFees(core, collatConfig)) {
      console.log(
        yellow(`Setting fees...
        Liquidator discount: ${collatConfig.fees.liquidatorDiscount}
        Arc liquidation fee: ${collatConfig.fees.liquidationArcFee}
        Pool interest fee: ${collatConfig.fees.poolInterestFee}
        Borrow fee: ${collatConfig.fees.borrowFee}
      `),
      );
      await core.setFees(
        collatConfig.fees.liquidatorDiscount,
        collatConfig.fees.liquidationArcFee,
        collatConfig.fees.borrowFee,
        collatConfig.fees.poolInterestFee,
      );
      console.log(green('Fees successfully set\n'));
    }

    // Set borrow limits if needed. Skip if all zeros
    if (await shouldSetLimits(core, collatConfig)) {
      console.log(
        yellow(`Setting limits:
        Vault borrow min: ${collatConfig.limits.vaultBorrowMin || 0}
        Vault borrow max: ${collatConfig.limits.vaultBorrowMax || 0}
        Default borrow limit: ${collatConfig.limits.defaultBorrowLimit || 0}
      `),
      );
      await core.setLimits(
        collatConfig.limits.vaultBorrowMin || 0,
        collatConfig.limits.vaultBorrowMax || 0,
        collatConfig.limits.defaultBorrowLimit || 0,
      );
      console.log(yellow(`Limits successfully set!\n`));
    }

    if (collatConfig.interestSettings.interestRate) {
      console.log(
        yellow(
          `Setting interest rate to ${collatConfig.interestSettings.interestRate.toString()}\n`,
        ),
      );
      await core.setInterestRate(collatConfig.interestSettings.interestRate);
      console.log(green(`Interest rate successfully set\n`));
    }
  });

task('deploy-borrow-pool')
  .addParam('name', 'Sapphire pool ERC20 name')
  .addParam('symbol', 'Sapphire pool ERC20 symbol')
  .setAction(async (taskArgs, hre) => {
    const { network, signer, networkConfig } = await loadDetails(hre);
    const { name, symbol } = taskArgs;

    await pruneDeployments(network, signer.provider);

    const sapphirePoolImpl = await deployContract(
      {
        name: 'SapphirePool',
        source: 'SapphirePool',
        data: new SapphirePoolFactory(signer).getDeployTransaction(),
        version: 1,
        type: DeploymentType.borrowing,
      },
      networkConfig,
    );
    await verifyContract(hre, sapphirePoolImpl);

    const sapphirePoolProxy = await deployContract(
      {
        name: 'SapphirePool',
        source: 'ArcProxy',
        data: new ArcProxyFactory(signer).getDeployTransaction(
          sapphirePoolImpl,
          signer.address,
          [],
        ),
        version: 1,
        type: DeploymentType.borrowing,
      },
      networkConfig,
    );

    console.log(green(`Sapphire pool deployed at ${sapphirePoolProxy}`));

    console.log(yellow('Calling init...'));
    console.log({
      name,
      symbol,
    });
    await SapphirePoolFactory.connect(sapphirePoolProxy, signer).init(
      name,
      symbol,
    );
  });

task('deploy-liquidator')
  .addParam('aaveAddressProvider', 'Aave address provider')
  .addParam('swapRouter', 'Uniswap V3 swap router')
  .setAction(async (taskArgs, hre) => {
    const { signer, networkConfig } = await loadDetails(hre);
    const { aaveAddressProvider, swapRouter } = taskArgs;

    const sapphireLiquidator = await deployContract(
      {
        name: 'FlashLiquidator',
        source: 'FlashLiquidator',
        data: new FlashLiquidatorFactory(signer).getDeployTransaction(
          aaveAddressProvider,
          swapRouter,
        ),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );
    await verifyContract(
      hre,
      sapphireLiquidator,
      aaveAddressProvider,
      swapRouter,
    );

    console.log(
      green(
        `FlashLiquidator was successfully deployed at ${sapphireLiquidator}`,
      ),
    );
  });

/**
 * Deploys the given oracle, or a mock oracle
 */
async function _deployOracle(
  networkConfig: NetworkParams,
  signer: SignerWithAddress,
  hre: HardhatRuntimeEnvironment,
  oracleConfig?: {
    source?: string;
    getDeployTx: (SignerWithAddress) => TransactionRequest;
    constructorArguments: unknown[];
  },
): Promise<string> {
  const { network } = networkConfig;

  if (_.isNil(oracleConfig)) {
    if (network === 'mainnet') {
      throw red(
        `The oracle was not set in the collateral config file. Please set it and try again.`,
      );
    }

    console.log(yellow(`Deploying mock oracle...`));
    const mockOracleAddress = await deployContract(
      {
        name: 'Oracle',
        source: 'MockOracle',
        data: new MockSapphireOracleFactory(signer).getDeployTransaction(),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );

    await verifyContract(hre, mockOracleAddress);
  } else {
    // Oracle is found, deploy it
    const { source, getDeployTx, constructorArguments } = oracleConfig;

    if (!source || !getDeployTx) {
      throw red(
        'No valid oracle was found! Check the "source" and "getDeployTx" fields of the "oracle" key in the collateral config file.',
      );
    }

    console.log(yellow(`Deploying oracle...`));
    const oracleAddress = await deployContract(
      {
        name: 'Oracle',
        source,
        data: getDeployTx(signer),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );
    console.log(
      green(`Oracle successfully deployed (or found) at ${oracleAddress}`),
    );
    await verifyContract(hre, oracleAddress, ...constructorArguments);

    return oracleAddress;
  }
}

async function shouldSetFees(
  core: SapphireCoreV1,
  collatConfig: CoreConfig,
): Promise<boolean> {
  if (
    !(await core.liquidatorDiscount()).eq(
      collatConfig.fees.liquidatorDiscount,
    ) ||
    !(await core.liquidationArcFee()).eq(collatConfig.fees.liquidationArcFee) ||
    !(await core.poolInterestFee()).eq(collatConfig.fees.poolInterestFee) ||
    !(await core.borrowFee()).eq(collatConfig.fees.borrowFee)
  ) {
    return true;
  }

  return false;
}

async function shouldSetLimits(
  core: SapphireCoreV1,
  collatConfig: CoreConfig,
): Promise<boolean> {
  if (
    !(await core.vaultBorrowMinimum()).eq(
      collatConfig.limits.vaultBorrowMin || 0,
    ) ||
    !(await core.vaultBorrowMaximum()).eq(collatConfig.limits.vaultBorrowMax) ||
    !(await core.defaultBorrowLimit()).eq(
      collatConfig.limits.defaultBorrowLimit || 0,
    )
  ) {
    return true;
  }

  return false;
}
