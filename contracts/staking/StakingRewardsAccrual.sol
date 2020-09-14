// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StakingRewards} from "./StakingRewards.sol";
import {Accrual} from "./Accrual.sol";

contract StakingRewardsAccrual is StakingRewards, Accrual {

    constructor(
        address _arcDAO,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken,
        address _feesToken
    )
        public
        StakingRewards(
            _arcDAO,
            _rewardsDistribution,
            _rewardsToken,
            _stakingToken
        )
        Accrual(
            _feesToken
        )
    {}

    function getUserBalance(
        address owner
    )
        public
        view
        returns (uint256)
    {
        return balanceOf(owner);
    }

    function getTotalBalance()
        public
        view
        returns (uint256)
    {
        return totalSupply();
    }

    function stake(
        uint256 amount
    )
        external
        updateReward(msg.sender)
    {
        _stake(amount);
    }

    function withdraw(
        uint256 amount
    )
        external
        updateReward(msg.sender)
    {
        _withdraw(amount);
    }

    function getReward()
        external
        updateReward(msg.sender)
    {
        _getReward();
    }

    function exit()
        external
        updateReward(msg.sender)
    {
        _exit();
    }

}