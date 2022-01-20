// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {Address} from "../lib/Address.sol";
import {Adminable} from "../lib/Adminable.sol";
import {Initializable} from "../lib/Initializable.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";
import {IKermanERC20} from "../token/KermanERC20.sol";
import {IERC20} from "../token/IERC20.sol";
import {ISablier} from "../global/ISablier.sol";

contract KermanRewards is Adminable, Initializable {
    /* ========== Libraries ========== */

    using Address for address;
    using SafeERC20 for IERC20;

    /* ========== Variables ========== */

    IKermanERC20 public stakingToken;
    IERC20 public rewardsToken;

    ISablier public sablierContract;
    uint256 public sablierStreamId;
    uint256 public stakeDeadline;

    uint256 private _totalShares;
    mapping (address => uint256) private _shares;

    /* ========== Events ========== */

    event Staked(address indexed _user, uint256 _amount);

    event Claimed(address indexed _user, uint256 _amount);

    event SablierContractSet(address _sablierContract);

    event SablierStreamIdSet(uint256 _streamId);

    event StakeDeadlineSet(uint256 _stakeDeadline);

    event FundsWithdrawnFromSablier(uint256 _streamId, uint256 _amount);

    /* ========== Restricted Functions ========== */

    function init(
        address _sablierContract, 
        address _stakingToken,
        address _rewardsToken,
        uint256 _stakeDeadline
    )
        external
        onlyAdmin
        initializer 
    {
        require (
            _rewardsToken.isContract(),
            "KermanRewards: rewards token is not a contract"
        );

        require (
            _stakingToken.isContract(),
            "KermanRewards: staking token is not a contract"
        );

        require (
            _sablierContract.isContract(),
            "KermanRewards: the sablier contract is invalid"
        );
        stakingToken = IKermanERC20(_stakingToken);
        rewardsToken = IERC20(_rewardsToken);
        sablierContract = ISablier(_sablierContract);
        stakeDeadline  = _stakeDeadline;
    }


    /**
     * @notice Sets the Sablier contract address
     */
    function setSablierContract(
        address _sablierContract
    )
        external
        onlyAdmin
    {
        require (
            _sablierContract.isContract(),
            "StakingAccrualERC20: address is not a contract"
        );

        sablierContract = ISablier(_sablierContract);

        emit SablierContractSet(_sablierContract);
    }

    /**
     * @notice Sets the Sablier stream ID
     */
    function setSablierStreamId(
        uint256 _sablierStreamId
    )
        external
        onlyAdmin
    {
        require (
            sablierStreamId != _sablierStreamId,
            "KermanRewards: the same stream ID is already set"
        );

        (, address recipient,,address tokenAddress,,,,) = sablierContract.getStream(_sablierStreamId);

        require(
            tokenAddress == address(rewardsToken),
            "KermanRewards: token of the stream is not current rewardsToken"
        );

        require (
            recipient == address(this),
            "KermanRewards: recipient of stream is not current contract"
        );

        sablierStreamId = _sablierStreamId;

        emit SablierStreamIdSet(sablierStreamId);
    }

    function setStakeDeadline(uint256 _stakeDeadline)
        external
        onlyAdmin
    {
        stakeDeadline = _stakeDeadline;

        emit StakeDeadlineSet(stakeDeadline);
    }

    /* ========== Public Functions ========== */

    /**
     * @notice Withdraws from the sablier stream if possible
     */
    function claimStreamFunds()
        public
    {
        if (address(sablierContract) == address(0) || sablierStreamId == 0) {
            return;
        }

        try sablierContract.balanceOf(sablierStreamId, address(this)) returns (uint256 availableBalance) {
            sablierContract.withdrawFromStream(sablierStreamId, availableBalance);

            emit FundsWithdrawnFromSablier(sablierStreamId, availableBalance);
        } catch (bytes memory) {
            return;
        }

    }

    function stake() external {
        uint256 userBalance = stakingToken.balanceOf(msg.sender);

        require(
            userBalance > 0,
            "KermanRewards: balance of staking token is 0"
        );

        require(
            currentTimestamp() < stakeDeadline,
            "KermanRewards: staking period finished"
        );

        _mint(msg.sender, userBalance);

        stakingToken.burnFrom(msg.sender, userBalance);

        emit Staked(msg.sender, userBalance);
    }

    function claim() external {
        require(
            _shares[msg.sender] > 0,
            "KermanRewards: user does not have staked balance"
        );

        uint256 timestamp = currentTimestamp();
        require(
            timestamp > stakeDeadline,
            "KermanRewards: stake period is not finished"
        );

        claimStreamFunds();

        uint256 _amount = _shares[msg.sender] * rewardsToken.balanceOf(address(this)) / _totalShares;
        rewardsToken.safeTransfer(
            msg.sender,
            _amount
        );
        _burn(msg.sender);

        emit Claimed(msg.sender, _amount);
    }

    /* ========== View Functions ========== */

    /**
     * @notice Show the amount of tokens from sablier stream
     */
    function earned(address _user)
        external
        view
        returns (uint256)
    {
        (,,,,,uint256 stopTime,,uint256 ratePerSecond) = sablierContract.getStream(sablierStreamId);
        uint256 timestamp = currentTimestamp();

        if (timestamp > stakeDeadline && _totalShares > 0) {
            uint256 claimDuration;
            if (stopTime < timestamp) {
                claimDuration = stopTime - stakeDeadline;
            } else {
                claimDuration = timestamp - stakeDeadline;
            }
        
            return _shares[_user] * ratePerSecond * claimDuration / _totalShares;
        } else {
            return 0;
        }
    }

    function currentTimestamp()
        public
        virtual
        view
        returns (uint256)
    {
        return block.timestamp;
    }

    /* ========== Private Functions ========== */
    
    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     */
    function _mint(
        address account,
        uint256 amount
    )
        private
    {
        _totalShares = _totalShares + amount;
        _shares[account] = _shares[account] + amount;
    }

    /** @dev Burns all shares of user, decreasing the total supply.
     */
    function _burn(
        address account
    )
        private
    {
        _totalShares = _totalShares - _shares[account];
        _shares[account] = 0;
    }
}
