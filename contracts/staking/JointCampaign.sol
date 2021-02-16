// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;

pragma experimental ABIEncoderV2;

import {Ownable} from "../lib/Ownable.sol";
import {SafeMath} from "../lib/SafeMath.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";
import {Decimal} from "../lib/Decimal.sol";

import {IERC20} from "../token/IERC20.sol";

import {IMozartCoreV2} from "../debt/mozart/IMozartCoreV2.sol";
import {MozartTypes} from "../debt/mozart/MozartTypes.sol";

import "hardhat/console.sol";

contract JointCampaign is Ownable {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* ========== Structs ========== */

    struct Staker {
        uint256 positionId;
        uint256 debtSnapshot;
        uint256 balance;
        uint256 arcRewardPerTokenPaid;
        uint256 stEthRewardPerTokenPaid;
        uint256 arcRewardsEarned;
        uint256 stEthRewardsEarned;
        uint256 arcRewardsReleased;
        uint256 stEthRewardsReleased;
    }

    /* ========== Variables ========== */

    IERC20 public arcRewardToken;
    IERC20 public stEthRewardToken;
    IERC20 public stakingToken;

    IMozartCoreV2 public stateContract;

    address public arcDAO;
    address public arcRewardsDistributor;
    address public stEthRewardsDistributor;

    mapping (address => Staker) public stakers;

    uint256 public periodFinish = 0;
    uint256 public rewardsDuration = 0;
    uint256 public lastUpdateTime;

    uint256 public arcRewardRate = 0;
    uint256 public stEthRewardRate = 0;

    uint256 public arcRewardPerTokenStored;
    uint256 public stEthPerTokenStored;

    Decimal.D256 public daoAllocation;
    Decimal.D256 public slasherCut;

    uint8 public stakeToDebtRatio;

    bool public tokensClaimable;

    uint256 private _totalSupply;

    /* ========== Events ========== */

    event RewardAdded (uint256 reward, address rewardToken);

    event Staked(address indexed user, uint256 amount);

    event Withdrawn(address indexed user, uint256 amount);

    event RewardPaid(address indexed user, uint256 arcReward, uint256 stEthReward);

    event RewardsDurationUpdated(uint256 newDuration);

    event StEthRewardsDistributorUpdated(address rewardsDistributor);

    event ArcRewardsDistributorUpdated(address rewardsDistributor);

    event ERC20Recovered(address token, uint256 amount);

    event StEthRecovered(uint256 amount);

    event PositionStaked(address _address, uint256 _positionId);

    event ClaimableStatusUpdated(bool _status);

    event UserSlashed(address _user, address _slasher, uint256 _amount);

    event StateContractApproved(address _address);

    /* ========== Modifiers ========== */

    modifier updateReward(address _account) {
        _updateReward(_account);
        _;
    }

    modifier onlyRewardDistributors() {
        require(
            msg.sender == arcRewardsDistributor || msg.sender == stEthRewardsDistributor,
            "Caller is not a reward distributor"
        );
        _;
    }

    modifier onlyStEthDistributor() {
        require(
            msg.sender == stEthRewardsDistributor,
            "Caller is not the stETH rewards distributor"
        );
        _;
    }

    modifier verifyRewardToken(address _rewardTokenAddress) {
        bool isArcToken = _rewardTokenAddress == address(arcRewardToken);
        bool isStEthToken = _rewardTokenAddress == address(stEthRewardToken);

        require (
            isArcToken || isStEthToken,
            "The reward token address does not correspond to one of the rewards tokens."
        );
        _;
    }

    /* ========== View Functions ========== */

    function totalSupply()
        public
        view
        returns (uint256)
    {
        return _totalSupply;
    }

    function balanceOfStaker(
        address account
    )
        public
        view
        returns (uint256)
    {
        return stakers[account].balance;
    }

    function lastTimeRewardApplicable()
        public
        view
        returns (uint256)
    {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function arcRewardPerTokenUser()
        external
        view
        returns (uint256)
    {
        if (_totalSupply == 0) {
            return arcRewardPerTokenStored;
        }

        // Since we're adding the stored amount we can't just multiply
        // the userAllocation() with the result of actualRewardPerTokenUser()
        return
            arcRewardPerTokenStored.add(
                Decimal.mul(
                    lastTimeRewardApplicable()
                        .sub(lastUpdateTime)
                        .mul(arcRewardRate)
                        .mul(1e18)
                        .div(_totalSupply),
                    userAllocation()
                )
            );
    }

    function stEthRewardPerToken()
        external
        view
        returns (uint256)
    {
        if (_totalSupply == 0) {
            return stEthPerTokenStored;
        }

        return stEthPerTokenStored.add(
            lastTimeRewardApplicable()
                .sub(lastUpdateTime)
                .mul(stEthRewardRate)
                .mul(1e18)
                .div(_totalSupply)
        );
    }

    function arcEarned(
        address _account
    )
        external
        view
        returns (uint256)
    {
        return Decimal.mul(
            _rewardTokenEarned(_account, address(arcRewardToken)),
            userAllocation()
        );
    }

    function stEthEarned(
        address _account
    )
        external
        view
        returns (uint256)
    {
        return _rewardTokenEarned(_account, address(stEthRewardToken));
    }

    function getArcRewardForDuration()
        external
        view
        returns (uint256)
    {
        return arcRewardRate.mul(rewardsDuration);
    }

    function getStETHRewardForDuration()
        external
        view
        returns (uint256)
    {
        return stEthRewardRate.mul(rewardsDuration);
    }

    function isMinter(
        address _user,
        uint256 _amount,
        uint256 _positionId
    )
        public
        view
        returns (bool)
    {
        MozartTypes.Position memory position = stateContract.getPosition(_positionId);

        if (position.owner != _user) {
            return false;
        }

        return uint256(position.borrowedAmount.value) >= _amount;
    }

    function  userAllocation()
        public
        view
        returns (Decimal.D256 memory)
    {
        return Decimal.sub(
            Decimal.one(),
            daoAllocation.value
        );
    }

    /* ========== Mutative Functions ========== */

    function stake(
        uint256 _amount,
        uint256 _positionId
    )
        external
        updateReward(msg.sender)
    {
        uint256 totalBalance = balanceOfStaker(msg.sender).add(_amount);

        // Setting each variable invididually means we don't overwrite
        Staker storage staker = stakers[msg.sender];

        if (staker.positionId != 0) {
            require (
                staker.positionId == _positionId,
                "You cannot stake based on a different debt position"
            );
        }

        require(
            stakeToDebtRatio != 0,
            "The stake to debt ratio cannot be 0"
        );

        uint256 debtRequirement = totalBalance.div(uint256(stakeToDebtRatio));

        require(
            isMinter(
                msg.sender,
                debtRequirement,
                _positionId
            ),
            "Must be a valid minter"
        );

        // This stops an attack vector where a user stakes a lot of money
        // then drops the debt requirement by staking less before the deadline
        // to reduce the amount of debt they need to lock in

        require(
            debtRequirement >= staker.debtSnapshot,
            "Your new debt requirement cannot be lower than last time"
        );

        if (staker.positionId == 0) {
            staker.positionId = _positionId;
        }
        staker.debtSnapshot = debtRequirement;
        staker.balance = staker.balance.add(_amount);

        _totalSupply = _totalSupply.add(_amount);

        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        emit Staked(msg.sender, _amount);
    }

    function slash(
        address _user
    )
        external
        updateReward(_user)
    {
        require(
            _user != msg.sender,
            "You cannot slash yourself"
        );

        Staker storage userStaker = stakers[_user];

        require(
            isMinter(
                _user,
                userStaker.debtSnapshot,
                userStaker.positionId
            ) == false,
            "You can't slash a user who is a valid minter"
        );

        uint256 penalty = userStaker.arcRewardsEarned;
        uint256 bounty = Decimal.mul(penalty, slasherCut);

        stakers[msg.sender].arcRewardsEarned = stakers[msg.sender].arcRewardsEarned.add(bounty);
        stakers[arcRewardsDistributor].arcRewardsEarned = stakers[arcRewardsDistributor].arcRewardsEarned.add(
            penalty.sub(bounty)
        );

        userStaker.arcRewardsEarned = 0;

        emit UserSlashed(_user, msg.sender, penalty);

    }

    function getReward(address _user)
        public
        updateReward(_user)
    {
        require(
            tokensClaimable == true,
            "Tokens cannnot be claimed yet"
        );

        Staker storage staker = stakers[_user];

        uint256 arcPayableAmount = staker.arcRewardsEarned.sub(staker.arcRewardsReleased);
        uint256 stEthPayableAmount = staker.stEthRewardsEarned.sub(staker.stEthRewardsReleased);

        staker.arcRewardsReleased = staker.arcRewardsReleased.add(arcPayableAmount);
        staker.stEthRewardsReleased = staker.arcRewardsReleased.add(arcPayableAmount);

        uint256 daoPayable = Decimal.mul(arcPayableAmount, daoAllocation);

        arcRewardToken.safeTransfer(arcDAO, daoPayable);
        arcRewardToken.safeTransfer(_user, arcPayableAmount.sub(daoPayable));

        stEthRewardToken.safeTransfer(_user, stEthPayableAmount);

        emit RewardPaid(_user, arcPayableAmount, stEthPayableAmount);
    }

    function withdraw(
        uint256 amount
    )
        public
        updateReward(msg.sender)
    {
        require(
            amount >= 0,
            "Cannot withdraw less than 0"
        );

        _totalSupply = _totalSupply.sub(amount);
        stakers[msg.sender].balance = stakers[msg.sender].balance.sub(amount);

        stakingToken.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    function exit()
        external
    {
        getReward(msg.sender);
        withdraw(balanceOfStaker(msg.sender));
    }

    /* ========== Admin Functions ========== */

    function init(
        address _arcDAO,
        address _arcRewardsDistributor,
        address _stEthRewardsDistributor,
        address _arcRewardToken,
        address _stEthRewardToken,
        address _stakingToken,
        Decimal.D256 memory _daoAllocation,
        Decimal.D256 memory _slasherCut,
        uint8 _stakeToDebtRatio,
        address _stateContract
    )
        public
        onlyOwner
    {
        arcDAO = _arcDAO;
        arcRewardsDistributor = _arcRewardsDistributor;
        stEthRewardsDistributor = _stEthRewardsDistributor;
        arcRewardToken = IERC20(_arcRewardToken);
        stEthRewardToken = IERC20(_stEthRewardToken);
        stakingToken = IERC20(_stakingToken);

        daoAllocation = _daoAllocation;
        slasherCut = _slasherCut;
        arcRewardToken = IERC20(_arcRewardToken);
        stakeToDebtRatio = _stakeToDebtRatio;

        stateContract = IMozartCoreV2(_stateContract);
    }

    function setStEthRewardsDistributor(
        address _rewardsDistributor
    )
        external
        onlyStEthDistributor
    {
        require(
            stEthRewardsDistributor != _rewardsDistributor,
            "Cannot set the same rewards distributor"
        );

        stEthRewardsDistributor = _rewardsDistributor;
        emit StEthRewardsDistributorUpdated(_rewardsDistributor);
    }

    function setArcRewardsDistributor(
        address _rewardsDistributor
    )
        external
        onlyOwner
    {
        require(
            arcRewardsDistributor != _rewardsDistributor,
            "Cannot set the same rewards distributor"
        );

        arcRewardsDistributor = _rewardsDistributor;
        emit ArcRewardsDistributorUpdated(_rewardsDistributor);
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

    /**
     * @notice Sets the reward amount for the given reward token. There contract must
     *          already have at least as much amount as the given `_reward`
     *
     * @param _reward The amount of the reward
     * @param _rewardToken The address of the reward token
     */
    function notifyRewardAmount(
        uint256 _reward,
        address _rewardToken
    )
        external
        onlyRewardDistributors
        verifyRewardToken(_rewardToken)
        updateReward(address(0))
    {
        require(
            rewardsDuration > 0,
            "Rewards duration is not set"
        );

        uint256 remaining;
        uint256 leftover;
        bool isAfterPeriodFinish = block.timestamp >= periodFinish;

        if (!isAfterPeriodFinish) {
            remaining = periodFinish.sub(block.timestamp);
        }

        if (_rewardToken == address(arcRewardToken)) {
            require(
                msg.sender == arcRewardsDistributor,
                "Only the ARCx rewards distributor can notify the amount of ARCx rewards"
            );

            if (isAfterPeriodFinish) {
                arcRewardRate = _reward.div(rewardsDuration);
            } else {
                leftover = remaining.mul(arcRewardRate);
                arcRewardRate = _reward.add(leftover).div(rewardsDuration);

                require(
                    arcRewardRate <= arcRewardToken.balanceOf(address(this)),
                    "Provided reward too high for the balance of ARCx token"
                );
            }
        } else {
            require(
                msg.sender == stEthRewardsDistributor,
                "Only the stETH rewards distributor can notify the amount of stETH rewards"
            );

            // stETH token
            if (isAfterPeriodFinish) {
                stEthRewardRate = _reward.div(rewardsDuration);
            } else {
                leftover = remaining.mul(stEthRewardRate);
                stEthRewardRate = _reward.add(leftover).div(rewardsDuration);

                require(
                    stEthRewardRate <= stEthRewardToken.balanceOf(address(this)),
                    "Provided reward too high for the balance of stETH token"
                );
            }
        }

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);
        emit RewardAdded(_reward, _rewardToken);
    }

    /**
     * @notice Allows owner to recover any ERC20 token sent to this contract, except the staking
     *          okens and the reward tokens - with the exception of ARCx surplus that was transfered.
     *
     * @param _tokenAddress the address of the token
     * @param _tokenAmount to amount to recover
     */
    function recoverERC20(
        address _tokenAddress,
        uint256 _tokenAmount
    )
        external
        onlyOwner
    {
        // If _tokenAddress is ARCx, only allow its recovery if the amount is not greater than
        // the current reward
        if (_tokenAddress == address(arcRewardToken) && rewardsDuration > 0) {
            uint256 arcBalance = arcRewardToken.balanceOf(address(this));

            require(
                arcRewardRate <= arcBalance.sub(_tokenAmount).div(rewardsDuration),
                "Only the surplus of the reward can be recovered, not more"
            );
        }

        // Cannot recover the staking token or the stETH rewards token
        require(
            _tokenAddress != address(stakingToken) && _tokenAddress != address(stEthRewardToken),
            "Cannot withdraw the staking or stETH reward tokens"
        );

        IERC20(_tokenAddress).safeTransfer(owner(), _tokenAmount);
        emit ERC20Recovered(_tokenAddress, _tokenAmount);
    }

    /**
     * @notice Lets the stETH reward distributor recover a desired amount of stETH as long as that
     *          amount is not greater than the reward to recover
     *
     * @param _amount The amount of stETH to recover
     */
    function recoverStEth(
        uint256 _amount
    )
        external
        onlyStEthDistributor
    {
        if (rewardsDuration > 0) {
            uint256 stEthBalance = stEthRewardToken.balanceOf(address(this));

            require(
                stEthRewardRate <= stEthBalance.sub(_amount).div(rewardsDuration),
                "Only the surplus of the reward can be recovered, not more"
            );
        }

        stEthRewardToken.safeTransfer(msg.sender, _amount);
        emit StEthRecovered(_amount);
    }

    function setTokensClaimable(
        bool _enabled
    )
        external
        onlyOwner
    {
        tokensClaimable = _enabled;

        emit ClaimableStatusUpdated(_enabled);
    }

    /* ========== Private Functions ========== */

    function _updateReward(
        address _account
    )
        private
    {
        arcRewardPerTokenStored = _rewardPerToken(address(arcRewardToken));
        stEthPerTokenStored = _rewardPerToken(address(stEthRewardToken));

        lastUpdateTime = lastTimeRewardApplicable();

        if (_account != address(0)) {
            stakers[_account].arcRewardsEarned = _rewardTokenEarned(_account, address(arcRewardToken));
            stakers[_account].arcRewardPerTokenPaid = arcRewardPerTokenStored;

            stakers[_account].stEthRewardsEarned = _rewardTokenEarned(_account, address(stEthRewardToken));
            stakers[_account].stEthRewardPerTokenPaid = stEthPerTokenStored;
        }
    }

    function _rewardPerToken(
        address _rewardTokenAddress
    )
        private
        view
        verifyRewardToken(_rewardTokenAddress)
        returns (uint256)
    {
        if (_rewardTokenAddress == address(arcRewardToken)) {
            if (_totalSupply == 0) {
                return arcRewardPerTokenStored;
            }

            return arcRewardPerTokenStored.add(
                lastTimeRewardApplicable()
                    .sub(lastUpdateTime)
                    .mul(arcRewardRate)
                    .mul(1e18)
                    .div(_totalSupply)
            );
        } else {
            if (_totalSupply == 0) {
                return stEthPerTokenStored;
            }

            return stEthPerTokenStored.add(
                lastTimeRewardApplicable()
                    .sub(lastUpdateTime)
                    .mul(stEthRewardRate)
                    .mul(1e18)
                    .div(_totalSupply)
            );
        }
    }

    function _rewardTokenEarned(
        address _account,
        address _rewardTokenAddress
    )
        private
        view
        verifyRewardToken(_rewardTokenAddress)
        returns (uint256)
    {
        uint256 stakerBalance = stakers[_account].balance;

        console.log("staker balance: %s", stakerBalance);

        if (_rewardTokenAddress == address(arcRewardToken)) {
            return
                stakerBalance.mul(
                    _rewardPerToken(address(arcRewardToken))
                    .sub(stakers[_account].arcRewardPerTokenPaid)
                )
                .div(1e18)
                .add(stakers[_account].arcRewardsEarned);
        }

        return
            stakerBalance.mul(
                _rewardPerToken(address(stEthRewardToken))
                .sub(stakers[_account].stEthRewardPerTokenPaid)
            )
            .div(1e18)
            .add(stakers[_account].stEthRewardsEarned);
    }
}
