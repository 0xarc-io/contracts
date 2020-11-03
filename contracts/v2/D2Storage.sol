
// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Decimal} from "../lib/Decimal.sol";
import {Amount} from "../lib/Amount.sol";

import {IOracle} from "../interfaces/IOracle.sol";

import {D2Types} from "./D2Types.sol";

contract D2StorageV1 {

    bool public paused;

    mapping (uint256 => D2Types.Position) internal positions;

    IOracle internal oracle;

    address internal collateralAsset;
    address internal syntheticAsset;

    uint256 public positionCount;

    uint256 internal totalSupplied;
    uint256 internal totalBorrowed;

    uint256 internal borrowIndex;
    uint256 internal indexLastUpdate;
    uint256 internal interestRate;

    Decimal.D256 internal collateralRatio;

    Decimal.D256 public liquidationUserFee;
    Decimal.D256 public liquidationArcRatio;
    Decimal.D256 public printerArcRatio;

    address public printerDestination;
    address public interestSetter;

    uint256 internal collateralLimit;
    uint256 internal syntheticLimit;
    uint256 internal positionCollateralMinimum;
}

contract D2Storage is D2StorageV1 { /* solium-disable-line no-empty-blocks */ }