// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import { StakingRewardsAccrualCapped } from "../staking/StakingRewardsAccrualCapped.sol";

contract MockStakingRewardsAccrualCapped is StakingRewardsAccrualCapped {

    uint256 private currentTimestamp;

    constructor(
        address _arcDAO,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken,
        address _feesToken
    )
        public
        StakingRewardsAccrualCapped(
            _arcDAO,
            _rewardsDistribution,
            _rewardsToken,
            _stakingToken,
            _feesToken
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