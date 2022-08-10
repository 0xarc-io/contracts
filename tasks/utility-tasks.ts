import { green } from 'chalk';
import { BigNumber, utils } from 'ethers';
import { task } from 'hardhat/config';
import {
  BaseERC20Factory,
  SapphireCoreV1,
  SapphireCoreV1Factory,
} from '@src/typings';
import { Filter, Log } from '@ethersproject/abstract-provider';
import { BASE } from '@src/constants';
import { approve } from '@src/utils';
import { SapphireArc } from '@src/SapphireArc';
import { checkLiquidatable } from './utils/checkLiquidatable';
import { PassportScoreProof } from '@arc-types/sapphireTypes';
import { loadHardhatDetails } from './utils/loadHardhatDetails';

task('liquidate-borrowers').setAction(async (taskArgs, hre) => {
  const { signer } = await loadHardhatDetails(hre);
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
