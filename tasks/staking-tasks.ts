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
import ArcDecimal from '../src/utils/ArcDecimal';
import ArcNumber from '../src/utils/ArcNumber';

task('deploy-staking', 'Deploy a staking/reward pool')
  .addParam('name', 'The name of the pool you would like to deploy')
  .setAction(async (taskArgs, hre) => {
    const name = taskArgs.name;

    const { network, signer, networkConfig, networkDetails } = await loadDetails(taskArgs, hre);
    const ultimateOwner = networkDetails['users'].owner.toLowerCase();

    const stakingConfig = await loadStakingConfig({ network, key: name });
    const rewardConfig = stakingConfig.rewardConfig;

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

    const coreContract = await loadContract({
      name: 'CoreProxy',
      group: rewardConfig.coreContract,
      type: DeploymentType.synth,
      network,
    });

    if (!arcDAO || !rewardToken || !coreContract) {
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
        source: 'RewardCampaign',
        data: new RewardCampaignFactory(signer).getDeployTransaction(),
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
      await implementation.init(
        arcDAO.address,
        ultimateOwner,
        rewardToken.address,
        stakingTokenAddress,
        { value: rewardConfig.daoAllocation },
        { value: rewardConfig.slasherCut },
        coreContract.address,
        rewardConfig.vestingEndDate,
        rewardConfig.debtToStake,
        rewardConfig.hardCap,
      );
      console.log(green(`Called init() successfully!\n`));
    } catch (error) {
      console.log(red(`Failed to call init().\nReason: ${error}\n`));
    }

    if ((await signer.getChainId()) != 1) {
      console.log(yellow(`* Minting reward tokens and notifying rewards contract...`));
      const arcToken = ArcxTokenFactory.connect(rewardToken.address, signer);
      await arcToken.mint(proxyContract, ArcNumber.new(100));
      await implementation.notifyRewardAmount(ArcNumber.new(100));
      console.log(green(`Executed successfully!\n`));
    }
  });
