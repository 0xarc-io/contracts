// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Math} from "../lib/Math.sol";
import {Amount} from "../lib/Amount.sol";

library D2Types {

    /* ========== Structs ========== */

    struct Position {
        address owner;
        Amount.Principal collateralAmount;
        Amount.Principal borrowedAmount;
    }

}