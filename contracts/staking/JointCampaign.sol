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

    // TODO to remove or to not remove? that is the question
    address public arcDAO;
    address public rewardsDistributor;

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

    uint256 public vestingEndDate; // todo vesting?
    uint8 public stakeToDebtRatio;

    bool public tokensClaimable;

    uint256 private _totalSupply;

    /* ========== Events ========== */

    event RewardAdded (uint256 reward);

    event Staked(address indexed user, uint256 amount);

    event Withdrawn(address indexed user, uint256 amount);

    event RewardPaid(address indexed user, uint256 arcReward, uint256 stEthReward);

    event RewardsDurationUpdated(uint256 newDuration);

    event Recovered(address token, uint256 amount);

    event PositionStaked(address _address, uint256 _positionId);

    event ClaimableStatusUpdated(bool _status);

    event UserSlashed(address _user, address _slasher, uint256 _amount);

    event StateContractApproved(address _address);

    /* ========== Modifiers ========== */

    modifier updateReward(address _account) {
        _updateReward(_account);
        _;
    }

    modifier onlyRewardsDistributor() {
        require(
            msg.sender == rewardsDistributor,
            "Caller is not RewardsDistribution contract"
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

    modifier onlyPartners() {
        require(
            msg.sender == owner() || msg.sender == rewardsDistributor,
            "Caller is not owner or reward distributor"
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

    function balanceOf(
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
        public
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

    function arcEarned(
        address account
    )
        public
        view
        returns (uint256)
    {
        return Decimal.mul(
            _rewardTokenEarned(account, address(arcRewardToken)),
            userAllocation()
        );
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

    // todo is this still necessary?
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
        uint256 totalBalance = balanceOf(msg.sender).add(_amount);

        // Setting each variable invididually means we don't overwrite
        Staker storage staker = stakers[msg.sender];

        if (staker.positionId != 0) {
            require (
                staker.positionId == _positionId,
                "You cannot stake based on a different debt position"
            );
        }

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

        require(
            block.timestamp < vestingEndDate,
            "You cannot slash after the vesting end date"
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
        stakers[rewardsDistributor].arcRewardsEarned = stakers[rewardsDistributor].arcRewardsEarned.add(
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
        withdraw(balanceOf(msg.sender));
    }

    /* ========== Admin Functions ========== */

    function setRewardsDistributor(
        address _rewardsDistributor
    )
        external
        onlyPartners
    {
        require(
            rewardsDistributor != _rewardsDistributor,
            "Cannot set the same rewards distributor"
        );
        
        rewardsDistributor = _rewardsDistributor;
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

    function notifyRewardAmount(
        uint256 _reward
    )
        external
        onlyRewardsDistributor
        updateReward(address(0))
    {
        require(
            rewardsDuration > 0,
            "Rewards duration is not set"
        );
        
        stEthRewardToken.safeTransferFrom(msg.sender, address(this), _reward);

        uint256 arcBalance = arcRewardToken.balanceOf(address(this));

        if (block.timestamp >= periodFinish) {
            stEthRewardRate = _reward.div(rewardsDuration);
            arcRewardRate = arcBalance.div(rewardsDuration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 stEthLeftover = remaining.mul(stEthRewardRate);
            stEthRewardRate = _reward.add(stEthLeftover).div(rewardsDuration);
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        require(
            arcRewardRate <= arcBalance.div(rewardsDuration),
            "Provided reward too high for the balance of ARCx token"
        );
        
        uint256 stEthBalance = stEthRewardToken.balanceOf(address(this));
        require(
            stEthRewardRate <= stEthBalance.div(rewardsDuration),
            "Provided reward too high for the balance of stETH token"
        );

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);
        emit RewardAdded(_reward);
    }

    /**
     * @notice Allows owner to recover any ERC20 token sent to this contract, except the staking
     * tokens and the reward tokens - with the exception of ARCx surplus that was transfered.
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
        
        // Cannot recover the staking token or the rewards token
        require(
            _tokenAddress != address(stakingToken) && _tokenAddress != address(stEthRewardToken),
            "Cannot withdraw the staking or rewards tokens"
        );

        IERC20(_tokenAddress).safeTransfer(owner(), _tokenAmount);
        emit Recovered(_tokenAddress, _tokenAmount);
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

    function init(
        address _arcDAO,
        address _rewardsDistributor,
        address _arcRewardToken,
        address _stEthRewardToken,
        address _stakingToken,
        Decimal.D256 memory _daoAllocation,
        Decimal.D256 memory _slasherCut,
        uint8 _stakeToDebtRatio
    )
        public
        onlyOwner
    {
        arcDAO = _arcDAO;
        rewardsDistributor = _rewardsDistributor;
        arcRewardToken = IERC20(_arcRewardToken);
        stEthRewardToken = IERC20(_stEthRewardToken);
        stakingToken = IERC20(_stakingToken);

        daoAllocation = _daoAllocation;
        slasherCut = _slasherCut;
        arcRewardToken = IERC20(_arcRewardToken);
        stakeToDebtRatio = _stakeToDebtRatio;
    }

    /* ========== Private Functions ========== */

    function _updateReward(
        address _account
    )
        private
    {
        lastUpdateTime = lastTimeRewardApplicable();

        arcRewardPerTokenStored = _rewardPerToken(address(arcRewardToken));
        stEthPerTokenStored = _rewardPerToken(address(stEthRewardToken));

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

            stEthPerTokenStored.add(
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
        
        if (_rewardTokenAddress == address(arcRewardToken)) {
            return stakerBalance
                .mul(_rewardPerToken(address(arcRewardToken)).sub(
                    stakers[_account].arcRewardPerTokenPaid)
                )
                .div(1e18)
                .add(stakers[_account].arcRewardsEarned);
        }
        
        return stakerBalance.mul(_rewardPerToken(address(stEthRewardToken))
                .sub(stakers[_account].stEthRewardPerTokenPaid)
            )
            .div(1e18)
            .add(stakers[_account].stEthRewardsEarned);
    }
}
