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
import {
  BaseERC20Factory,
  ChainLinkOracleFactory,
  SapphireAssessorFactory,
  SapphireCoreV1,
  SapphireCoreV1Factory,
  TestTokenFactory,
} from '@src/typings';
import { DeploymentType } from '../deployments/types';
import { Filter, Log } from '@ethersproject/abstract-provider';
import axios from 'axios';
import { BASE } from '@src/constants';
import { PassportScoreProof } from '@arc-types/sapphireCore';

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

  const coreProxyAddress = '0x05efe26f4a75EA4d183e8a7922494d60adfB27b3';
  const core = SapphireCoreV1Factory.connect(coreProxyAddress, signer);
  const oracle = ChainLinkOracleFactory.connect(await core.oracle(), signer);
  const assessor = SapphireAssessorFactory.connect(
    await core.assessor(),
    signer,
  );

  const contractCreationBlock = 26815547;
  const currentPrice = (await oracle.fetchCurrentPrice())[0];
  const maxCRatio = await core.highCollateralRatio();
  const minCRatio = await core.lowCollateralRatio();
  const maxScore = await assessor.maxScore();
  const boundsDifference = maxCRatio.sub(minCRatio);

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
      maxCRatio,
      boundsDifference,
      maxScore,
      currentPrice,
      core,
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

async function getUserCreditScoreProof(addr: string) {
  const res = await axios.get(`https://api.arcx.money/v1/scores`, {
    params: {
      account: addr,
      protocol: 'arcx.credit',
      format: 'proof',
    },
  });

  return res.data.data[0] as PassportScoreProof;
}

async function checkLiquidatable(
  addr: string,
  maxCRatio: BigNumber,
  boundsDifference: BigNumber,
  maxScore: number,
  currentPrice: BigNumber,
  core: SapphireCoreV1,
) {
  const creditScoreProof = await getUserCreditScoreProof(addr);

  const creditScore = BigNumber.from(creditScoreProof.score);
  const assessedCRatio = maxCRatio.sub(
    creditScore.mul(boundsDifference).div(maxScore),
  );

  const vault = await core.vaults(addr);
  if (vault.normalizedBorrowedAmount.isZero()) {
    return {
      assessedCRatio: null,
      isLiquidatable: false,
    };
  }

  const denormalizedBorrowAmt = vault.normalizedBorrowedAmount
    .mul(await core.currentBorrowIndex())
    .div(BASE);
  const collateralValue = vault.collateralAmount.mul(currentPrice).div(BASE);
  const currentCRatio = collateralValue.mul(BASE).div(denormalizedBorrowAmt);

  const isCollateralized = currentCRatio.gt(assessedCRatio);

  console.log(
    `user ${addr} has an assessed c-ratio of ${utils.formatEther(
      assessedCRatio,
    )}. Current c-ratio: ${utils.formatEther(
      currentCRatio,
    )}. There is a gap of ${utils.formatEther(
      isCollateralized
        ? currentCRatio.sub(assessedCRatio)
        : assessedCRatio.sub(currentCRatio),
    )}`,
  );

  if (!isCollateralized) {
    console.log(`>>> vault ${addr} is subject to liquidation!`);
    console.log(
      `\t Collateral value: $${utils.formatEther(
        collateralValue,
      )} (${utils.formatEther(vault.collateralAmount)} ETH)`,
    );
    console.log(`\t Debt: $${utils.formatEther(denormalizedBorrowAmt)}`);
  }

  return {
    assessedCRatio,
    isLiquidatable: !isCollateralized,
    proof: creditScoreProof,
  };
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

  await usdc.approve(core.address, denormalizedBorrowAmt.div(usdcScalar));
  await core.liquidate(addr, usdcAddress, [proof]);

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
