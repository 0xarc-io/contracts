
// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Decimal} from "../lib/Decimal.sol";
import {Amount} from "../lib/Amount.sol";

import {IOracle} from "../interfaces/IOracle.sol";

import {D2Types} from "./D2Types.sol";

contract D2StorageV1 {

    bool public paused;

    mapping (uint256 => D2Types.Position) public positions;

    IOracle public oracle;

    address public collateralAsset;
    address public syntheticAsset;

    uint256 public positionCount;

    uint256 public totalSupplied;
    uint256 public totalBorrowed;

    uint256 public borrowIndex;
    uint256 public indexLastUpdate;

    Decimal.D256 collateralRatio;
    Decimal.D256 liquidationUserFee;
    Decimal.D256 liquidationArcFee;

    uint256 collateralLimit;
    uint256 syntheticLimit;
    uint256 positionCollateralMinimum;

}

contract D2Storage is D2StorageV1 { }