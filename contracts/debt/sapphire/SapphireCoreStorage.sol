// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {IOracle} from "../../oracle/IOracle.sol";

import {SapphireTypes} from "./SapphireTypes.sol";

contract SapphireCoreStorage {
    /**
     * @notice Determines whether the contract is paused or not
     */
    bool public paused;

    /**
     * @dev The details about a vault, identified by a unint256
     */
    mapping (address => SapphireTypes.Vault) public vaults;

    /**
    * @dev The high/default collateral ratio for an untrusted borrower.
    */
    uint256 public highCollateralRatio;

    /**
    * @dev The lowest collateral ratio for an untrusted borrower.
    */
    uint256 public lowCollateralRatio;

    /**
     * @dev How much should the liquidation penalty be, expressed as a decimal.
     */
    uint256 public liquidationUserFee;

    /**
     * @dev How much of the profit acquired from a liquidation should ARC receive
     */
    uint256 public liquidationArcFee;

    /**
    * @dev The assesor that will determine the collateral-ratio.
    */
    address public collateralRatioAssessor;

    /**
    * @dev The address which collects fees when liquidations occur.
    */
    address public feeCollector;

    /**
     * @dev The instance of the oracle that reports prices for the collateral
     */
    IOracle public oracle;

    /**
     * @dev If a collateral asset is used that has less than 18 decimal places
     *      a precision scalar is required to calcualte the corect values.
     */
    uint256 public precisionScalar;

    /**
     * @dev The actual address of the collateral used for this core system.
     */
    address public collateralAsset;

    /**
     * @dev The address of the synthetic token where this core is approved to mint from
     */
    address public syntheticAsset;

    /**
    * @dev The actual amount of collatteral provided to the protocol.
    *      This amount will be multiplied by the precision scalar if the token
    *      has less than 18 decimals precision.
    */
    uint256 public totalCollateral;

    /**
     * @dev An account of the total amount being borrowed by all depositors. This includes
     *      the amount of interest accrued.
     */
    uint256 public totalBorrowed;

    /**
     * @dev The accumulated borrow index. Each time a borrows, their borrow amount is expressed
     *      in relation to the borrow index.
     */
    uint256 public borrowIndex;

    /**
     * @dev The last time the updateIndex() function was called. This helps to determine how much
     *      interest has accrued in the contract since a user interacted with the protocol.
     */
    uint256 public indexLastUpdate;

    /**
     * @notice Which address can set interest rates for this contract
     */
    address public interestSetter;

     /**
     * @dev The limit of how much collateral can be deposited from this contract.
     */
    uint256 public collateralLimit;

    /**
     * @dev The maximum amount which can be borrowed within a contract. This includes
     *      the amount of interest accrued.
     */
    uint256 public totalBorrowLimit;

    /**
     * @dev The minimum amount which has to be borrowed by a vault. This includes
     *      the amount of interest accrued.
     */
    uint256 public vaultBorrowMinimum;

    /**
     * @dev The maximum amount which has to be borrowed by a vault. This includes
     *      the amount of interest accrued.
     */
    uint256 public vaultBorrowMaximum;

}
