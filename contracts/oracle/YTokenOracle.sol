// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Decimal} from "../lib/Decimal.sol";
import {SafeMath} from "../lib/SafeMath.sol";

import {IERC20} from "../token/IERC20.sol";

import {IOracle} from "./IOracle.sol";
import {IYToken} from "./IYToken.sol";
import {IChainLinkAggregator} from "./IChainLinkAggregator.sol";

import {console} from "hardhat/console.sol";

contract YTokenOracle is IOracle {

    /* ========== Libraries ========== */

    using SafeMath for uint256;

    /* ========== Constants ========== */

    uint256 constant BASE = 10**18;

    /* ========== Variables ========== */

    address public yTokenAddress;

    IERC20 public underlyingToken;

    IChainLinkAggregator public underlyingChainLinkAggregator;
    IChainLinkAggregator public ethUSDChainLinkAggregator;

    uint256 public underlyingDecimals;
    uint256 public ethUsdDecimals;

    constructor(
        address _yTokenAddress,
        address _underlyingTokenAddress,
        address _underlyingChainLinkAggregator,
        address _ethUSDChainLinkAggregator
    )
        public
    {
        yTokenAddress = _yTokenAddress;
        underlyingToken = IERC20(_underlyingTokenAddress);
        underlyingChainLinkAggregator = IChainLinkAggregator(_underlyingChainLinkAggregator);
        ethUSDChainLinkAggregator = IChainLinkAggregator(_ethUSDChainLinkAggregator);

        underlyingDecimals = uint256(underlyingChainLinkAggregator.decimals());
        ethUsdDecimals = uint256(ethUSDChainLinkAggregator.decimals());
    }

    function fetchCurrentPrice()
        external
        view
        returns (Decimal.D256 memory)
    {
        // 1. Call getPricePerFullShare() on the yToken to determine how much
        //    of the underlying does this token have at the moment
        // 2. Get the ETH price of the underlying token by calling getLatestAnswer()
        // 3. Get the ETH/USD price by calling getLatestAnswer()
        // 4. Ensure that all 3 variables above are normalised to 18 decimal places
        // 5. Multiply to get your answer!

        uint256 amountOfUnderlying = IYToken(yTokenAddress).getPricePerFullShare();

        // The ETH price of the underlying token we're dealing with here and how many
        // decimals is this price reported in (so we can normalise)
        uint256 underlyingPrice = uint256(underlyingChainLinkAggregator.latestAnswer());
        uint256 normalisedUnderlyingPrice = underlyingPrice.mul(10 ** (18 - underlyingDecimals));

        // The price of ETH expressed in US Dollars and how many decimals the price
        // is reported in (so we can normalise)
        uint256 ethUsdPrice = uint256(ethUSDChainLinkAggregator.latestAnswer());
        uint256 normalisedEthUsdPrice = ethUsdPrice.mul(10 ** (18 - ethUsdDecimals));

        uint256 finalPrice = amountOfUnderlying.mul(normalisedEthUsdPrice).div(BASE);
        finalPrice = finalPrice.mul(normalisedUnderlyingPrice).div(BASE);

        require(
            finalPrice > 0,
            "YTokenOracle: cannot report a price of 0"
        );

        return Decimal.D256({
            value: finalPrice
        });

    }

}
