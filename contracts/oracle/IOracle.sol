// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {Decimal} from "../lib/Decimal.sol";

interface IOracle {

    function fetchCurrentPrice()
        external
        view
        returns (Decimal.D256 memory);

}
