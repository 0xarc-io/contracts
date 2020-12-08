// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {IOracle} from "../../oracle/IOracle.sol";

import {Decimal} from "../../lib/Decimal.sol";
import {Amount} from "../../lib/Amount.sol";

import {MozartTypes} from "./MozartTypes.sol";

/**
 * @title MoazartStorage
 * @author Kerman Kohli
 * @notice The storage contract that gets used inside MozartV1.
 *         IMPORTANT:
 *         - DO NOT change the order of ANY variables
 *         - If you would like to add more variables, create a a new
 *           versioned contract (MozartStorageV99) and inherit from
 *           it via MozartStorage
 */
contract MozartStorageV1 {

    /**
     * @notice Determines whether the contract is paused or not
     */
    bool public paused;

    /**
     * @notice An active counter oall the number of positions in the protocol
     */
    uint256 public positionCount;

    /**
     * @dev The details about a vault, identified by a unint256
     */
    mapping (uint256 => MozartTypes.Position) internal positions;

    /**
     * @dev Allow a position have multiple addresses act on it's behalf
     */
    mapping (uint256 => mapping (address => bool)) internal positionOperators;

    /**
     * @dev Allow an address to act on behalf of any position.
     */
    mapping (address => bool) internal globalOperators;

    /**
     * @notice The instance of the oracle that reports prices for this synth
     */
    IOracle public oracle;

    /**
     * @notice If a colalteral asset is used that has less than 18 decimal places
     *      a precision scalar is required to calcualte the corect values.
     */
    uint256 public precisionScalar;

    /**
     * @notice The actual address of the collateral used for this core system.
     */
    address public collateralAsset;

    /**
     * @notice The address of the synthetic token where this core is approved to mint from
     */
    address public syntheticAsset;

    /**
     * @notice The actual amount of collateral provided to the protocol. This amount
     *      will be multiplied by the precision scalar if the token has less than 18 d.p
     */
    uint256 public totalSupplied;

    /**
     * @notice An account of the total amount being borrowed by all depositors. This includes
     *      the amount of interest accrued.
     */
    uint256 public totalBorrowed;

    /**
     * @notice The accumulated borrow index. Each time a borrows, their borrow amount is expressed
     *      in relation to the borrow index.
     */
    uint256 public borrowIndex;

    /**
     * @notice The last time the updateIndex() function was called. This helps to determine how much
     *      interest has accrued in the contract since a user interacted with the protocol.
     */
    uint256 public indexLastUpdate;

    /**
     * @notice The interest rate charged to borrowers. Expressed as the interest rate per second and 18 d.p
     */
    uint256 public interestRate;

    /**
     * @notice The ratio of how much collateral should have relative to it's debt
     */
    Decimal.D256 public collateralRatio;

    /**
     * @notice How much should the liquidation penalty be, expressed as a decimal.
     */
    Decimal.D256 public liquidationUserFee;

    /**
     * @notice How much of the profit acquired from a liquidation should ARC receive
     */
    Decimal.D256 public liquidationArcRatio;

    /**
     * @notice Which address can set interest rates for this contract
     */
    address public interestSetter;

    /**
     * @notice The limit of how much collateral can be deposited from this contract.
     */
    uint256 public collateralLimit;

    /**
     * @notice The amount of collateral a new position should hvae at the minimum
     */
    uint256 public positionCollateralMinimum;
}

contract MozartStorage is MozartStorageV1 { /* solium-disable-line no-empty-blocks */ }
