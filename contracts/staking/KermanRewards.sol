pragma solidity 0.8.4;

import {Address} from "../lib/Address.sol";
import {Adminable} from "../lib/Adminable.sol";
import {Initializable} from "../lib/Initializable.sol";
import {IKermanERC20} from "../token/KermanERC20.sol";
import {ISablier} from "../global/ISablier.sol";

contract KermanRewards is Adminable, Initializable {
    /* ========== Libraries ========== */

    using Address for address;

    /* ========== Variables ========== */

    IKermanERC20 public stakingToken;

    ISablier public sablierContract;
    uint256 public sablierStreamId;
    uint256 public endDate;


    /* ========== Events ========== */

    event Staked(address indexed _user);

    event Exited(address indexed _user);

    event SablierContractSet(address _sablierContract);

    event SablierStreamIdSet(uint256 _streamId);

    event EndDateSet(uint256 _endDate);

    /* ========== Restricted Functions ========== */

    function init(
        address _sablierContract, 
        address _stakingToken,
        uint256 _endDate
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
        endDate  = _endDate;
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

    function setEndDate(uint256 _endDate)
        external
        onlyAdmin
    {
        endDate = _endDate;

        emit EndDateSet(endDate);
    }

    /* ========== Public Functions ========== */

    function stake() external {
        uint256 userBalance = stakingToken.balanceOf(msg.sender);

        require(
            userBalance > 0,
            "KermanRewards: balance of staking token is 0"
        );

        require(
            currentTimestamp() < endDate,
            "KermanRewards: period of staking finished"
        );

        stakingToken.burnFrom(msg.sender, userBalance);
    }

    function claim() external {
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
}
