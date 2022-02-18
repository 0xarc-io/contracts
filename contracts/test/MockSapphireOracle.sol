// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {Decimal} from "../lib/Decimal.sol";
import {ISapphireOracle} from "../oracle/ISapphireOracle.sol";

contract MockSapphireOracle is ISapphireOracle {

    // Priced at $10.00 (18 d.p)
    uint256 public currentPrice = 10 ** 19;

    uint256 public mockTimestamp = 0;
    bool public reportRealTimestamp = false;

    function fetchCurrentPrice()
        external
        override
        view
        returns (uint256 price, uint256 timestamp)
    {
        price = currentPrice;

        if (reportRealTimestamp) {
            timestamp = block.timestamp;
        } else {
            timestamp = mockTimestamp;
        }
    }

    function setPrice(
        uint256 _price
    )
        external
    {
        currentPrice = _price;
    }

    function setTimestamp(
        uint256 timestamp
    )
        external
    {
        mockTimestamp = timestamp;
    }

    function setReportRealTimestamp(
        bool _reportRealTimestamp
    )
        external
    {
        reportRealTimestamp = _reportRealTimestamp;
    }
}
