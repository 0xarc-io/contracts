// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {WaitlistBatch} from "../global/WaitlistBatch.sol";

contract MockWaitlistBatch is WaitlistBatch {
    uint256 private _currentTimestamp = 0;

    constructor(address _depositCurrency)
        public
        WaitlistBatch(_depositCurrency)
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
