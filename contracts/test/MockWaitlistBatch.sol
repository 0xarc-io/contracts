// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {WaitlistBatch} from "../global/WaitlistBatch.sol";

contract MockWaitlistBatch is WaitlistBatch {
    uint256 private _currentTimestamp = 0;

    constructor(
        address _depositCurrency,
        uint256 _depositLockupDuration
    )
        public
        WaitlistBatch(_depositCurrency, _depositLockupDuration)
    {}

    function setCurrentTimestamp(uint256 _timestamp)
        public
    {
        _currentTimestamp = _timestamp;
    }

    function currentTimestamp()
        public
        view
        returns (uint256)
    {
        return _currentTimestamp;
    }
}
