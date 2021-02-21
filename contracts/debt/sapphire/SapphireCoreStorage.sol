// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

contract SapphireCoreStorage {

  /**
   * @dev The high/default collateral ratio for an untrusted borrower.
   */
  uint256 internal highCollateralRatio;

  /**
   * @dev The lowest collateral ratio for an untrusted borrower.
   */
  uint256 internal lowCollateralRatio;

  /**
   * @dev The assesor that will determine the collateral-ratio.
   */
  address internal collateralRatioAssesor;

  /**
   * @dev The strategy for this particular vault instance.
   */
   address internal strategyAddress;

   /**
   * @dev The address which collects fees when liquidations occur.
   */
   address internal feeCollector;

}
