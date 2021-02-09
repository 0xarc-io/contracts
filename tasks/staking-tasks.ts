import {
  ArcProxyFactory,
  ArcxTokenFactory,
  RewardCampaignFactory,
  TestTokenFactory,
} from '@src/typings';
import { green, red, yellow } from 'chalk';

import {
  deployContract,
  DeploymentType,
  loadContract,
  loadDetails,
  loadStakingConfig,
  pruneDeployments,
} from '../deployments/src';
import { task } from 'hardhat/config';

task('deploy-staking', 'Deploy a staking/reward pool')
  .addParam('name', 'The name of the pool you would like to deploy')
  .setAction(async (taskArgs, hre) => {
    const name = taskArgs.name;

    const { network, signer, networkConfig, networkDetails } = await loadDetails(taskArgs, hre);
    const ultimateOwner = networkDetails['users'].owner.toLowerCase();

    const stakingConfig = await loadStakingConfig({ network, key: name });

    if (!stakingConfig.rewardsDurationSeconds) {
      throw Error('"rewardsDurationSeconds" is not set in the staking-config.json file');
    }

    await pruneDeployments(network, signer.provider);

    const arcDAO = await loadContract({
      name: 'ArcDAO',
      type: DeploymentType.global,
      network,
    });

    const rewardToken = await loadContract({
      name: stakingConfig.rewardsToken,
      type: DeploymentType.global,
      network,
    });

    if (!arcDAO || !rewardToken) {
      throw red(`There is no ArcDAO, RewardToken or Core Contract in this deployments file`);
    }

    const stakingTokenAddress =
      stakingConfig.stakingToken ||
      (await deployContract(
        {
          name: 'TestStakingToken',
          source: 'TestToken',
          data: new TestTokenFactory(signer).getDeployTransaction(`${name}-TestToken`, name, 18),
          version: 1,
          type: DeploymentType.staking,
          group: name,
        },
        networkConfig,
      ));

    if (!stakingTokenAddress) {
      throw red(`There was no valid staking token address that could be used`);
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

    const proxyContract = await deployContract(
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

    const implementation = RewardCampaignFactory.connect(proxyContract, signer);

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

    // Add approved state contracts
    const stateProxies = [];
    try {
      for (const rewardGroup of stakingConfig.coreContracts) {
        const contract = await loadContract({
          name: 'CoreProxy',
          type: DeploymentType.synth,
          network,
          group: rewardGroup,
        });
        stateProxies.push(contract.address);
      }

      console.log(yellow('Approving state contracts...'));
      await implementation.setApprovedStateContracts(stateProxies);
      console.log(green('State contracts approved successfully!'));
    } catch (error) {
      console.log(red(`Failed to set approved state contracts. Reason: ${error}\n`));
    }

    try {
      console.log(yellow('Setting rewards duration...'));
      await implementation.setRewardsDuration(stakingConfig.rewardsDurationSeconds);
      console.log(green('Rewards duration successfully set'));
    } catch (error) {
      console.log(red(`Failed to set the rewards duration. Reason: ${error}\n`));
    }

    // if ((await signer.getChainId()) != 1) {
    //   const collateralAmount = ArcNumber.new(10);

    //   console.log(yellow('Minting 1 staking token...'));
    //   const stakingToken = TestTokenFactory.connect(stakingTokenAddress, signer);
    //   await stakingToken.mintShare(await signer.getAddress(), ArcNumber.new(1));
    //   await stakingToken.approve(proxyContract, ArcNumber.new(1));

    //   const arc = await MozartTestArc.init(signer);
    //   await arc.addSynths({ TESTX: stateProxies[0] });

    //   const collateralToken = await loadContract({
    //     name: 'CollateralToken',
    //     source: 'TestToken',
    //     group: stakingConfig.rewardConfig.coreContracts[0],
    //     network,
    //   });
    //   const collateralTokenContract = TestTokenFactory.connect(collateralToken.address, signer);

    //   console.log(yellow('Minting collateral token...'));
    //   await collateralTokenContract.mintShare(await signer.getAddress(), collateralAmount);
    //   await collateralTokenContract.approve(stateProxies[0], collateralAmount);

    //   console.log(yellow('Opening a position...'));
    //   const positionResult = await arc.openPosition(
    //     collateralAmount,
    //     collateralAmount.div(2),
    //     signer,
    //   );
    //   const positionId = positionResult.params.id;

    //   console.log(yellow('Staking...'));
    //   await implementation.stake(ArcNumber.new(1), positionId, stateProxies[0]);

    //   console.log(yellow(`* Minting reward tokens and notifying rewards contract...`));
    //   const arcToken = ArcxTokenFactory.connect(rewardToken.address, signer);
    //   await arcToken.mint(proxyContract, ArcNumber.new(100));
    //   await implementation.notifyRewardAmount(ArcNumber.new(100));
    //   console.log(green(`Executed successfully!\n`));
    // }
  });

task('deploy-staking-liquidity', 'Deploy a LiquidityCampaign')
  .addParam('name', 'The name of the pool you would like to deploy')
  .setAction(async (taskArgs, hre) => {
    const name = taskArgs.name;

    const { network, signer, networkConfig, networkDetails } = await loadDetails(taskArgs, hre);

    const ultimateOwner = networkDetails['users'].owner.toLowerCase();

    const stakingConfig = await loadStakingConfig({ network, key: name });

    if (!stakingConfig.rewardsDurationSeconds) {
      throw red(`"rewardsDurationSeconds" is not set in the staking-config.ts file`);
    }

    await pruneDeployments(network, signer.provider);

    const arcDAO = await loadContract({
      name: 'ArcDAO',
      type: DeploymentType.global,
      network,
    });

    const rewardToken = await loadContract({
      name: stakingConfig.rewardsToken,
      type: DeploymentType.global,
      network,
    });

    if (!arcDAO || !rewardToken) {
      throw red(`There is no ArcDAO, RewardToken or Core Contract in this deployments file`);
    }

    const stakingTokenAddress =
      stakingConfig.stakingToken ||
      (await deployContract(
        {
          name: 'TestStakingToken',
          source: 'TestToken',
          data: new TestTokenFactory(signer).getDeployTransaction(`${name}-TestToken`, name, 18),
          version: 1,
          type: DeploymentType.staking,
          group: name,
        },
        networkConfig,
      ));

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

    const proxyContract = await deployContract(
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

    if (!stakingConfig.contractFactory) {
      throw red(`"contractFactory" missing from in the staking-config.ts file`);
    }

    const implementation = stakingConfig.contractFactory.connect(proxyContract, signer);

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
      await implementation.setRewardsDuration(stakingConfig.rewardsDurationSeconds);
      console.log(green('Rewards duration successfully set'));
    } catch (error) {
      console.log(red(`Failed to set the rewards duration. Reason: ${error}\n`));
    }
  });
