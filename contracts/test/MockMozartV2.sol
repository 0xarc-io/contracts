// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {MozartCoreV2} from "../debt/mozart/MozartCoreV2.sol";
import {Storage} from "../lib/Storage.sol";

contract MockMozartCoreV2 is MozartCoreV2 {

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
