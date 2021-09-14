// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {SafeMath} from "../lib/SafeMath.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";
import {Address} from "../lib/Address.sol";
import {Adminable} from "../lib/Adminable.sol";
import {Bytes32} from "../lib/Bytes32.sol";
import {PassportScoreVerifiable} from "../lib/PassportScoreVerifiable.sol";

import {IERC20} from "../token/IERC20.sol";

import {ISapphirePassportScores} from "../sapphire/ISapphirePassportScores.sol";
import {SapphireTypes} from "../sapphire/SapphireTypes.sol";

/**
 * @notice A farm that does not require minting debt to earn rewards,
 *         but requires a valid defi passport with a good credit score.
 *         Users can get slashed if their credit score go below a threshold.
 */
contract PassportCampaign is Adminable, PassportScoreVerifiable {

    /* ========== Libraries ========== */

    using Address for address;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Bytes32 for bytes32;

    /* ========== Structs ========== */

    struct Staker {
        uint256 balance;
        uint256 rewardPerTokenPaid;
        uint256 rewardsEarned;
        uint256 rewardsReleased;
    }

    /* ========== Constants ========== */

    uint256 constant BASE = 10 ** 18;

    /* ========== Variables ========== */

    IERC20 public rewardsToken;
    IERC20 public stakingToken;

    address public arcDAO;
    address public rewardsDistributor;

    mapping (address => Staker) public stakers;

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public rewardsDuration = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public maxStakePerUser;
    uint16 public creditScoreThreshold;

    uint256 public daoAllocation;

    bool public tokensClaimable;

    uint256 public totalSupply;

    bool private _isInitialized;

    /**
     * @dev The protocol value to be used in the score proofs
     */
    bytes32 private _proofProtocol;

    /* ========== Events ========== */

    event RewardAdded (uint256 reward);

    event Staked(address indexed user, uint256 amount);

    event Withdrawn(address indexed user, uint256 amount);

    event RewardPaid(address indexed user, uint256 reward);

    event RewardsDurationUpdated(uint256 newDuration);

    event Recovered(address token, uint256 amount);

    event ClaimableStatusUpdated(bool _status);

    event RewardsDistributorUpdated(address _newRewardsDistributor);

    event CreditScoreContractSet(address _creditScoreContract);

    event ProofProtocolSet(string _protocol);

    /* ========== Modifiers ========== */

    modifier updateReward(address _account) {
        rewardPerTokenStored = _actualRewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();

        if (_account != address(0)) {
            stakers[_account].rewardsEarned = _actualEarned(_account);
            stakers[_account].rewardPerTokenPaid = rewardPerTokenStored;
        }
        _;
    }

    modifier onlyRewardsDistributor() {
        require(
            msg.sender == rewardsDistributor,
            "PassportCampaign: caller is not a rewards distributor"
        );
        _;
    }

    /* ========== Admin Functions ========== */

    function setRewardsDistributor(
        address _rewardsDistributor
    )
        external
        onlyAdmin
    {
        require(
            rewardsDistributor != _rewardsDistributor,
            "PassportCampaign: the same rewards distributor is already set"
        );

        rewardsDistributor = _rewardsDistributor;

        emit RewardsDistributorUpdated(rewardsDistributor);
    }

    function setRewardsDuration(
        uint256 _rewardsDuration
    )
        external
        onlyAdmin
    {
        require(
            periodFinish == 0 || currentTimestamp() > periodFinish,
            "LiquidityCampaign:setRewardsDuration() Period not finished yet"
        );

        require(
            _rewardsDuration != rewardsDuration,
            "PassportCampaign: cannot set the same rewards duration"
        );

        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }

    /**
     * @notice Sets the reward amount for a period of `rewardsDuration`
     */
    function notifyRewardAmount(
        uint256 _reward
    )
        external
        onlyRewardsDistributor
        updateReward(address(0))
    {
        require(
            rewardsDuration != 0,
            "PassportCampaign: rewards duration must first be set"
        );

        if (currentTimestamp() >= periodFinish) {
            rewardRate = _reward.div(rewardsDuration);
        } else {
            uint256 remaining = periodFinish.sub(currentTimestamp());
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = _reward.add(leftover).div(rewardsDuration);
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balance = rewardsToken.balanceOf(address(this));
        require(
            rewardRate <= balance.div(rewardsDuration),
            "PassportCampaign: provided reward too high"
        );

        periodFinish = currentTimestamp().add(rewardsDuration);
        lastUpdateTime = currentTimestamp();

        emit RewardAdded(_reward);
    }

    /**
     * @notice Withdraws ERC20 into the admin's account
     */
    function recoverERC20(
        address _tokenAddress,
        uint256 _tokenAmount
    )
        external
        onlyAdmin
    {
        // Cannot recover the staking token or the rewards token
        require(
            _tokenAddress != address(stakingToken) && _tokenAddress != address(rewardsToken),
            "PassportCampaign: cannot withdraw staking or rewards tokens"
        );

        // Since the token might not be trusted, it's better to emit
        // the event before the external call
        emit Recovered(_tokenAddress, _tokenAmount);

        IERC20(_tokenAddress).safeTransfer(getAdmin(), _tokenAmount);
    }

    function setTokensClaimable(
        bool _enabled
    )
        external
        onlyAdmin
    {
        require(
            _enabled != tokensClaimable,
            "PassportCampaign: cannot set the claim status to the same value"
        );

        tokensClaimable = _enabled;

        emit ClaimableStatusUpdated(_enabled);
    }

    function setCreditScoreThreshold(
        uint16 _newThreshold
    )
        external
        onlyAdmin
    {
        creditScoreThreshold = _newThreshold;
    }

    function setPassportScoresContract(
        address _passportScoresContract
    )
        external
        onlyAdmin
    {
        require(
            address(passportScoresContract) != _passportScoresContract,
            "PassportCampaign: the same passport scores address is already set"
        );

        require(
            _passportScoresContract.isContract(),
            "PassportCampaign: the given address is not a contract"
        );

        passportScoresContract = ISapphirePassportScores(_passportScoresContract);

        emit CreditScoreContractSet(_passportScoresContract);
    }

    function setMaxStakePerUser(
        uint256 _maxStakePerUser
    )
        external
        onlyAdmin
    {
        maxStakePerUser = _maxStakePerUser;
    }

    function init(
        address _arcDAO,
        address _rewardsDistributor,
        address _rewardsToken,
        address _stakingToken,
        address _creditScoreContract,
        uint256 _daoAllocation,
        uint256 _maxStakePerUser,
        uint16 _creditScoreThreshold
    )
        external
        onlyAdmin
    {
        require(
            !_isInitialized,
            "PassportCampaign: The init function cannot be called twice"
        );

        _isInitialized = true;

        require(
            _arcDAO != address(0) &&
            _rewardsDistributor != address(0) &&
            _rewardsToken != address(0) &&
            _stakingToken != address(0) &&
            _creditScoreContract != address(0) &&
            _daoAllocation > 0 &&
            _creditScoreThreshold > 0,
            "One or more parameters of init() cannot be null"
        );

        arcDAO                  = _arcDAO;
        rewardsDistributor      = _rewardsDistributor;
        rewardsToken            = IERC20(_rewardsToken);
        stakingToken            = IERC20(_stakingToken);
        passportScoresContract  = ISapphirePassportScores(_creditScoreContract);
        daoAllocation           = _daoAllocation;
        maxStakePerUser         = _maxStakePerUser;
        creditScoreThreshold    = _creditScoreThreshold;
    }

    function setProofProtocol(
        bytes32 _protocol
    )
        external
        onlyAdmin
    {
        _proofProtocol = _protocol;

        emit ProofProtocolSet(_proofProtocol.toString());
    }

    /* ========== View Functions ========== */

    /**
     * @notice Returns the balance of the staker address
     */
    function balanceOf(
        address _account
    )
        public
        view
        returns (uint256)
    {
        return stakers[_account].balance;
    }

    /**
     * @notice Returns the current block timestamp if the reward period did not finish, or `periodFinish` otherwise
     */
    function lastTimeRewardApplicable()
        public
        view
        returns (uint256)
    {
        return currentTimestamp() < periodFinish ? currentTimestamp() : periodFinish;
    }

    /**
     * @notice Returns the current reward amount per token staked
     */
    function _actualRewardPerToken()
        private
        view
        returns (uint256)
    {
        if (totalSupply == 0) {
            return rewardPerTokenStored;
        }

        return rewardPerTokenStored.add(
            lastTimeRewardApplicable()
                .sub(lastUpdateTime)
                .mul(rewardRate)
                .mul(BASE)
                .div(totalSupply)
        );
    }

    function rewardPerToken()
        external
        view
        returns (uint256)
    {
        if (totalSupply == 0) {
            return rewardPerTokenStored;
        }

        // Since we're adding the stored amount we can't just multiply
        // the userAllocation() with the result of actualRewardPerToken()
        uint256 fullRewardPerToken = lastTimeRewardApplicable()
            .sub(lastUpdateTime)
            .mul(rewardRate)
            .mul(BASE)
            .div(totalSupply);

        uint256 lastTimeRewardUserAllocation = fullRewardPerToken
            .mul(userAllocation())
            .div(BASE);

        return rewardPerTokenStored.add(lastTimeRewardUserAllocation);
    }

    function _actualEarned(
        address _account
    )
        internal
        view
        returns (uint256)
    {
        return stakers[_account]
            .balance
            .mul(_actualRewardPerToken().sub(stakers[_account].rewardPerTokenPaid))
            .div(BASE)
            .add(stakers[_account].rewardsEarned);
    }

    function earned(
        address _account
    )
        external
        view
        returns (uint256)
    {
        return _actualEarned(_account)
            .mul(userAllocation())
            .div(BASE);
    }

    function getRewardForDuration()
        external
        view
        returns (uint256)
    {
        return rewardRate.mul(rewardsDuration);
    }

    function currentTimestamp()
        public
        view
        returns (uint256)
    {
        return block.timestamp;
    }

    function userAllocation()
        public
        view
        returns (uint256)
    {
        return BASE.sub(daoAllocation);
    }

    function getProofProtocol()
        external
        view
        returns (string memory)
    {
        return _proofProtocol.toString();
    }

    /* ========== Mutative Functions ========== */

    function stake(
        uint256 _amount,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
        checkScoreProof(_scoreProof, true, true)
        updateReward(msg.sender)
    {
        // Do not allow user to stake if they do not meet the credit score requirements
        require(
            _scoreProof.score >= creditScoreThreshold,
            "PassportCampaign: user does not meet the credit score requirement"
        );

        require(
            _scoreProof.protocol == _proofProtocol,
            "PassportCampaign: incorrect protocol in proof"
        );

        // Setting each variable individually means we don't overwrite
        Staker storage staker = stakers[msg.sender];

        staker.balance = staker.balance.add(_amount);

        // Heads up: the the max stake amount is not set in stone. It can be changed
        // by the admin by calling `setMaxStakePerUser()`
        if (maxStakePerUser > 0) {
            require(
                staker.balance <= maxStakePerUser,
                "PassportCampaign: cannot stake more than the limit"
            );
        }

        totalSupply = totalSupply.add(_amount);

        emit Staked(msg.sender, _amount);

        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function getReward(
        address _user,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
        checkScoreProof(_scoreProof, false, true)
        updateReward(_user)
    {
        _getReward(_user);
    }

    function withdraw(
        uint256 _amount,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
        checkScoreProof(_scoreProof, false, true)
        updateReward(msg.sender)
    {
        _withdraw(_amount);
    }

    /**
     * @notice Claim reward and withdraw collateral
     */
    function exit(
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
        checkScoreProof(_scoreProof, false, true)
        updateReward(msg.sender)
    {
        _getReward(msg.sender);
        _withdraw(balanceOf(msg.sender));
    }

    /* ========== Private Functions ========== */

    function _getReward(
        address _user
    )
        private
    {
        require(
            tokensClaimable,
            "PassportCampaign: tokens cannot be claimed yet"
        );

        Staker storage staker = stakers[_user];

        uint256 payableAmount = staker.rewardsEarned.sub(staker.rewardsReleased);

        staker.rewardsReleased = staker.rewardsEarned;

        uint256 daoPayable = payableAmount
            .mul(daoAllocation)
            .div(BASE);

        emit RewardPaid(_user, payableAmount);

        rewardsToken.safeTransfer(_user, payableAmount.sub(daoPayable));
        rewardsToken.safeTransfer(arcDAO, daoPayable);
    }

    function _withdraw(
        uint256 _amount
    )
        private
    {
        require(
            stakers[msg.sender].balance >= _amount,
            "PassportCampaign: cannot withdraw more than the balance"
        );

        totalSupply = totalSupply.sub(_amount);
        stakers[msg.sender].balance = stakers[msg.sender].balance.sub(_amount);

        emit Withdrawn(msg.sender, _amount);

        stakingToken.safeTransfer(msg.sender, _amount);
    }
}

