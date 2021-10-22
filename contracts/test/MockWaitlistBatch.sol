// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import {WaitlistBatch} from "../global/WaitlistBatch.sol";

contract MockWaitlistBatch is WaitlistBatch {
    uint256 private _currentTimestamp = 0;

    constructor(
        address _depositCurrency,
        uint256 _depositLockupDuration
    )
        WaitlistBatch(_depositCurrency, _depositLockupDuration)
    {} // solhint-disable-line

    function setCurrentTimestamp(uint256 _timestamp)
        public
    {
        _currentTimestamp = _timestamp;
    }

    function currentTimestamp()
        public
        view
        override
        returns (uint256)
    {
        return _currentTimestamp;
    }
}
