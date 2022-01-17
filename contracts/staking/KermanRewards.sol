pragma solidity 0.8.4;

import {Address} from "../lib/Address.sol";
import {Adminable} from "../lib/Adminable.sol";
import {Initializable} from "../lib/Initializable.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";
import {IKermanERC20} from "../token/KermanERC20.sol";
import {ISablier} from "../global/ISablier.sol";

contract KermanRewards is Adminable, Initializable {
    /* ========== Libraries ========== */

    using Address for address;
    using SafeERC20 for IKermanERC20;

    /* ========== Variables ========== */

    IKermanERC20 public stakingToken;

    ISablier public sablierContract;
    uint256 public sablierStreamId;
    uint256 public stakeDeadline;
    uint256 public claimDeadline;
    uint256 private _totalShares;
    mapping (address => uint256) private _balances;

    /* ========== Events ========== */

    event Staked(address indexed _user);

    event Exited(address indexed _user);

    event SablierContractSet(address _sablierContract);

    event SablierStreamIdSet(uint256 _streamId);

    event StakeDeadlineSet(uint256 _stakeDeadline);
    event ClaimDeadlineSet(uint256 _claimDeadline);

    event FundsWithdrawnFromSablier(uint256 _streamId, uint256 _amount);

    /* ========== Restricted Functions ========== */

    function init(
        address _sablierContract, 
        address _stakingToken,
        uint256 _stakeDeadline,
        uint256 _claimDeadline
    )
        external
        onlyAdmin
        initializer 
    {
        require (
            _stakingToken.isContract(),
            "KermanRewards: staking token is not a contract"
        );

        require (
            _sablierContract.isContract(),
            "KermanRewards: the sablier contract is invalid"
        );
        stakingToken = IKermanERC20(_stakingToken);
        sablierContract = ISablier(_sablierContract);
        stakeDeadline  = _stakeDeadline;
        claimDeadline  = _claimDeadline;
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

        (, address recipient,,,,,,) = sablierContract.getStream(_sablierStreamId);

        require (
            recipient == address(this),
            "KermanRewards: reciepient of stream is not current contract"
        );

        sablierStreamId = _sablierStreamId;

        emit SablierStreamIdSet(sablierStreamId);
    }

    function setStakeDeadline(uint256 _stakeDeadline)
            external
        onlyAdmin
    {
        stakeDeadline = _stakeDeadline;

        emit StakeDeadlineSet(claimDeadline);
    }

    function setClaimDeadline(uint256 _claimDeadline)
        external
        onlyAdmin
    {
        claimDeadline = _claimDeadline;

        emit ClaimDeadlineSet(claimDeadline);
    }

    /* ========== Public Functions ========== */

    /**
     * @notice Show the amount of tokens from sablier stream
     */
    function earned()
        external
        view
        returns (uint256)
    {
        return 0;
    }

    /**
     * @notice Withdraws from the sablier stream if possible
     */
    function claimStreamFunds()
        public
    {
        if (address(sablierContract) == address(0) || sablierStreamId == 0) {
            return;
        }

        // Get the balance of the stream. If the stream is complete, .balanceOf() will
        // throw. For that reason, we will use .staticcall() to check the balance.
        bytes memory payload = abi.encodeWithSignature(
            "balanceOf(uint256,address)",
            sablierStreamId,
            address(this)
        );
        (bool success, bytes memory returnData) = address(sablierContract).staticcall(payload);

        if (!success) {
            // The stream is finished
            return;
        }

        (uint256 availableBalance) = abi.decode(returnData, (uint256));

        sablierContract.withdrawFromStream(sablierStreamId, availableBalance);

        emit FundsWithdrawnFromSablier(sablierStreamId, availableBalance);
    }

    function stake() external {
        uint256 userBalance = stakingToken.balanceOf(msg.sender);

        require(
            userBalance > 0,
            "KermanRewards: balance of staking token is 0"
        );

        require(
            currentTimestamp() < stakeDeadline,
            "KermanRewards: period of staking finished"
        );

        // Gets the amount of the staking token locked in the contract
        uint256 totalStakingToken = stakingToken.balanceOf(address(this));

        if (totalStakingToken == 0 && _totalShares == 0) {
            _mint(msg.sender, userBalance);
        } else {
            // add to private shares proporpotionally based on userBalance
            uint256 what = userBalance * _totalShares / totalStakingToken;
            _mint(msg.sender, what);
        }

        stakingToken.transferFrom(msg.sender, address(this), userBalance);
    }

    function claim() external {
        // burn msg.sender's Kerman tokens 
        // transfer msg.sender's ARCx
    }

    /* ========== View Functions ========== */

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
        _balances[account] = _balances[account] + amount;
    }
}
