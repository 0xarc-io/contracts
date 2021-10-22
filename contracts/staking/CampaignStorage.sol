// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {SafeMath} from "../lib/SafeMath.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";

import {IPermittableERC20} from "../token/IPermittableERC20.sol";
import {IERC20} from "../token/IERC20.sol";

/**
 * @dev A common storage for reward campaigns
 */
contract CampaignStorage {

    /* ========== Libraries ========== */

    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IPermittableERC20;

    /* ========== Constants ========== */

    uint256 constant BASE = 1e18;

    /* ========== Variables ========== */

    /**
     * @notice Address of the ARCx DAO
     */
    address public arcDAO;

    /**
     * @notice The reward token distributed in the farm
     */
    IERC20 public rewardToken;

    /**
     * @notice The staking token
     */
    IPermittableERC20 public stakingToken;

    /**
     * @notice Epoch when the farm ends
     */
    uint256 public periodFinish = 0;

    /**
     * @notice The duration of the farm, in seconds
     */
    uint256 public rewardsDuration = 0;

    /**
     * @notice The current reward amount per staking token
     */
    uint256 public rewardPerTokenStored;

    /**
     * @notice Timestamp of the last reward update
     */
    uint256 public lastUpdateTime;

    /**
     * @notice Amount of rewards distributed every second
     */
    uint256 public rewardRate = 0;

    /**
     * @notice The current rewards distributor
     */
    address public rewardsDistributor;

    /**
     * @notice The current share of the ARCx DAO (ratio)
     */
    uint256 public daoAllocation;

    /**
     * @notice Flag determining if the rewards are claimable or not
     */
    bool public tokensClaimable;

    /**
     * @notice The amount of staking tokens on the contract
     */
    uint256 public totalSupply;

    /* ========== Public Getters ========== */

    function getRewardForDuration()
        external
        view
        returns (uint256)
    {
        return rewardRate.mul(rewardsDuration);
    }

    function  userAllocation()
        public
        view
        returns (uint256)
    {
        return BASE.sub(daoAllocation);
    }
}
