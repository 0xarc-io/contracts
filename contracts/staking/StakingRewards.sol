// SPDX-License-Identifier: MIT
// Copied directly from https://github.com/Synthetixio/synthetix/blob/v2.26.3/contracts/StakingRewards.sol

pragma solidity ^0.5.16;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/ownership/Ownable.sol";

contract StakingRewards is Ownable {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20 public rewardsToken;
    IERC20 public stakingToken;

    address public arcDAO;
    address public rewardsDistribution;

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public rewardsDuration = 7 days;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address token, uint256 amount);

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        rewardPerTokenStored = actualRewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();

        if (account != address(0)) {
            rewards[account] = actualEarned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    modifier onlyRewardsDistribution() {
        require(
            msg.sender == rewardsDistribution,
            "Caller is not RewardsDistribution contract"
        );
        _;
    }

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _arcDAO,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken
    )
        public
    {
        arcDAO = _arcDAO;
        rewardsToken = IERC20(_rewardsToken);
        stakingToken = IERC20(_stakingToken);
        rewardsDistribution = _rewardsDistribution;
    }

    /* ========== VIEWS ========== */

    function totalSupply()
        public
        view
        returns (uint256)
    {
        return _totalSupply;
    }

    function balanceOf(
        address account
    )
        public
        view
        returns (uint256)
    {
        return _balances[account];
    }

    function lastTimeRewardApplicable()
        public
        view
        returns (uint256)
    {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function actualRewardPerToken()
        internal
        view
        returns (uint256)
    {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable()
                    .sub(lastUpdateTime)
                    .mul(rewardRate)
                    .mul(1e18)
                    .div(_totalSupply)
            );
    }

    function rewardPerToken()
        public
        view
        returns (uint256)
    {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable()
                    .sub(lastUpdateTime)
                    .mul(rewardRate)
                    .mul(1e18)
                    .div(_totalSupply)
                    .mul(2)
                    .div(3)
            );
    }

    function actualEarned(
        address account
    )
        internal
        view
        returns (uint256)
    {
        return _balances[account]
            .mul(actualRewardPerToken().sub(userRewardPerTokenPaid[account]))
            .div(1e18)
            .add(rewards[account]);
    }

    function earned(
        address account
    )
        public
        view
        returns (uint256)
    {
        return _balances[account]
            .mul(actualRewardPerToken().sub(userRewardPerTokenPaid[account]))
            .div(1e18)
            .add(rewards[account])
            .mul(2)
            .div(3);
    }

    function getRewardForDuration()
        public
        view
        returns (uint256)
    {
        return rewardRate.mul(rewardsDuration);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function _stake(
        uint256 amount
    )
        internal
    {
        require(
            amount > 0,
            "Cannot stake 0"
        );

        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount);
    }

    function _withdraw(
        uint256 amount
    )
        internal
    {
        require(
            amount > 0,
            "Cannot withdraw 0"
        );

        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);

        stakingToken.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    function _getReward(address user)
        internal
    {
        uint256 reward = rewards[user];

        if (reward > 0) {
            rewards[user] = 0;

            rewardsToken.safeTransfer(user, reward.mul(2).div(3));
            rewardsToken.safeTransfer(arcDAO, reward.sub(reward.mul(2).div(3)));

            emit RewardPaid(user, reward);
        }
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function notifyRewardAmount(
        uint256 reward
    )
        external
        onlyRewardsDistribution
        updateReward(address(0))
    {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward.div(rewardsDuration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = reward.add(leftover).div(rewardsDuration);
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balance = rewardsToken.balanceOf(address(this));
        require(
            rewardRate <= balance.div(rewardsDuration),
            "Provided reward too high"
        );

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);
        emit RewardAdded(reward);
    }

    // Added to support recovering LP Rewards from other systems to be distributed to holders
    function recoverERC20(
        address tokenAddress,
        uint256 tokenAmount
    )
        public
        onlyOwner
    {
        // Cannot recover the staking token or the rewards token
        require(
            tokenAddress != address(stakingToken) && tokenAddress != address(rewardsToken),
            "Cannot withdraw the staking or rewards tokens"
        );

        IERC20(tokenAddress).safeTransfer(owner(), tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    function setRewardsDuration(
        uint256 _rewardsDuration
    )
        external
        onlyOwner
    {
        require(
            periodFinish == 0 || block.timestamp > periodFinish,
            "Prev period must be complete before changing duration for new period"
        );
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }

    function setRewardsDistribution(
        address _rewardsDistribution
    )
        external
        onlyOwner
    {
        rewardsDistribution = _rewardsDistribution;
    }
}