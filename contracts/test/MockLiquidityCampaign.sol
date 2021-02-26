// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import { LiquidityCampaign } from "../staking/LiquidityCampaign.sol";

contract MockLiquidityCampaign is LiquidityCampaign {

    uint256 private currentTimestamp;

    constructor()
        public
        LiquidityCampaign()
    { }

    function setCurrentTimestamp(uint256 _timestamp)
        public
    {
        currentTimestamp = _timestamp;
    }

    function getCurrentTimestamp()
        public
        view
        returns (uint256)
    {
        return currentTimestamp;
    }

    function actualEarned(
        address _account
    )
        public
        view
        returns (uint256)
    {
        return _actualEarned(_account);
    }

}
