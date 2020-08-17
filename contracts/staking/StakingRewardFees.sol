// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StakingRewards} from "./StakingRewards.sol";
import {TokenAccrual} from "./TokenAccrual.sol";

contract StakingRewardFees is StakingRewards, TokenAccrual {

    constructor(
        address _owner,
        address _arcDAO,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken,
        address _feesToken
    )
        public
        StakingRewards(
            _owner,
            _arcDAO,
            _rewardsDistribution,
            _rewardsToken,
            _stakingToken
        )
        TokenAccrual(
            _feesToken
        )
    {}

}