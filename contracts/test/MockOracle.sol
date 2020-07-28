// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Decimal} from "../lib/Decimal.sol";
import {IOracle} from "../interfaces/IOracle.sol";

contract MockOracle is IOracle {

    // Priced at $10.00 (18 d.p)
    Decimal.D256 public CURRENT_PRICE = Decimal.D256({ value: 10**19 });

    function setPrice(Decimal.D256 memory price) public {
        CURRENT_PRICE = price;
    }

    function fetchCurrentPrice()
        external
        view
        returns (Decimal.D256 memory)
    {
        return CURRENT_PRICE;
    }

}