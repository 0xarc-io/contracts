import {
  ArcProxyFactory,
  JointPassportCampaignFactory,
  KermanRewardsFactory,
  MockKermanSocialMoneyFactory,
  SablierFactory,
  StakingAccrualERC20Factory,
  StakingAccrualERC20V5Factory,
  TestTokenFactory,
} from '@src/typings';
import { green, red, yellow } from 'chalk';

import {
  deployContract,
  loadContract,
  loadDetails,
  loadStakingConfig,
  pruneDeployments,
} from '../deployments/src';
import { task } from 'hardhat/config';
import getUltimateOwner from './task-utils/getUltimateOwner';
import { verifyContract } from './task-utils';
import { deployProxy } from './task-utils/deployProxy';
import { DeploymentType } from '../deployments/types';
import { utils } from 'ethers';
import { getEvent } from '@src/utils/getEvent';

task('deploy-staking', 'Deploy a staking/reward pool')
  .addParam('name', 'The name of the pool you would like to deploy')
  .setAction(async (taskArgs, hre) => {
    const name = taskArgs.name;

    const {
      network,
      signer,
      networkConfig,
      networkDetails,
    } = await loadDetails(hre);

    const ultimateOwner = getUltimateOwner(signer, networkDetails);

    const stakingConfig = await loadStakingConfig({ network, key: name });

    if (!stakingConfig.rewardsDurationSeconds) {
      throw Error(
        '"rewardsDurationSeconds" is not set in the staking-config.json file',
      );
    }

    await pruneDeployments(network, signer.provider);

    const arcDAO = await loadContract({
      name: 'ArcDAO',
      type: DeploymentType.global,
      version: 2,
      network,
    });

    const rewardToken = loadContract({
      name: stakingConfig.rewardsToken,
      type: DeploymentType.global,
      network,
    });

    const stakingTokenAddress =
      stakingConfig.stakingToken ||
      (await deployContract(
        {
          name: 'TestStakingToken',
          source: 'TestToken',
          data: new TestTokenFactory(signer).getDeployTransaction(
            `${name}-TestToken`,
            name,
            18,
          ),
          version: 1,
          type: DeploymentType.staking,
          group: name,
        },
        networkConfig,
      ));

    if (!stakingTokenAddress) {
      throw red(`There was no valid staking token address that could be used`);
    }

    if (!stakingConfig.stakingToken) {
      const stakingToken = TestTokenFactory.connect(
        stakingTokenAddress,
        signer,
      );
      // A new testing token was created
      await verifyContract(
        hre,
        stakingTokenAddress,
        await stakingToken.name(),
        name,
        18,
      );
    }

    const implementationContract = await deployContract(
      {
        name: 'Implementation',
        source: stakingConfig.source,
        data: stakingConfig.getDeployTx(signer),
        version: 1,
        type: DeploymentType.staking,
        group: name,
      },
      networkConfig,
    );
    console.log(yellow(`Verifying implementation...`));
    await verifyContract(hre, implementationContract);

    const proxyAddress = await deployContract(
      {
        name: 'Proxy',
        source: 'ArcProxy',
        data: new ArcProxyFactory(signer).getDeployTransaction(
          implementationContract,
          await signer.getAddress(),
          [],
        ),
        version: 1,
        type: DeploymentType.staking,
        group: name,
      },
      networkConfig,
    );
    console.log(yellow(`Verifying proxy...`));
    await verifyContract(
      hre,
      proxyAddress,
      implementationContract,
      await signer.getAddress(),
      [],
    );

    const proxyContract = stakingConfig.contractFactory.connect(
      proxyAddress,
      signer,
    );

    if ((await proxyContract.rewardsToken()) !== rewardToken.address) {
      // Contract is not initialized yet
      console.log(yellow(`* Calling init()...`));
      try {
        await stakingConfig.runInit(
          proxyContract,
          arcDAO.address,
          ultimateOwner,
          rewardToken.address,
          stakingTokenAddress,
        );
        console.log(green(`Called init() successfully!\n`));
      } catch (error) {
        console.log(red(`Failed to call init().\nReason: ${error}\n`));
        return;
      }
    } else {
      console.log(yellow(`Contract is already initialized`));
    }

    // Add approved state contracts
    if (stakingConfig.coreContracts) {
      const stateProxies = [];
      try {
        for (const rewardGroup of stakingConfig.coreContracts) {
          const contract = await loadContract({
            name: 'CoreProxy',
            type: DeploymentType.borrowing,
            network,
            group: rewardGroup,
          });
          stateProxies.push(contract.address);
        }

        console.log(yellow('Approving state contracts...'));
        await proxyContract.setApprovedStateContracts(stateProxies);
        console.log(green('State contracts approved successfully!'));
      } catch (error) {
        console.log(
          red(`Failed to set approved state contracts. Reason: ${error}\n`),
        );
      }
    }

    const existingRewardsDuration = await proxyContract.rewardsDuration();
    if (!existingRewardsDuration.eq(stakingConfig.rewardsDurationSeconds)) {
      try {
        console.log(
          yellow(
            `Setting rewards duration: ${stakingConfig.rewardsDurationSeconds}`,
          ),
        );
        await proxyContract.setRewardsDuration(
          stakingConfig.rewardsDurationSeconds,
        );
        console.log(green('Rewards duration successfully set'));
      } catch (error) {
        console.log(
          red(`Failed to set the rewards duration. Reason: ${error}\n`),
        );
        return;
      }
    } else {
      console.log(green(`Rewards duration is already set`));
    }
  });

