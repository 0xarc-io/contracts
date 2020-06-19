pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {Decimal} from "../lib/Decimal.sol";
import {IOracle} from "../interfaces/IOracle.sol";

contract MockOracle is IOracle {

    // Priced at $100.00 (18 d.p)
    Decimal.D256 public CURRENT_PRICE = Decimal.D256({ value: 10**19 });

    function setPrice(Decimal.D256 memory price) public {
        CURRENT_PRICE = price;
    }

    function fetchCurrentPrice()
        external
        override
        view
        returns (Decimal.D256 memory)
    {
        return CURRENT_PRICE;
    }

}