import { PassportScoreProof } from '@arc-types/sapphireCore';
import { SapphireArc } from '@src/SapphireArc';
import axios from 'axios';
import { BigNumber, utils } from 'ethers';
import { BASE } from '../../src';

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
  arc: SapphireArc,
  proof?: PassportScoreProof,
) {
  const { core, assessor, oracle } = arc.getCoreContracts(
    arc.getCoreNames()[0],
  );

  const { price } = await oracle.fetchCurrentPrice();
  const maxScore = await assessor.maxScore();
  const maxCRatio = await core.highCollateralRatio();
  const minCRatio = await core.lowCollateralRatio();
  const boundsDifference = maxCRatio.sub(minCRatio);
  const creditScoreProof = proof ?? (await getUserCreditScoreProof(addr));

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

  const currentBorrowIndex = await core.currentBorrowIndex();
  const denormalizedBorrowAmt = vault.normalizedBorrowedAmount
    .mul(currentBorrowIndex)
    .div(BASE);
  const collateralValue = vault.collateralAmount.mul(price).div(BASE);
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

export { checkLiquidatable };
