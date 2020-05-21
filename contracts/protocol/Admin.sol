pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import {Types} from "../lib/Types.sol";

contract Admin {
    // ============ Functions ============

    function updateGlobalParams(
        Types.GlobalParams memory newGlobalParams
    ) public {}

    function updateGlobalMarket(
        address interestSetter
    ) public {}
}
