// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Decimal} from "../lib/Decimal.sol";
import {SafeMath} from "../lib/SafeMath.sol";

import {IOracle} from "../oracle/IOracle.sol";
import {IChainLinkAggregator} from "../oracle/IChainLinkAggregator.sol";

contract YUSDOracle is IOracle {

    uint256 constant BASE = 10**18;

    IRiskOracle public aaveRiskOracle;

    address public yUSDAddress;

    constructor()
        public
    {
        yUSDAddress = 0x5dbcf33d8c2e976c6b560249878e6f1491bca25c;
        aaveRiskOracle = IRiskOracle(0x4CC91E0c97c5128247E71a5DdF01CA46f4fa8d1d);
    }

    function fetchCurrentPrice()
        external
        view
        returns (Decimal.D256 memory)
    {
        uint256 yUSDPricePerFullShare = IYToken(yUSDAddress).getPricePerFullShare();
        uint256 priceOfYPoolToken = aaveRiskOracle.latestAnswer();
        uint256 result = yUSDPricePerFullShare.mul(priceOfYPoolToken).div(BASE);

        require(
            result > 0,
            "YUSDOracle: cannot report a price of 0"
        );

        return Decimal.D256({
            value: result
        });
    }

}
