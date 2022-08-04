import { IERC20Factory } from '@src/typings/IERC20Factory';
import { IMintableTokenFactory } from '@src/typings/IMintableTokenFactory';
import { green, yellow } from 'chalk';
import {
  deployContract,
  loadDetails,
  pruneDeployments,
} from '../deployments/src';
import { BigNumber, utils } from 'ethers';
import { task } from 'hardhat/config';
import { DeploymentType } from '../deployments/types';
import {
  BaseERC20Factory,
  SapphireCoreV1,
  SapphireCoreV1Factory,
  TestTokenFactory,
} from '@src/typings';
import { Filter, Log } from '@ethersproject/abstract-provider';
import { BASE } from '@src/constants';
import { approve } from '@src/utils';
import { SapphireArc } from '@src/SapphireArc';
import { checkLiquidatable } from './utils/checkLiquidatable';
import { PassportScoreProof } from '@arc-types/sapphireTypes';

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

task('liquidate-borrowers').setAction(async (taskArgs, hre) => {
  const { signer } = await loadDetails(hre);
  const arc = SapphireArc.new(signer);
  const coreProxyAddress = '0x05efe26f4a75EA4d183e8a7922494d60adfB27b3';
  await arc.addCores({ sapphireCore: coreProxyAddress });

  const core = SapphireCoreV1Factory.connect(coreProxyAddress, signer);

  const contractCreationBlock = 26815547;

  const borrowLogFilter: Filter = {
    address: coreProxyAddress,
    topics: core.filters.Borrowed(null, null, null, null, null, null).topics,
    toBlock: 'latest',
    fromBlock: contractCreationBlock,
  };
  const logs = await signer.provider.getLogs(borrowLogFilter);

  const borrowers: string[] = getBorrowers(logs);

  for (const addr of borrowers) {
    const { assessedCRatio, isLiquidatable, proof } = await checkLiquidatable(
      addr,
      arc,
    );

    if (isLiquidatable) {
      console.log(
        `>>> User ${addr} can be liquidated! Their assessed c-ratio is ${utils.formatEther(
          assessedCRatio,
        )}\nStarting liquidation...`,
      );

      await liquidate(addr, core, proof);

      console.log(green('>>> Liquidation complete!'));
    }
  }
});

function getBorrowers(logs: Log[]): string[] {
  const borrowersFromAllTxs = logs.map((log) =>
    utils.hexStripZeros(log.topics[1]),
  );
  const uniqueBorrowers = borrowersFromAllTxs.filter(
    (addr, index, self) => self.indexOf(addr) === index,
  );

  return uniqueBorrowers;
}

async function liquidate(
  addr: string,
  core: SapphireCoreV1,
  proof: PassportScoreProof,
) {
  const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const usdc = BaseERC20Factory.connect(usdcAddress, core.signer);
  const usdcScalar = BigNumber.from(10 ** (18 - (await usdc.decimals())));
  const borrowIndex = await core.currentBorrowIndex();

  const preLiquidationVault = await core.vaults(addr);
  const denormalizedBorrowAmt = preLiquidationVault.normalizedBorrowedAmount
    .mul(borrowIndex)
    .div(BASE);
  console.log(`Before liquidation:`);
  console.log(
    `\t Collateral: ${utils.formatEther(
      preLiquidationVault.collateralAmount,
    )} ETH`,
  );
  console.log(`\t Debt: $${utils.formatEther(denormalizedBorrowAmt)}`);

  await approve(
    denormalizedBorrowAmt.add(BASE).div(usdcScalar), // +1 $ to account for ongoing interest
    usdc.address,
    core.address,
    core.signer,
  );
  const tx = await core.liquidate(addr, usdcAddress, [proof]);
  const receipt = await tx.wait();
  console.log(green(`>>> Liquidation transaction: ${receipt.transactionHash}`));

  const postLiquidationVault = await core.vaults(addr);
  console.log(`After liquidation:`);
  console.log(
    `\t Collateral: ${utils.formatEther(
      postLiquidationVault.collateralAmount,
    )} ETH`,
  );
  console.log(
    `\t Debt: $${utils.formatEther(
      postLiquidationVault.normalizedBorrowedAmount.mul(borrowIndex),
    )}`,
  );
}
