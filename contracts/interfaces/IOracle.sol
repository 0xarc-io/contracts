pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {Decimal} from "../lib/Decimal.sol";

interface IOracle {

    function fetchCurrentPrice()
        external
        view
        returns (Decimal.D256 memory);

}