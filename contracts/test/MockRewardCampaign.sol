// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import { RewardCampaign } from "../staking/RewardCampaign.sol";

contract MockRewardCampaign is RewardCampaign {

    uint256 private currentTimestamp;

    constructor(
        address _arcDAO,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken
    )
        public
        RewardCampaign(
            _arcDAO,
            _rewardsDistribution,
            _rewardsToken,
            _stakingToken
        )
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

}