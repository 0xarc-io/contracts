import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { SapphireTestArc } from '@test/helpers/SapphireTestArc';
import { TestTokenFactory } from '@src/typings';
import {
  DEFAULT_COLLATERAL_DECIMALS,
  DEFAULT_STABLECOIN_DECIMALS,
} from './sapphireDefaults';
import { CREDIT_PROOF_PROTOCOL } from '@src/constants';
import { BigNumberish, utils } from 'ethers';
import { PassportScoreProof } from '@arc-types/sapphireTypes';
import { getEmptyScoreProof } from '@src/utils';

/**
 * Setup base **Sapphire** vault with 1000 collateral and 200 debt for a c-ratio of
 * 500%, if the collateral price is $1
 */
export async function setupBaseVault(
  arc: SapphireTestArc,
  caller: SignerWithAddress,
  borrowLimitProof: PassportScoreProof,
  collateralAmount = utils.parseUnits('1000', DEFAULT_COLLATERAL_DECIMALS),
  borrowAmount = utils.parseUnits('200', DEFAULT_STABLECOIN_DECIMALS),
  scoreProof?: PassportScoreProof,
  coreName?: string,
) {
  await mintApprovedCollateral(arc, caller, collateralAmount);

  const supportedBorrowAsset = (
    await arc.coreContracts().core.getSupportedBorrowAssets()
  )[0];
  // Open vault and mint debt
  await arc.depositAndBorrow(
    collateralAmount,
    borrowAmount,
    supportedBorrowAsset,
    scoreProof ??
      getEmptyScoreProof(
        undefined,
        utils.formatBytes32String(CREDIT_PROOF_PROTOCOL),
      ),
    borrowLimitProof,
    coreName,
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