task('deploy-staking-liquidity', 'Deploy a LiquidityCampaign')
  .addParam('name', 'The name of the pool you would like to deploy')
  .setAction(async (taskArgs, hre) => {
    const name = taskArgs.name;

    const {
      network,
      signer,
      networkConfig,
      networkDetails,
    } = await loadDetails(hre);

    const ultimateOwner = getUltimateOwner(signer, networkDetails);

    const stakingConfig = await loadStakingConfig({ network, key: name });

    if (!stakingConfig.rewardsDurationSeconds) {
      throw red(
        `"rewardsDurationSeconds" is not set in the staking-config.ts file`,
      );
    }

    await pruneDeployments(network, signer.provider);

    const arcDAO = await loadContract({
      name: 'ArcDAO',
      type: DeploymentType.global,
      version: 2,
      network,
    });

    const rewardToken = await loadContract({
      source: stakingConfig.rewardsToken,
      type: DeploymentType.global,
      network,
    });

    if (!arcDAO || !rewardToken) {
      throw red(
        `There is no ArcDAO, RewardToken or Core Contract in this deployments file`,
      );
    }

    const stakingTokenAddress =
      stakingConfig.stakingToken ||
      (await deployContract(
        {
          name: 'TestStakingToken',
          source: 'TestToken',
          data: new TestTokenFactory(signer).getDeployTransaction(
            `${name}-TestToken`,
            name,
            18,
          ),
          version: 1,
          type: DeploymentType.staking,
          group: name,
        },
        networkConfig,
      ));

    const implementationContractAddress = await deployContract(
      {
        name: 'Implementation',
        source: stakingConfig.source,
        data: stakingConfig.getDeployTx(signer),
        version: 1,
        type: DeploymentType.staking,
        group: name,
      },
      networkConfig,
    );

    const proxyContract = await deployContract(
      {
        name: 'Proxy',
        source: 'ArcProxy',
        data: new ArcProxyFactory(signer).getDeployTransaction(
          implementationContractAddress,
          await signer.getAddress(),
          [],
        ),
        version: 1,
        type: DeploymentType.staking,
        group: name,
      },
      networkConfig,
    );

    if (!stakingConfig.contractFactory) {
      throw red(`"contractFactory" missing from in the staking-config.ts file`);
    }

    const implementation = stakingConfig.contractFactory.connect(
      proxyContract,
      signer,
    );

    console.log(yellow(`* Calling init()...`));
    try {
      await stakingConfig.runInit(
        implementation,
        arcDAO.address,
        ultimateOwner,
        rewardToken.address,
        stakingTokenAddress,
      );
      console.log(green(`Called init() successfully!\n`));
    } catch (error) {
      console.log(red(`Failed to call init().\nReason: ${error}\n`));
    }

    try {
      console.log(yellow('Setting rewards duration...'));
      await implementation.setRewardsDuration(
        stakingConfig.rewardsDurationSeconds,
      );
      console.log(green('Rewards duration successfully set'));
    } catch (error) {
      console.log(
        red(`Failed to set the rewards duration. Reason: ${error}\n`),
      );
    }

    console.log(yellow(`Verifying contract...`));
    await hre.run('verify:verify', {
      address: implementationContractAddress,
      constructorArguments: [],
    });
    console.log(green(`Contract verified successfully!`));
  });

