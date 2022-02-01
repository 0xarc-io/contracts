import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { TestTokenFactory } from '@src/typings';
import {
  DEFAULT_COLLATERAL_DECIMALS,
  DEFAULT_PROOF_PROTOCOL,
} from './sapphireDefaults';
import { BigNumberish, utils } from 'ethers';
import { PassportScoreProof } from '@arc-types/sapphireCore';
import { getEmptyScoreProof } from '@src/utils';

/**
 * Setup base **Sapphire** vault with 1000 collateral and 200 debt for a c-ratio of
 * 500%, if the collateral price is $1
 */
export async function setupBaseVault(
  arc: SapphireTestArc,
  caller: SignerWithAddress,
  collateralAmount = utils.parseUnits('1000', DEFAULT_COLLATERAL_DECIMALS),
  borrowAmount = utils.parseEther('200'),
  scoreProof?: PassportScoreProof,
  synthName?: string,
) {
  await mintApprovedCollateral(arc, caller, collateralAmount);

  // Open vault and mint debt
  await arc.open(
    collateralAmount,
    borrowAmount,
    arc.syntheticAddress(),
    scoreProof ??
      getEmptyScoreProof(
        undefined,
        utils.formatBytes32String(DEFAULT_PROOF_PROTOCOL),
      ),
    synthName,
    caller,
  );
}

export async function mintApprovedCollateral(
  arc: SapphireTestArc,
  caller: SignerWithAddress,
  collateralAmount: BigNumberish,
) {
  const collateralContract = TestTokenFactory.connect(
    arc.collateral().address,
    caller,
  );

  await collateralContract.mintShare(caller.address, collateralAmount);
  await collateralContract.approve(arc.core().address, collateralAmount);
}
