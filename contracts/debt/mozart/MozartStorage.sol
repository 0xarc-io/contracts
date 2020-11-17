// SPDX-License-Identifier: MIT


// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {IOracle} from "../../oracle/IOracle.sol";

import {Decimal} from "../../lib/Decimal.sol";
import {Amount} from "../../lib/Amount.sol";

import {MozartTypes} from "./MozartTypes.sol";

contract MozartStorageV1 {

    bool public paused;

    mapping (uint256 => MozartTypes.Position) internal positions;

    mapping (uint256 => mapping (address => bool)) internal positionOperators;

    mapping (address => bool) internal globalOperators;

    IOracle internal oracle;

    address internal collateralAsset;
    address internal syntheticAsset;

    uint256 public positionCount;

    // The total amount of collateral supplied by this contract
    uint256 internal totalSupplied;

    // The total amount owed to the system (grows in real time)
    uint256 internal totalBorrowed;

    uint256 internal borrowIndex;
    uint256 internal indexLastUpdate;
    uint256 internal interestRate;

    Decimal.D256 internal collateralRatio;
    Decimal.D256 internal liquidationUserFee;
    Decimal.D256 internal liquidationArcRatio;

    address public interestSetter;

    uint256 internal collateralLimit;
    uint256 internal positionCollateralMinimum;
}

contract MozartStorage is MozartStorageV1 { /* solium-disable-line no-empty-blocks */ }
