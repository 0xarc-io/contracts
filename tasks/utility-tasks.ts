import { IERC20Factory } from '@src/typings/IERC20Factory';
import { IMintableTokenFactory } from '@src/typings/IMintableTokenFactory';
import { green, yellow } from 'chalk';
import {
  deployContract,
  loadDetails,
  pruneDeployments,
} from '../deployments/src';
import { utils } from 'ethers';
import { task } from 'hardhat/config';
import { TestTokenFactory } from '@src/typings';
import { DeploymentType } from '@deployments/types';

task('mint-tokens')
  .addParam('token', 'The address of the token to mint from')
  .addParam('to', 'The receiver of the tokens')
  .addParam('amount', 'The amount of tokens, in reduced format (10^18)')
  .setAction(async (taskArgs, hre) => {
    const tokenAddress = taskArgs['token'];
    const receiver = taskArgs['to'];
    const amount = taskArgs['amount'];

    const { signer } = await loadDetails(hre);

    const token = IMintableTokenFactory.connect(tokenAddress, signer);

    // mint to deployer
    console.log(
      yellow(
        `Minting ${amount}*10^18 of ${tokenAddress} tokens to ${receiver}...`,
      ),
    );
    const tx = await token.mint(receiver, utils.parseEther(amount));
    console.log(yellow(`tx hash: ${tx.hash}`));

    await tx.wait();

    console.log(green(`tx completed`));
  });

/**
 * Useful to approve tokens on Rinkeby when a token contract was not
 * verified on Etherscan. For example, approving DAI to apply to
 * a waitlist batch
 */
task('approve-tokens')
  .addParam('token', 'The address of the token')
  .addParam('spender', 'The address of the spender')
  .addParam('amount', 'The amount to approve, in ether form')
  .setAction(async (taskArgs, hre) => {
    const { token, spender, amount } = taskArgs;

    const { signer } = await loadDetails(hre);

    const erc20 = IERC20Factory.connect(token, signer);

    console.log(yellow(`Approving token...`));
    const tx = await erc20.approve(spender, utils.parseEther(amount));
    await tx.wait();
    console.log(green(`Token approved!`));
  });

task('deploy-test-erc20', 'Deploys an ERC20 test token with 18 decimals')
  .addParam('name')
  .addParam('symbol')
  .setAction(async (taskArgs, hre) => {
    const { name, symbol } = taskArgs;

    const { network, signer, networkConfig } = await loadDetails(hre);

    await pruneDeployments(network, signer.provider);

    const erc20Addy = await deployContract(
      {
        name,
        source: 'TestToken',
        data: new TestTokenFactory(signer).getDeployTransaction(
          name,
          symbol,
          18,
        ),
        version: 1,
        type: DeploymentType.global,
      },
      networkConfig,
    );

    console.log(
      green(`TestToken ${name} successfully deployed at ${erc20Addy}`),
    );

    console.log(yellow('Verifying contract...'));
    await hre.run('verify:verify', {
      address: erc20Addy,
      constructorArguments: [name, symbol, 18],
    });
  });