task('deploy-staking-joint-passport', 'Deploy a JointPassportCampaign')
  .addParam('name', 'The name of the pool you would like to deploy')
  .setAction(async (taskArgs, hre) => {
    const { name } = taskArgs;

    const { network, signer, networkConfig } = await loadDetails(hre);

    await pruneDeployments(network, signer.provider);

    const stakingConfig = await loadStakingConfig({ network, key: name });

    const mandatoryFields = [
      'collabRewardsToken',
      'rewardsDurationSeconds',
      'daoAllocation',
    ];

    for (const field of mandatoryFields) {
      if (!stakingConfig[field]) {
        throw red(`"${field}" is missing from the config file`);
      }
    }

    const {
      arcRewardsDistributor,
      collabRewardsDistributor,
      collabRewardsToken,
      stakingToken,
      daoAllocation,
      maxStakePerUser,
      creditScoreThreshold,
      rewardsDurationSeconds,
    } = stakingConfig;

    const arcDAO = loadContract({
      name: 'ArcDAO',
      type: DeploymentType.global,
      version: 2,
      network,
    });

    const rewardToken = loadContract({
      name: 'ArcxToken',
      type: DeploymentType.global,
      version: 2,
      network,
    });

    const creditScoreDetails = loadContract({
      name: 'SapphireCreditScoreProxy',
      network,
    });

    // Joint campaign doesn't use a proxy
    const jointPassportCampaignAddy = await deployContract(
      {
        name: 'JointPassportCampaign',
        source: stakingConfig.source,
        data: new JointPassportCampaignFactory(signer).getDeployTransaction(
          arcDAO.address,
          arcRewardsDistributor || signer.address,
          collabRewardsDistributor || signer.address,
          rewardToken.address,
          collabRewardsToken,
          stakingToken,
          creditScoreDetails.address,
          daoAllocation,
          maxStakePerUser,
          creditScoreThreshold,
        ),
        type: DeploymentType.staking,
        group: name,
        version: 1,
      },
      networkConfig,
    );
    await verifyContract(
      hre,
      jointPassportCampaignAddy,
      arcDAO.address,
      arcRewardsDistributor || signer.address,
      collabRewardsDistributor || signer.address,
      rewardToken.address,
      collabRewardsToken,
      stakingToken,
      creditScoreDetails.address,
      daoAllocation,
      maxStakePerUser,
      creditScoreThreshold,
    );

    const jointPassportCampaign = JointPassportCampaignFactory.connect(
      jointPassportCampaignAddy,
      signer,
    );

    console.log(yellow(`Setting rewards duration...`));
    await jointPassportCampaign.setRewardsDuration(rewardsDurationSeconds);
    console.log(green(`Rewards duration was set successfully`));
  });

