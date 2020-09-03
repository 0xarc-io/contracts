// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StakingRewardAccrual} from "./StakingRewardAccrual.sol";

contract StakingRewardsAccrualCapped is StakingRewardAccrual {

    uint256 public hardCap;

    bool public tokensClaimable;

    mapping (address => bool) approvedKyfInstances;

    constructor(
        address _arcDAO,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken,
        address _feesToken
    )
        public
        StakingRewardAccrual(
            _arcDAO,
            _rewardsDistribution,
            _rewardsToken,
            _stakingToken,
            _feesToken
        )
    {

    }

    function setStakeHardCap(
        uint256 _hardCap
    )
        public
    {

    }

    function setApprovedKYFInstance(
        address _kyfContract,
        bool status
    )
        public
    {

    }

    function stake(
        uint256 _amount
    )
        public
    {

    }

    function getReward()
        public
    {

    }

    function setTokensClaimable(
        bool _enabled
    )
        public
    {

    }

}