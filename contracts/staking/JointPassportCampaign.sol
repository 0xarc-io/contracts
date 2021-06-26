// SPDX-License-Identifier: MIT
pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {Ownable} from "../lib/Ownable.sol";
import {CreditScoreVerifiable} from "../lib/CreditScoreVerifiable.sol";

import {IERC20} from "../token/IERC20.sol";
import {IPermittableERC20} from "../token/IPermittableERC20.sol";

import {CampaignStorage} from "./CampaignStorage.sol";
import {SapphireTypes} from "../debt/sapphire/SapphireTypes.sol";

/**
 * @notice A farm that requires a defi passport with a good credit
 *         score to participate that has two reward tokens.
 */
contract JointPassportCampaign is CampaignStorage, CreditScoreVerifiable, Ownable {

    /* ========== Structs ========== */

    struct Staker {
        uint256 balance;
        uint256 arcRewardPerTokenPaid;
        uint256 collabRewardPerTokenPaid;
        uint256 arcRewardsEarned;
        uint256 collabRewardsEarned;
        uint256 arcRewardsReleased;
        uint256 collabRewardsReleased;
    }

    /* ========== Variables ========== */

    IERC20 public collabRewardToken;

    address public collabRewardsDistributor;

    mapping (address => Staker) public stakers;

    uint256 public collabPeriodFinish = 0;
    uint256 public collabLastUpdateTime;

    uint256 public collabPerTokenStored;

    uint256 public maxStakePerUser;
    uint16 public creditScoreThreshold;

    uint256 public collabRewardRate = 0;

    bool public collabTokensClaimable;

    /* ========== Events ========== */

    event RewardAdded (
        uint256 _reward,
        address _rewardToken
    );

    event Staked(
        address indexed _user,
        uint256 _amount
    );

    event Withdrawn(
        address indexed _user,
        uint256 _amount
    );

    event RewardPaid(
        address indexed _user,
        uint256 _arcReward,
        uint256 _collabReward
    );

    event RewardsDurationUpdated(uint256 _newDuration);

    event Recovered(
        address _token,
        uint256 _amount
    );

    event ArcClaimableStatusUpdated(bool _status);

    event CollabClaimableStatusUpdated(bool _status);

    event RewardsDistributorUpdated(address _rewardsDistributor);

    event CollabRewardsDistributorUpdated(address _rewardsDistributor);

    event CollabRecovered(uint256 _amount);

    event CreditScoreThresholdSet(uint16 _newThreshold);

    event MaxStakePerUserSet(uint256 _newMaxStakePerUser);

    /* ========== Modifiers ========== */

    modifier updateReward(
        address _account,
        address _rewardToken
    ) {
        _updateRewardTokenCalculations(_rewardToken);
        _updateRewardsForUser(_account);
        _;
    }

    modifier onlyRewardDistributors() {
        require(
            msg.sender == rewardsDistributor || msg.sender == collabRewardsDistributor,
            "JointPassportCampaign: caller is not a reward distributor"
        );
        _;
    }

    modifier onlyCollabDistributor() {
        require(
            msg.sender == collabRewardsDistributor,
            "JointPassportCampaign: caller is not the collab rewards distributor"
        );
        _;
    }

    modifier verifyRewardToken(address _rewardTokenAddress) {
        bool isArcToken = _rewardTokenAddress == address(rewardToken);
        bool isCollabToken = _rewardTokenAddress == address(collabRewardToken);

        require(
            isArcToken || isCollabToken,
            "JointPassportCampaign: invalid reward token"
        );
        _;
    }

    /* ========== Constructor ========== */

    constructor(
        address _arcDAO,
        address _rewardsDistributor,
        address _collabRewardsDistributor,
        address _rewardToken,
        address _collabRewardToken,
        address _stakingToken,
        address _creditScoreContract,
        uint256 _daoAllocation,
        uint256 _maxStakePerUser,
        uint16 _creditScoreThreshold
    )
        public
        CreditScoreVerifiable(_creditScoreContract)
    {
        require(
            _arcDAO != address(0) &&
            _rewardsDistributor != address(0) &&
            _collabRewardsDistributor != address(0) &&
            _rewardToken.isContract() &&
            _collabRewardToken.isContract() &&
            _stakingToken.isContract() &&
            _daoAllocation > 0 &&
            _creditScoreThreshold > 0,
            "JointPassportCampaign: one or more values is empty"
        );

        arcDAO                      = _arcDAO;
        rewardsDistributor       = _rewardsDistributor;
        collabRewardsDistributor    = _collabRewardsDistributor;
        rewardToken              = IERC20(_rewardToken);
        collabRewardToken           = IERC20(_collabRewardToken);
        stakingToken                = IPermittableERC20(_stakingToken);
        creditScoreThreshold        = _creditScoreThreshold;
        maxStakePerUser             = _maxStakePerUser;
        daoAllocation               = _daoAllocation;
    }

    /* ========== Admin Functions ========== */

    function setCollabRewardsDistributor(
        address _rewardsDistributor
    )
        external
        onlyCollabDistributor
    {
        require(
            collabRewardsDistributor != _rewardsDistributor,
            "JointPassportCampaign: cannot set the same rewards distributor"
        );

        collabRewardsDistributor = _rewardsDistributor;
        emit CollabRewardsDistributorUpdated(_rewardsDistributor);
    }

    function setRewardsDistributor(
        address _rewardsDistributor
    )
        external
        onlyOwner
    {
        require(
            rewardsDistributor != _rewardsDistributor,
            "JointPassportCampaign: cannot set the same rewards distributor"
        );

        rewardsDistributor = _rewardsDistributor;
        emit RewardsDistributorUpdated(_rewardsDistributor);
    }

    function setRewardsDuration(
        uint256 _rewardsDuration
    )
        external
        onlyOwner
    {
        uint256 periodFinish = periodFinish > collabPeriodFinish
            ? periodFinish
            : collabPeriodFinish;

        require(
            periodFinish == 0 || currentTimestamp() > periodFinish,
            "JointPassportCampaign: previous period not yet finished"
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
        updateReward(address(0), _rewardToken)
    {
        require(
            rewardsDuration > 0,
            "JointPassportCampaign: rewards duration is not set"
        );

        uint256 remaining;
        uint256 leftover;

        if (_rewardToken == address(rewardToken)) {
            require(
                msg.sender == rewardsDistributor,
                "JointPassportCampaign: only ARCx distributor can notify ARCx rewards"
            );

            if (currentTimestamp() >= periodFinish) {
                rewardRate = _reward.div(rewardsDuration);
            } else {
                remaining = periodFinish.sub(currentTimestamp());
                leftover = remaining.mul(rewardRate);
                rewardRate = _reward.add(leftover).div(rewardsDuration);

            }

            require(
                rewardRate <= rewardToken.balanceOf(address(this)).div(rewardsDuration),
                "JointPassportCampaign: not enough ARCx balance on the contract"
            );

            periodFinish = currentTimestamp().add(rewardsDuration);
            lastUpdateTime = currentTimestamp();
        } else {
            require(
                msg.sender == collabRewardsDistributor,
                "JointPassportCampaign: only the collab distributor can notify collab rewards"
            );

            // collab token
            if (currentTimestamp() >= collabPeriodFinish) {
                collabRewardRate = _reward.div(rewardsDuration);
            } else {
                remaining = collabPeriodFinish.sub(currentTimestamp());
                leftover = remaining.mul(collabRewardRate);
                collabRewardRate = _reward.add(leftover).div(rewardsDuration);

            }

            require(
                collabRewardRate <= collabRewardToken.balanceOf(address(this)).div(rewardsDuration),
                "JointPassportCampaign: not enough collab token balance on the contract"
            );

            collabPeriodFinish = currentTimestamp().add(rewardsDuration);
            collabLastUpdateTime = currentTimestamp();
        }

        emit RewardAdded(_reward, _rewardToken);
    }

    /**
     * @notice Allows owner to recover any ERC20 token sent to this contract, except the staking
     *         tokens and the reward tokens - with the exception of ARCx surplus that was transferred.
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
        if (_tokenAddress == address(rewardToken) && rewardsDuration > 0) {
            uint256 arcBalance = rewardToken.balanceOf(address(this));

            require(
                rewardRate <= arcBalance.sub(_tokenAmount).div(rewardsDuration),
                "JointPassportCampaign: only the surplus of the reward can be recovered"
            );
        }

        // Cannot recover the staking token or the collab rewards token
        require(
            _tokenAddress != address(stakingToken) && _tokenAddress != address(collabRewardToken),
            "JointPassportCampaign: cannot withdraw the staking or collab reward tokens"
        );

        IERC20(_tokenAddress).safeTransfer(owner(), _tokenAmount);
        emit Recovered(_tokenAddress, _tokenAmount);
    }

    /**
     * @notice Lets the collab reward distributor recover a desired amount of collab as long as that
     *          amount is not greater than the reward to recover
     *
     * @param _amount The amount of collab to recover
     */
    function recoverCollab(
        uint256 _amount
    )
        external
        onlyCollabDistributor
    {
        if (rewardsDuration > 0) {
            uint256 collabBalance = collabRewardToken.balanceOf(address(this));

            require(
                collabRewardRate <= collabBalance.sub(_amount).div(rewardsDuration),
                "JointPassportCampaign: only the surplus of the reward can be recovered"
            );
        }

        collabRewardToken.safeTransfer(msg.sender, _amount);
        emit CollabRecovered(_amount);
    }

    function setTokensClaimable(
        bool _enabled
    )
        external
        onlyOwner
    {
        tokensClaimable = _enabled;

        emit ArcClaimableStatusUpdated(_enabled);
    }

    function setCollabTokensClaimable(
        bool _enabled
    )
        external
        onlyOwner
    {
        collabTokensClaimable = _enabled;

        emit CollabClaimableStatusUpdated(_enabled);
    }

    function setCreditScoreThreshold(
        uint16 _newThreshold
    )
        external
        onlyOwner
    {
        creditScoreThreshold = _newThreshold;

        emit CreditScoreThresholdSet(creditScoreThreshold);
    }

    function setMaxStakePerUser(
        uint256 _maxStakePerUser
    )
        external
        onlyOwner
    {
        maxStakePerUser = _maxStakePerUser;

        emit MaxStakePerUserSet(maxStakePerUser);
    }

    /* ========== View Functions ========== */

    function balanceOf(
        address account
    )
        public
        view
        returns (uint256)
    {
        return stakers[account].balance;
    }

    function lastTimeRewardApplicable(
        address _rewardToken
    )
        public
        view
        verifyRewardToken(_rewardToken)
        returns (uint256)
    {
        uint256 relevantPeriod = _rewardToken == address(rewardToken) ? periodFinish : collabPeriodFinish;

        return currentTimestamp() < relevantPeriod ? currentTimestamp() : relevantPeriod;
    }

    function arcRewardPerTokenUser()
        external
        view
        returns (uint256)
    {
        if (totalSupply == 0) {
            return rewardPerTokenStored;
        }

        return rewardPerTokenStored.add(
            lastTimeRewardApplicable(address(rewardToken))
                .sub(lastUpdateTime)
                .mul(rewardRate)
                .mul(BASE)
                .div(totalSupply)
        )
            .mul(userAllocation())
            .div(BASE);

    }

    function collabRewardPerToken()
        external
        view
        returns (uint256)
    {
        if (totalSupply == 0) {
            return collabPerTokenStored;
        }

        return collabPerTokenStored.add(
            lastTimeRewardApplicable(address(collabRewardToken))
                .sub(collabLastUpdateTime)
                .mul(collabRewardRate)
                .mul(BASE)
                .div(totalSupply)
        );
    }

    function _actualEarned(
        address _account,
        address _rewardTokenAddress
    )
        internal
        view
        verifyRewardToken(_rewardTokenAddress)
        returns (uint256)
    {
        uint256 stakerBalance = stakers[_account].balance;

        if (_rewardTokenAddress == address(rewardToken)) {
            return
                stakerBalance.mul(
                    _rewardPerToken(address(rewardToken))
                    .sub(stakers[_account].arcRewardPerTokenPaid)
                )
                .div(BASE)
                .add(stakers[_account].arcRewardsEarned);
        }

        return
            stakerBalance.mul(
                _rewardPerToken(address(collabRewardToken))
                .sub(stakers[_account].collabRewardPerTokenPaid)
            )
            .div(BASE)
            .add(stakers[_account].collabRewardsEarned);
    }

    function arcEarned(
        address _account
    )
        external
        view
        returns (uint256)
    {
        return _actualEarned(_account, address(rewardToken))
            .mul(userAllocation())
            .div(BASE);
    }

    function collabEarned(
        address _account
    )
        external
        view
        returns (uint256)
    {
        return _actualEarned(_account, address(collabRewardToken));
    }

    function getCollabRewardForDuration()
        external
        view
        returns (uint256)
    {
        return collabRewardRate.mul(rewardsDuration);
    }

    function currentTimestamp()
        public
        view
        returns (uint256)
    {
        return block.timestamp;
    }

    /* ========== Mutative Functions ========== */

    function stake(
        uint256 _amount,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
        checkScoreProof(_scoreProof, true)
        updateReward(msg.sender, address(0))
    {
        // Do not allow user to stake if they do not meet the credit score requirements
        require(
            _scoreProof.score >= creditScoreThreshold,
            "JointPassportCampaign: user does not meet the credit score requirement"
        );

        // Setting each variable individually means we don't overwrite
        Staker storage staker = stakers[msg.sender];

        staker.balance = staker.balance.add(_amount);

        // Heads up: the the max stake amount is not set in stone. It can be changed
        // by the admin by calling `setMaxStakePerUser()`
        if (maxStakePerUser > 0) {
            require(
                staker.balance <= maxStakePerUser,
                "JointPassportCampaign: cannot stake more than the limit"
            );
        }

        totalSupply = totalSupply.add(_amount);

        emit Staked(msg.sender, _amount);

        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function stakeWithPermit(
        uint256 _amount,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {
        stakingToken.permit(
            msg.sender,
            address(this),
            _amount,
            _deadline,
            _v,
            _r,
            _s
        );
        stake(_amount, _scoreProof);
    }

    function getReward(
        address _user,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
        checkScoreProof(_scoreProof, false)
        updateReward(_user, address(0))
    {
        Staker storage staker = stakers[_user];
        uint256 arcPayableAmount;
        uint256 collabPayableAmount;

        require(
            collabTokensClaimable || tokensClaimable,
            "JointPassportCampaign: at least one reward token must be claimable"
        );

        if (collabTokensClaimable) {
            collabPayableAmount = staker.collabRewardsEarned.sub(staker.collabRewardsReleased);
            staker.collabRewardsReleased = staker.collabRewardsReleased.add(collabPayableAmount);

            collabRewardToken.safeTransfer(_user, collabPayableAmount);
        }

        if (tokensClaimable) {
            arcPayableAmount = staker.arcRewardsEarned.sub(staker.arcRewardsReleased);
            staker.arcRewardsReleased = staker.arcRewardsReleased.add(arcPayableAmount);

            uint256 daoPayable = arcPayableAmount
                .mul(daoAllocation)
                .div(BASE);
            rewardToken.safeTransfer(arcDAO, daoPayable);
            rewardToken.safeTransfer(_user, arcPayableAmount.sub(daoPayable));
        }

        emit RewardPaid(_user, arcPayableAmount, collabPayableAmount);
    }

    function withdraw(
        uint256 _amount,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
        checkScoreProof(_scoreProof, false)
        updateReward(msg.sender, address(0))
    {
        Staker storage staker = stakers[msg.sender];

        require(
            _amount >= 0,
            "JointPassportCampaign: cannot withdraw less than 0"
        );

        require(
            staker.balance >= _amount,
            "JointPassportCampaign: cannot withdraw more than the balance"
        );

        totalSupply = totalSupply.sub(_amount);
        staker.balance = staker.balance.sub(_amount);

        emit Withdrawn(msg.sender, _amount);

        stakingToken.safeTransfer(msg.sender, _amount);
    }

    /**
     * @notice Claim reward and withdraw collateral
     */
    function exit(
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {
        getReward(msg.sender, _scoreProof);
        withdraw(balanceOf(msg.sender), _scoreProof);
    }

    /* ========== Private Functions ========== */

    function _rewardPerToken(
        address _rewardTokenAddress
    )
        private
        view
        verifyRewardToken(_rewardTokenAddress)
        returns (uint256)
    {
        if (_rewardTokenAddress == address(rewardToken)) {
            if (totalSupply == 0) {
                return rewardPerTokenStored;
            }

            return rewardPerTokenStored.add(
                lastTimeRewardApplicable(address(rewardToken))
                    .sub(lastUpdateTime)
                    .mul(rewardRate)
                    .mul(BASE)
                    .div(totalSupply)
            );
        } else {
            if (totalSupply == 0) {
                return collabPerTokenStored;
            }

            return collabPerTokenStored.add(
                lastTimeRewardApplicable(address(collabRewardToken))
                    .sub(collabLastUpdateTime)
                    .mul(collabRewardRate)
                    .mul(BASE)
                    .div(totalSupply)
            );
        }
    }

    /**
     * @dev If an individual reward token is updated, only update the relevant variables
     */
    function _updateRewardTokenCalculations(
        address _rewardToken
    )
        private
    {
        require(
            _rewardToken == address(0) ||
            _rewardToken == address(rewardToken) ||
            _rewardToken == address(collabRewardToken),
            "JointPassportCampaign: invalid reward token"
        );

        if (_rewardToken == address(0)) {
            rewardPerTokenStored = _rewardPerToken(address(rewardToken));
            collabPerTokenStored = _rewardPerToken(address(collabRewardToken));

            lastUpdateTime = lastTimeRewardApplicable(address(rewardToken));
            collabLastUpdateTime = lastTimeRewardApplicable(address(collabRewardToken));

        } else if (_rewardToken == address(rewardToken)) {
            rewardPerTokenStored = _rewardPerToken(address(rewardToken));
            lastUpdateTime = lastTimeRewardApplicable(address(rewardToken));

        } else {
            collabPerTokenStored = _rewardPerToken(address(collabRewardToken));
            collabLastUpdateTime = lastTimeRewardApplicable(address(collabRewardToken));
        }
    }

    function _updateRewardsForUser(
        address _account
    )
        private
    {
        if (_account != address(0)) {
            stakers[_account].arcRewardsEarned = _actualEarned(_account, address(rewardToken));
            stakers[_account].arcRewardPerTokenPaid = rewardPerTokenStored;

            stakers[_account].collabRewardsEarned = _actualEarned(_account, address(collabRewardToken));
            stakers[_account].collabRewardPerTokenPaid = collabPerTokenStored;
        }
    }
}