task(
  'deploy-staking-accrual',
  'Deploy the StakingAccrual ERC20 staking contract, with 18 decimals',
)
  .addOptionalParam('name', 'Name of the ERC20')
  .addOptionalParam('symbol', 'Symbol of the ERC20')
  .addOptionalParam('stakingtoken', 'Address of the Token which will be staked')
  .addOptionalParam(
    'exitcooldownduration',
    'Minimal duration of withdrawing staking token from staking accrual contract',
  )
  .addOptionalParam('defipassport', 'Address of the defi passport contract')
  .addOptionalParam('sablier', 'Address of the Sablier contract to use')
  .addOptionalParam('ver', 'Version of the implementation contract')
  .addFlag('implementationonly', 'Only deploy implementation')
  .setAction(async (taskArgs, hre) => {
    const {
      name,
      symbol,
      stakingtoken: stakingToken,
      exitcooldownduration: exitCoolDownDuration,
      implementationonly: implementationOnly,
      defipassport: defiPassport,
      sablier,
      ver: version,
    } = taskArgs;

    const { network, signer, networkConfig } = await loadDetails(hre);

    if (
      !implementationOnly &&
      (!name ||
        !symbol ||
        !stakingToken ||
        !exitCoolDownDuration ||
        !defiPassport)
    ) {
      throw red(
        'Name, symbol, staking token, exit cooldown duration or the defi passport address are missing',
      );
    }

    await pruneDeployments(network, signer.provider);

    let factory: StakingAccrualERC20Factory | StakingAccrualERC20V5Factory;
    let source: string;

    switch (version) {
      case '1':
      case '2':
      case '3':
      case '4':
        source = 'StakingAccrualERC20';
        factory = new StakingAccrualERC20Factory(signer);
        break;
      case '5':
      default:
        source = 'StakingAccrualERC20V5';
        factory = new StakingAccrualERC20V5Factory(signer);
    }

    const contractImplementation = await deployContract(
      {
        name: 'StakingAccrualERC20',
        source,
        data: factory.getDeployTransaction(),
        version: Number(version) || 1,
        type: DeploymentType.global,
        group: 'StakingAccrualERC20',
      },
      networkConfig,
    );

    if (contractImplementation) {
      console.log(
        green(
          `StakingAccrualERC20 implementation deployed at ${contractImplementation}`,
        ),
      );
    } else {
      throw red(`StakingAccrualERC20 implementation was not deployed!`);
    }

    if (implementationOnly) {
      await hre.run('verify:verify', {
        address: contractImplementation,
        constructorArguments: [],
      });
      return;
    }

    const proxyAddress = await deployContract(
      {
        name: 'StakingAccrualERC20Proxy',
        source: 'ArcProxy',
        data: new ArcProxyFactory(signer).getDeployTransaction(
          contractImplementation,
          await signer.getAddress(),
          [],
        ),
        version: 1,
        type: DeploymentType.global,
        group: 'StakingAccrualERC20',
      },
      networkConfig,
    );

    if (proxyAddress) {
      console.log(
        green(
          `StakingAccrualERC20Proxy successfully deployed at ${proxyAddress}`,
        ),
      );
    } else {
      throw red(`StakingAccrualERC20Proxy was not deployed!`);
    }

    const stakingAccrualProxyContract = StakingAccrualERC20Factory.connect(
      proxyAddress,
      signer,
    );

    const decimals = 18;

    console.log(
      yellow(`Calling init({
      name: ${name},
      symbol: ${symbol},
      decimals: ${decimals},
      stakingToken: ${stakingToken},
      exitCoolDownDuration: ${exitCoolDownDuration},
      defiPassport: ${defiPassport},
      sablier: ${sablier}
    })...`),
    );
    await stakingAccrualProxyContract.init(
      name,
      symbol,
      decimals,
      stakingToken,
      exitCoolDownDuration,
      defiPassport,
      sablier,
    );
    console.log(green(`Init successfully called`));

    console.log(yellow('Verifying contracts...'));
    await hre.run('verify:verify', {
      address: contractImplementation,
      constructorArguments: [],
    });
    await hre.run('verify:verify', {
      address: proxyAddress,
      constructorArguments: [
        contractImplementation,
        await signer.getAddress(),
        [],
      ],
    });
  });

