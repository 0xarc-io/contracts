// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {D2CoreV1} from "../v2/D2CoreV1.sol";

contract MockD2CoreV1 is D2CoreV1 {

    uint256 private _currentTimestamp = 0;

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