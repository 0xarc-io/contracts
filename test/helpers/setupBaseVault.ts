import { CreditScoreProof } from '@arc-types/sapphireCore';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { SapphireTestArc } from '@src/SapphireTestArc';
import { TestTokenFactory } from '@src/typings';
import { utils } from 'ethers';
import { DEFAULT_COLLATERAL_DECIMALS } from './sapphireDefaults';

/**
 * Setup base **Sapphire** vault with 1000 collateral and 200 debt for a c-ratio of
 * 500%, if the collateral price is $1
 */
export async function setupBaseVault(
  arc: SapphireTestArc,
  caller: SignerWithAddress,
  collateralAmt = utils.parseUnits('1000', DEFAULT_COLLATERAL_DECIMALS),
  borrowAmt = utils.parseEther('200'),
  scoreProof?: CreditScoreProof,
  synthName?: string,
) {
  const collateralContract = TestTokenFactory.connect(arc.collateral().address, caller);

  await collateralContract.mintShare(caller.address, collateralAmt);
  await collateralContract.approve(arc.core().address, collateralAmt);

  // Open vault and mint debt
  return arc.open(collateralAmt, borrowAmt, scoreProof, synthName, caller);
}
