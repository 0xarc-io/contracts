// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {Decimal} from "../lib/Decimal.sol";
import {ISapphireOracle} from "../oracle/ISapphireOracle.sol";

contract MockSapphireOracle is ISapphireOracle {

    // Priced at $10.00 (18 d.p)
    uint256 public currentPrice = 10 ** 19;

    uint256 public mockTimestamp = 0;

    function fetchCurrentPrice()
        external
        view
        returns (uint256 price, uint256 timestamp)
    {
        price = currentPrice;
        timestamp = mockTimestamp;
    }

    function setPrice(
        uint256 _price
    )
        public 
    {
        currentPrice = _price;
    }

    function setTimestamp(
        uint256 timestamp
    )
        public
    {
        mockTimestamp = timestamp;
    }

}