task('deploy-kerman-rewards', 'Deploy the KermanRewards staking contract')
  .addOptionalParam('stakingtoken', 'Address of the Token which will be staked')
  .addOptionalParam(
    'rewardstoken',
    'Address of the Token which will be used as rewards',
  )
  .addOptionalParam(
    'stakedeadline',
    'Deadline till which users can stake tokens',
  )
  .addOptionalParam('sablier', 'Address of the Sablier contract to use')
  .addFlag('implementationonly', 'Only deploy implementation')
  .setAction(async (taskArgs, hre) => {
    const {
      stakingtoken,
      rewardstoken: rewardsToken,
      stakedeadline: stakeDeadline,
      sablier,
      implementationonly: implementationOnly,
    } = taskArgs;

    const { network, signer, networkConfig } = await loadDetails(hre);

    const stakingToken =
      stakingtoken ||
      (await deployContract(
        {
          name: 'MockKermanSocialMoney',
          source: 'MockKermanSocialMoney',
          data: new MockKermanSocialMoneyFactory(signer).getDeployTransaction(
            `MockKermanSocialMoney`,
            '$Kerman',
            18,
            signer.address,
          ),
          version: 1,
          type: DeploymentType.staking,
          group: 'KermanRewards',
        },
        networkConfig,
      ));

    if (
      !implementationOnly &&
      (!stakingToken || !rewardsToken || !stakeDeadline)
    ) {
      throw red('Staking token, rewards token, stake deadline are missing');
    }

    await pruneDeployments(network, signer.provider);

    const factory = new KermanRewardsFactory(signer);

    const contractImplementation = await deployContract(
      {
        name: 'KermanRewards',
        source: 'KermanRewards',
        data: factory.getDeployTransaction(),
        version: 1,
        type: DeploymentType.global,
        group: 'KermanRewards',
      },
      networkConfig,
    );

    if (contractImplementation) {
      console.log(
        green(
          `KermanRewards implementation deployed at ${contractImplementation}`,
        ),
      );
    } else {
      throw red(`KermanRewards implementation was not deployed!`);
    }

    if (implementationOnly) {
      await verifyContract(hre, contractImplementation);
      return;
    }

    const proxyAddress = await deployProxy(
      signer,
      'KermanRewards',
      contractImplementation,
      networkConfig,
    );

    const kermanRewardsProxyContract = KermanRewardsFactory.connect(
      proxyAddress,
      signer,
    );

    const sablierAddr = await kermanRewardsProxyContract.sablierContract();
    if (!sablierAddr) {
      console.log(
        yellow(`Calling init({
          stakingToken: ${stakingToken},
          rewardsToken: ${rewardsToken},
          stakeDeadline: ${stakeDeadline},
          sablier: ${sablier}
        })...`),
      );

      await kermanRewardsProxyContract.init(
        sablier,
        stakingToken,
        rewardsToken,
        stakeDeadline,
      );
      console.log(green(`Init successfully called`));
    } else {
      console.log(yellow(`Not calling init since it was already called`));
    }

    console.log(yellow('Verifying contracts...'));
    await verifyContract(hre, contractImplementation);
    await verifyContract(
      hre,
      proxyAddress,
      contractImplementation,
      await signer.getAddress(),
      [],
    );
  });

task(
  'top-up-starcx',
  'Tops up the stARCx contract with the given amount of ARCx',
)
  .addParam('amount', 'Amount of ARCx to top up in ether')
  .setAction(async (taskArgs, hre) => {
    const { amount } = taskArgs;

    const { network, signer } = await loadDetails(hre);

    const starcxAddress = await loadContract({
      name: 'StakingAccrualERC20Proxy',
      network,
    }).address;
    const starcx = StakingAccrualERC20Factory.connect(starcxAddress, signer);

    const sablierAddress = await starcx.sablierContract();
    const sablier = SablierFactory.connect(sablierAddress, signer);

    // Claim any outstanding rewards
    console.log(yellow('Claiming stream funds...'));
    let tx = await starcx.claimStreamFunds();
    await tx.wait();

    const arcxAddress = await starcx.stakingToken();
    const arcx = TestTokenFactory.connect(arcxAddress, signer);

    const targetAmount = utils.parseEther(amount);
    console.log(yellow('Minting ARCx share...'));
    tx = await arcx.mintShare(signer.address, targetAmount);
    await tx.wait();

    // Create new sablier stream
    const streamDuration = 30 * 24 * 60 * 60;
    const streamAmount = targetAmount.div(streamDuration).mul(streamDuration);
    const startTime = Math.floor(new Date().getTime() / 1000) + 60;
    const endTime = startTime + streamDuration;

    console.log(yellow('Approving stream amount on the sablier stream...'));
    tx = await arcx.approve(sablierAddress, streamAmount);
    await tx.wait();

    console.log(yellow('Creating stream...'));
    tx = await sablier.createStream(
      starcxAddress,
      streamAmount,
      arcxAddress,
      startTime,
      endTime,
    );
    await tx.wait();
    const txLogs = await getEvent(tx, sablier, 'CreateStream');
    const streamId = txLogs.args.streamId;

    console.log(yellow(`Setting stream id ${streamId}`));
    tx = await starcx.setSablierStreamId(streamId);
    await tx.wait();
  });

task(
  'print-stream-amount',
  'Prints the amount in wei to be created in the sablier stream',
)
  .addParam('amount', 'Amount of ARCx to top up in ether')
  .addParam('duration', 'Duration of the stream in seconds')
  .setAction(async (taskArgs) => {
    const { amount, duration } = taskArgs;

    const targetAmount = utils.parseEther(amount);
    const streamAmount = targetAmount.div(duration).mul(duration);

    console.log(green(`${streamAmount} wei`));
  });
