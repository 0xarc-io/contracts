// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import { ArcxRedemption } from "../token/ArcxRedemption.sol";
import { MockTimestamp } from "./MockTimestamp.sol";

contract MockArcxRedemption is ArcxRedemption, MockTimestamp {

    constructor(
        address _usdcAddress,
        address _arcxAddress,
        uint256 _exchangeRate,
        uint256 _cutoffDate
    ) 
        ArcxRedemption(
            _usdcAddress,
            _arcxAddress,
            _exchangeRate,
            _cutoffDate
        )
    { }

    function currentTimestamp()
        public
        view
        override(ArcxRedemption, MockTimestamp)
        returns (uint256)
    {
        return MockTimestamp.currentTimestamp();
    }

}
