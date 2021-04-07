// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Ownable} from "../lib/Ownable.sol";
import {SafeMath} from "../lib/SafeMath.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";

import {IERC20} from "../token/IERC20.sol";

contract WaitlistBatch is Ownable {

    struct Batch {
        uint256 totalSpots;
        uint256 filledSpots;
        uint256 batchStartTimestamp;
        uint256 depositAmount;
        bool claimable;
    }

    address public depositCurrency;

    uint256 public totalNumberOfBatches;

    mapping (uint256 => mapping (address => uint256)) public userDepositMapping;

    mapping (uint256 => Batch) public batchMapping;

    mapping (address => bool) hasUserApplied;

    event AppliedToBatch(
        address indexed user,
        uint256 batchNumber,
        uint256 amount
    );

    event NewBatchStarted(
        uint256 totalSpots,
        uint256 batchStartTimestamp,
        uint256 depositAmount
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

    function applyToBatch(
        uint256 _batchNumber
    )
        public
    {

    }

    function startNewBatch(
        uint256 _totalSpots,
        uint256 _batchStartTimestamp,
        uint256 _depositAmount
    )
        public
    {

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
