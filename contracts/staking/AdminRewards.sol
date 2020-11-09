// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {IERC20} from "../interfaces/IERC20.sol";
import {Ownable} from "../lib/Ownable.sol";
import {SafeMath} from "../lib/SafeMath.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";

contract AdminRewards is Ownable {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* ========== State Variables ========== */

    IERC20 public rewardsToken;

    address public arcDAO;

    bool public tokensClaimable;

    mapping(address => uint256) private rewards;

    uint256 public periodFinish = 1600591962;
    uint256 public rewardRate = 0;
    uint256 public rewardsDuration = 0;
    uint256 public lastUpdateTime = 0;
    uint256 public rewardPerTokenStored = 0;

    event ClaimableStatusUpdated(bool _status);
    event RewardPaid(address indexed user, uint256 reward);

    /* ========== Constructor ========== */

    constructor(
        address _arcDAO,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken,
        address _feesToken
    )
        public
    {
        arcDAO = _arcDAO;
        rewardsToken = IERC20(_rewardsToken);
    }

    function totalSupply()
        public
        pure
        returns (uint256)
    {
        return 0;
    }

    /* ========== View Functions ========== */

    function balanceOf(
        address
    )
        public
        pure
        returns (uint256)
    {
        return 0;
    }

    function lastTimeRewardApplicable()
        public
        view
        returns (uint256)
    {
        return periodFinish;
    }

    function actualRewardPerToken()
        internal
        pure
        returns (uint256)
    {
        return 0;
    }

    function rewardPerToken()
        public
        pure
        returns (uint256)
    {
        return 0;
    }

    function earned(
        address account
    )
        public
        view
        returns (uint256)
    {
        return rewards[account].mul(2).div(3);
    }

    function getRewardForDuration()
        public
        pure
        returns (uint256)
    {
        return 0;
    }

    function getUserBalance(
        address owner
    )
        public
        pure
        returns (uint256)
    {
        return balanceOf(owner);
    }

    function getTotalBalance()
        public
        pure
        returns (uint256)
    {
        return totalSupply();
    }

    /* ========== Admin Functions ========== */

    function setTokensClaimable(
        bool _enabled
    )
        public
        onlyOwner
    {
        tokensClaimable = _enabled;

        emit ClaimableStatusUpdated(_enabled);
    }

    function setRewards(
        address[] memory users,
        uint256[] memory amounts
    )
        public
        onlyOwner
    {
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            uint256 amount = amounts[i];

            rewards[user] = amount;
        }
    }

    /* ========== Mutative Functions ========== */

    function stake(
        uint256 amount
    )
        public
    { /* solium-disable-line no-empty-blocks */ }

    function withdraw(
        uint256 amount
    )
        public
    { /* solium-disable-line no-empty-blocks */ }

    function getReward()
        public
    {
        require(
            tokensClaimable == true,
            "Tokens cannnot be claimed yet"
        );

        uint256 reward = rewards[msg.sender];

        if (reward > 0) {
            rewards[msg.sender] = 0;

            rewardsToken.safeTransfer(msg.sender, reward.mul(2).div(3));
            rewardsToken.safeTransfer(arcDAO, reward.sub(reward.mul(2).div(3)));

            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit()
        external
    {
        getReward();
    }

}
