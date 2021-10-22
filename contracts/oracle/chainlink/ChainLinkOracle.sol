// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {Decimal} from "../../lib/Decimal.sol";
import {SafeMath} from "../../lib/SafeMath.sol";

import {ISapphireOracle} from "../ISapphireOracle.sol";
import {AggregatorV3Interface} from "./AggregatorV3Interface.sol";

contract ChainLinkOracle is ISapphireOracle {

    using SafeMath for uint256;

    AggregatorV3Interface public priceFeed;

    uint256 public decimals;

    constructor(address _priceFeed) public {
        priceFeed = AggregatorV3Interface(_priceFeed);
        decimals = priceFeed.decimals();
    }

    function fetchCurrentPrice()
        external
        override
        view
        returns (uint256, uint256)
    {
        (, int256 price, , uint256 timestamp, ) = priceFeed.latestRoundData();

        require(
            price > 0,
            "ChainLinkOracle: price was invalid"
        );

        return (
            uint256(price),
            timestamp
        );
    }

}
