// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {MozartV1} from "../debt/mozart/MozartV1.sol";
import {Storage} from "../lib/Storage.sol";

contract MockMozartV1 is MozartV1 {

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
