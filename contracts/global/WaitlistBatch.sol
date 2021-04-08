// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Ownable} from "../lib/Ownable.sol";
import {SafeMath} from "../lib/SafeMath.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";

import {IERC20} from "../token/IERC20.sol";

import "hardhat/console.sol";

contract WaitlistBatch is Ownable {

    /* ========== Types ========== */

    struct Batch {
        uint256 totalSpots;
        uint256 filledSpots;
        uint256 batchStartTimestamp;
        uint256 depositAmount;
        bool claimable;
    }

    struct UserBatchInfo {
        bool hasParticipated;
        uint256 batchNumber;
        uint256 depositAmount;
    }

    /* ========== Variables ========== */

    IERC20 public depositCurrency;

    uint256 public totalNumberOfBatches;

    mapping (uint256 => mapping (address => uint256)) public userDepositMapping;

    mapping (uint256 => Batch) public batchMapping;

    mapping (address => uint256) userBatchMapping;

    /* ========== Events ========== */

    event AppliedToBatch(
        address indexed user,
        uint256 batchNumber,
        uint256 amount
    );

    event NewBatchAdded(
        uint256 totalSpots,
        uint256 batchStartTimestamp,
        uint256 depositAmount,
        uint256 batchNumber
    );

    event BatchTimestampChanged(
        uint256 batchNumber,
        uint256 batchStartTimstamp
    );

    event BatchTotalSpotsUpdated(
        uint256 batchNumber,
        uint256 newTotalSpots
    );

    event BatchClaimsEnabled(
        uint256 batchNumber
    );

    /* ========== Constructor ========== */

    constructor(address _depostCurrency) public {
        depositCurrency = IERC20(_depostCurrency);
    }

    /* ========== Public Getters ========== */

    function getBatchInfoForUser(
        address _user
    )
        public
        view
        returns (UserBatchInfo memory)
    {

    }

    /* ========== Public Functions ========== */

    function applyToBatch(
        uint256 _batchNumber
    )
        public
    {

    }

    /* ========== Admin Functions ========== */

    /**
     * @dev Adds a new batch to the `batchMapping` and increases the
     *      count of `totalNumberOfBatches`
     */
    function addNewBatch(
        uint256 _totalSpots,
        uint256 _batchStartTimestamp,
        uint256 _depositAmount
    )
        public
        onlyOwner
    {
        console.log(block.timestamp);
        require(
            _batchStartTimestamp >= block.timestamp,
            "WaitlistBatch: batch start time cannot be in the past"
        );

        require(
            _depositAmount > 0,
            "WaitlistBatch: deposit amount cannot be 0"
        );

        require(
            _totalSpots > 0,
            "WaitlistBatch: batch cannot have 0 spots"
        );

        Batch memory batch = Batch(
            _totalSpots,
            0,
            _batchStartTimestamp,
            _depositAmount,
            false
        );

        batchMapping[totalNumberOfBatches] = batch;
        totalNumberOfBatches = totalNumberOfBatches + 1;

        emit NewBatchAdded(
            _totalSpots,
            _batchStartTimestamp,
            _depositAmount,
            totalNumberOfBatches - 1
        );
    }

    function changeBatchStartTimestamp(
        uint256 _batchNumber,
        uint256 _newStartTimestamp
    )
        public
    {

    }

    function changeBatchTotalSpots(
        uint256 _batchNumber,
        uint256 _newSpots
    )
        public
    {

    }

    function enableClaims(
        uint256[] memory _batchNumbers
    )
        public
    {

    }

    function transferTokens(
        address _tokenAddress,
        uint256 _amount,
        address _desination
    )
        public
    {

    }
}
